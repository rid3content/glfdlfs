const RID3OS = (() => {

  function boot() {
    RID3Settings.apply();
    const statusEl = document.getElementById('boot-status');
    const steps = ['инициализация ядра…', 'монтирование файловой системы…', 'загрузка приложений…', 'готово'];
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (statusEl && steps[i]) statusEl.textContent = steps[i];
      if (i >= steps.length - 1) clearInterval(iv);
    }, 320);

    // Критический шаг: пока /apps/apps.json и ресурсы всех приложений
    // из него не подтвердят HTTP 200 (см. lib/boot-loader.js), экран
    // загрузки НЕ скрывается и рабочий стол НЕ инициализируется.
    // При отказе boot-loader.js сам рисует чёрный экран Critical Boot
    // Error поверх страницы — здесь достаточно просто не продолжать.
    const minSplash = new Promise((resolve) => setTimeout(resolve, 1400));

    Promise.all([
      window.RID3BootLoader ? window.RID3BootLoader.ready : Promise.resolve([]),
      minSplash,
    ])
      .then(([staticApps]) => {
        RID3Apps.registerStaticApps(staticApps);
        clearInterval(iv);
        document.getElementById('boot-screen').style.display = 'none';
        const desktop = document.getElementById('desktop');
        desktop.classList.remove('hidden');
        requestAnimationFrame(() => desktop.classList.add('entered'));
        initDesktop();
      })
      .catch(() => {
        // Реестр приложений недоступен/повреждён — RID3BootLoader уже
        // показал критический экран. Дальнейшая инициализация ОС
        // намеренно не выполняется.
        clearInterval(iv);
      });
  }

  function initDesktop() {
    renderDesktopIcons();
    renderStartMenu();
    bindGlobalUI();
    bindHotkeys();
    startClock();
    registerServiceWorker();
  }

  // ---------- Иконки рабочего стола ----------
  function renderDesktopIcons() {
    const wrap = document.getElementById('desktop-icons');
    wrap.innerHTML = '';
    const pinned = [
      { id: 'sys.files', name: 'Файлы', icon: 'svg:files' },
      { id: 'sys.settings', name: 'Настройки', icon: 'svg:settings' },
      { id: 'sys.ide', name: 'RID3 IDE', icon: 'svg:code' },
      { id: 'install', name: 'Установить .rva', icon: 'svg:upload' },
    ];
    const makeIcon = (id, name, icon, onOpen, ctxItems) => {
      const el = document.createElement('div');
      el.className = 'desktop-icon';
      el.tabIndex = 0;
      el.innerHTML = `<div class="glyph">${RID3Icon.html(icon, name)}</div><div class="label">${name}</div>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectDesktopIcon(el);
      });
      el.addEventListener('dblclick', (e) => { e.stopPropagation(); onOpen(); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') onOpen(); });
      if (ctxItems) {
        RID3Menu.bind(el, () => { selectDesktopIcon(el); return ctxItems(); });
      }
      wrap.appendChild(el);
    };
    pinned.forEach(item => makeIcon(item.id, item.name, item.icon, () => item.id === 'install' ? openInstallDialog() : launchApp(item.id), () => [
      { label: 'Открыть', icon: '↗', action: () => item.id === 'install' ? openInstallDialog() : launchApp(item.id) }
    ]));
    Object.values(RID3Apps.installed).forEach(app => makeIcon(app.id, app.name, app.icon, () => launchApp(app.id), () => appContextMenu(app.id)));
    RID3Apps.allApps().filter(app => app.static).forEach(app => makeIcon(app.id, app.name, app.icon, () => launchApp(app.id), () => [
      { label: 'Открыть', icon: '↗', action: () => launchApp(app.id) }
    ]));
  }

  /** Контекстное меню установленного приложения — общее для рабочего стола и стартового меню. */
  function appContextMenu(id) {
    const app = RID3Apps.getApp(id);
    if (!app) return [];
    return [
      { label: 'Открыть', icon: '↗', action: () => launchApp(id) },
      '-',
      { label: 'Переименовать', icon: '✏️', action: () => renamePrompt(id) },
      { label: 'Изменить конфиг', icon: '🛠', action: () => openEditConfig(id) },
      { label: 'Показать путь к файлам', icon: '🗂', action: () => showFilesPath(id) },
      '-',
      { label: 'Удалить приложение', icon: '🗑', danger: true, action: () => uninstallApp(id) },
    ];
  }

  function renamePrompt(id) {
    const app = RID3Apps.getApp(id);
    if (!app) return;
    prompt('Переименовать приложение', 'Новое название', app.name, (name) => {
      if (!name || name === app.name) return;
      if (!RID3Apps.rename(id, name)) return error('Не удалось переименовать', 'Не удалось изменить название приложения.');
      persistManifest(id);
      refreshLaunchers();
      toast('Название изменено');
    });
  }

  function showFilesPath(id) {
    const path = RID3Apps.filesPath(id);
    const backdrop = modal(`
      <div class="modal-box">
        <div class="modal-head"><span class="icon">🗂</span><span class="title">Путь к файлам</span></div>
        <div class="modal-body">
          Файлы приложения хранятся по пути:<br>
          <code style="display:inline-block;margin-top:8px;">${path}</code>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" data-close>Закрыть</button>
          <button class="btn primary" data-open>Открыть в Файлах</button>
        </div>
      </div>
    `);
    backdrop.querySelector('[data-close]').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('[data-open]').addEventListener('click', () => { backdrop.remove(); openFilesAt(path.replace(/^\//, '')); });
    return backdrop;
  }

  function openFilesAt(path) {
    const existing = Object.values(RID3Windows.all).find(w => w.appId === 'sys.files');
    if (existing) RID3Windows.close(existing.winId);
    setTimeout(() => {
      RID3Windows.open({ id: 'sys.files', title: 'Файлы', icon: '🗂', width: 760, height: 500, contentEl: RID3FileManager.buildUI(path) });
    }, existing ? 160 : 0);
  }

  /** Форма редактирования конфига приложения — иконка, окно, права, память. */
  function openEditConfig(id) {
    const app = RID3Apps.getApp(id);
    if (!app) return;
    const permsHtml = RID3Permissions.ALL.map(p => `
      <label class="perm-row">
        <input type="checkbox" data-perm="${p.id}" ${app.permissions && app.permissions.includes(p.id) ? 'checked' : ''}>
        <span class="perm-icon">${p.icon}</span>
        <span><span class="perm-name">${p.name}</span><br><span class="row-desc">${p.desc}</span></span>
      </label>`).join('');
    const backdrop = modal(`
      <div class="modal-box" style="width:520px; max-height:86vh; display:flex; flex-direction:column;">
        <div class="modal-head"><span class="icon">🛠</span><span class="title">Изменить конфиг — ${app.name}</span></div>
        <div class="modal-body" style="overflow-y:auto;">
          <label class="field-label" style="margin-top:0">Иконка (эмодзи, ссылка/картинка или svg:ключ)</label>
          <input class="field" id="cfg-icon" value="${RID3Icon.isImage(app.icon) ? '' : app.icon}" placeholder="📦">
          <label class="field-label">Или выберите SVG-иконку из библиотеки</label>
          ${RID3Icon.pickerHTML(RID3Icon.libraryKey(app.icon))}
          <label class="field-label">Размер окна</label>
          <div style="display:flex; gap:8px;">
            <input class="field" id="cfg-w" type="number" value="${app.window.width}">
            <input class="field" id="cfg-h" type="number" value="${app.window.height}">
          </div>
          <label class="field-label">Заявленная память (МБ)</label>
          <input class="field" id="cfg-mem" type="number" min="16" value="${(app.resources && app.resources.memory) || RID3Manifest.DEFAULT_MEMORY}">
          <label class="field-label">Права доступа</label>
          <div class="perm-list">${permsHtml}</div>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" data-cancel>Отмена</button>
          <button class="btn primary" data-save>Сохранить</button>
        </div>
      </div>
    `);
    backdrop.querySelector('[data-cancel]').addEventListener('click', () => backdrop.remove());
    RID3Icon.bindPicker(backdrop, (key) => {
      backdrop.querySelector('#cfg-icon').value = RID3Icon.SVG_PREFIX + key;
    });
    backdrop.querySelector('[data-save]').addEventListener('click', () => {
      const icon = backdrop.querySelector('#cfg-icon').value.trim() || '📦';
      const width = Number(backdrop.querySelector('#cfg-w').value) || app.window.width;
      const height = Number(backdrop.querySelector('#cfg-h').value) || app.window.height;
      const memory = Math.max(16, Number(backdrop.querySelector('#cfg-mem').value) || RID3Manifest.DEFAULT_MEMORY);
      const permissions = Array.from(backdrop.querySelectorAll('[data-perm]:checked')).map(c => c.dataset.perm);
      RID3Apps.updateConfig(id, { icon, window: { width, height }, permissions, resources: { memory } });
      persistManifest(id);
      backdrop.remove();
      refreshLaunchers();
      toast('Конфиг обновлён');
    });
    return backdrop;
  }

  /** Пересохраняет .rva-файл приложения в его служебной папке после правок конфига. */
  function persistManifest(id) {
    const app = RID3Apps.getApp(id);
    if (!app) return;
    const data = {
      app: app.name, version: app.version, icon: RID3Icon.isImage(app.icon) ? '📦' : app.icon, type: app.type,
      entry: app.entry, files: Object.keys(app.files), window: app.window,
      permissions: app.permissions || [], resources: app.resources
    };
    const base = RID3FS.appFolderPath(id);
    RID3FS.list(base).forEach(n => { if (n.name.endsWith(RID3Manifest.EXT)) RID3FS.remove(base + '/' + n.name); });
    RID3FS.createFile(base + '/' + app.name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-') + RID3Manifest.EXT, RID3Manifest.serialize(data));
  }

  function uninstallApp(id, onDone) {
    const app = RID3Apps.getApp(id);
    if (!app) return;
    if (RID3Apps.isSystem(id)) return error('Нельзя удалить', 'Системные приложения нельзя удалить.');
    confirm('Удалить приложение?', `Приложение «${app.name}» и все его файлы будут удалены безвозвратно.`, () => {
      RID3Apps.uninstall(id);
      refreshLaunchers();
      toast(`Приложение «${app.name}» удалено`);
      if (typeof onDone === 'function') onDone();
    });
  }

  function selectDesktopIcon(el) {
    document.querySelectorAll('.desktop-icon.selected').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    el.focus();
  }
  function clearDesktopSelection() {
    document.querySelectorAll('.desktop-icon.selected').forEach(x => x.classList.remove('selected'));
  }
  function getSelectedDesktopIcon() {
    return document.querySelector('.desktop-icon.selected');
  }

  // ---------- Стартовое меню ----------
  function renderStartMenu() {
    const grid = document.getElementById('start-grid');
    grid.innerHTML = '';
    RID3Apps.allApps().forEach(app => {
      const el = document.createElement('button');
      el.className = 'start-app';
      el.innerHTML = `<div class="glyph">${RID3Icon.html(app.icon, app.name)}</div><div class="label">${app.name}</div>`;
      el.addEventListener('click', () => { launchApp(app.id); closeStartMenu(); });
      if (!app.system && !app.static) {
        RID3Menu.bind(el, () => appContextMenu(app.id));
      }
      grid.appendChild(el);
    });
  }

  function refreshLaunchers() {
    renderDesktopIcons();
    renderStartMenu();
  }

  function toggleStartMenu() {
    document.getElementById('start-menu').classList.toggle('open');
  }
  function closeStartMenu() {
    document.getElementById('start-menu').classList.remove('open');
  }

  // ---------- Запуск приложений ----------
  function launchApp(id) {
    if (id === 'sys.files') {
      return RID3Windows.open({ id, title: 'Файлы', icon: '🗂', width: 760, height: 500, contentEl: RID3FileManager.buildUI() });
    }
    if (id === 'sys.settings') {
      return RID3Windows.open({ id, title: 'Настройки', icon: '⚙', width: 680, height: 480, contentEl: RID3Settings.buildUI() });
    }
    if (id === 'sys.ide') {
      return RID3Windows.open({ id, title: 'RID3 IDE', icon: '🧑‍💻', width: 980, height: 640, contentEl: RID3IDE.buildUI() });
    }

    const app = RID3Apps.getApp(id);
    if (!app) {
      return error('Приложение не найдено', `Не удалось найти приложение <code>${id}</code>. Возможно, оно было удалено.`);
    }
    return launchUserApp(app);
  }

  /** Запуск установленного .rva-приложения: белый экран загрузки → проверка памяти → окно/ошибка. */
  function launchUserApp(app) {
    const memory = (app.resources && app.resources.memory) || RID3Manifest.DEFAULT_MEMORY;
    const loadingMs = Math.min(6000, Math.max(500, 500 + memory * 4));

    const loadingEl = document.createElement('div');
    loadingEl.className = 'app-loading-screen';
    loadingEl.innerHTML = `
      <div class="app-loading-ring"></div>
      <div class="app-loading-title">${RID3Icon.html(app.icon, app.name)} ${app.name}</div>
      <div class="app-loading-sub" id="app-loading-sub">Загрузка приложения…</div>
    `;
    const winId = RID3Windows.open({
      id: 'loading.' + app.id + '.' + Date.now(),
      title: app.name, icon: app.icon,
      width: app.window.width, height: app.window.height, resizable: app.window.resizable,
      contentEl: loadingEl, singleton: false
    });

    const subEl = () => document.getElementById('app-loading-sub');
    const t1 = setTimeout(() => { const s = subEl(); if (s) s.textContent = `Проверка ресурсов… требуется ${memory} МБ`; }, Math.min(loadingMs * 0.5, 2500));

    setTimeout(() => {
      clearTimeout(t1);
      if (!RID3Windows.all[winId]) return; // окно уже закрыто пользователем

      if (!RID3Resources.canFit(memory)) {
        RID3Windows.close(winId);
        const free = RID3Resources.getFree();
        const total = RID3Resources.getTotal();
        return error(
          'Не удалось запустить приложение',
          `Приложение <b>${app.name}</b> не запущено — недостаточно оперативной памяти.<br><br>
           <b>Путь:</b> <code>${RID3Apps.filesPath(app.id)}</code><br>
           <b>Причина:</b> требуется ${memory} МБ, свободно ${free} из ${total} МБ.<br><br>
           Закройте другие приложения в Настройки → Производительность или увеличьте лимит памяти и повторите попытку.`
        );
      }

      const contentEl = buildAppContent(app, winId);
      if (!contentEl) return; // buildAppContent сам показал ошибку

      RID3Windows.setContent(winId, contentEl);
      RID3Resources.reserve(winId, app.id, memory);

      if (RID3Resources.getFree() < RID3Resources.getTotal() * 0.15) {
        warning('Мало свободной памяти', `Свободно всего ${RID3Resources.getFree()} МБ из ${RID3Resources.getTotal()} МБ. Другие тяжёлые приложения могут не запуститься, пока вы не закроете часть окон.`);
      }
    }, loadingMs);

    return winId;
  }

  /** Строит фактическое содержимое окна приложения (iframe/php-просмотр). Возвращает null, если конфиг повреждён (и уже показал ошибку). */
  function buildAppContent(app, winId) {
    // Встроенные приложения из /apps/apps.json (см. lib/boot-loader.js) —
    // это реальные файлы на сервере, а не содержимое в памяти/localStorage,
    // поэтому для них просто открываем iframe по прямому HTTP-пути,
    // без srcdoc-инъекции содержимого.
    if (app.static) {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups allow-same-origin');
      const root = (window.RID3BootLoader && window.RID3BootLoader.PROJECT_ROOT_URL) || document.baseURI;
      iframe.src = new URL(String(app.entry).replace(/^\/+/, ''), root).href;
      RID3Bridge.attach(iframe, app);
      return iframe;
    }

    const entryContent = app.files[app.entry];
    if (entryContent === undefined) {
      RID3Windows.close(winId);
      error(
        'Ошибка запуска приложения',
        `Приложение <b>${app.name}</b> ссылается на главный файл <code>${app.entry}</code>, но он отсутствует в его данных.<br><b>Путь:</b> <code>${RID3Apps.filesPath(app.id)}</code><br><b>Причина:</b> конфигурация .rva повреждена — переустановите приложение.`
      );
      return null;
    }

    if (app.type === 'php') {
      const el = document.createElement('div');
      el.style.cssText = 'height:100%; overflow:auto; background:#0b0e14; color:#e7eaf2; padding:16px; font-family:var(--font-mono); font-size:12px; white-space:pre-wrap;';
      el.innerHTML = `<div style="color:var(--accent-warm); font-family:var(--font-body); margin-bottom:10px;">⚠ PHP выполняется на сервере — в браузере показан только исходный код файла <b>${app.entry}</b>.</div>` + escapeHtml(entryContent);
      return el;
    }

    // type === 'html'
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups');
    let html = entryContent;
    Object.entries(app.files).forEach(([name, content]) => {
      if (name === app.entry) return;
      const blob = new Blob([content], { type: guessMime(name) });
      const url = URL.createObjectURL(blob);
      html = html.split('"' + name + '"').join('"' + url + '"').split("'" + name + "'").join("'" + url + "'");
    });
    // Внедряем мостик системного API перед остальным содержимым страницы.
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, m => m + RID3Bridge.buildClientScript());
    } else {
      html = RID3Bridge.buildClientScript() + html;
    }
    iframe.srcdoc = html;
    RID3Bridge.attach(iframe, app);
    return iframe;
  }

  function guessMime(name) {
    if (name.endsWith('.css')) return 'text/css';
    if (name.endsWith('.js')) return 'application/javascript';
    if (name.endsWith('.html')) return 'text/html';
    return 'text/plain';
  }
  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------- Установка приложений ----------
  function openInstallDialog() {
    document.getElementById('rva-file-input').click();
  }

  async function handleInstallFiles(fileList) {
    if (!fileList || !fileList.length) return;
    const res = await RID3Apps.installFromFiles(fileList);
    if (!res.ok) {
      return error('Не удалось установить приложение', res.error);
    }
    toast(`Приложение «${res.app.name}» установлено`);
    refreshLaunchers();
  }

  // ---------- Глобальные обработчики ----------
  function bindGlobalUI() {
    document.getElementById('start-btn').addEventListener('click', toggleStartMenu);
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('start-menu');
      if (!menu.contains(e.target) && e.target.id !== 'start-btn' && !e.target.closest('#start-btn')) {
        closeStartMenu();
      }
    });

    document.getElementById('desktop').addEventListener('click', (e) => {
      if (e.target.id === 'desktop' || e.target.id === 'wallpaper' || e.target.id === 'desktop-icons') {
        clearDesktopSelection();
      }
    });

    RID3Menu.bind(document.getElementById('wallpaper'), () => [
      { label: 'Обновить рабочий стол', icon: '⟳', action: () => refreshLaunchers() },
      '-',
      { label: 'Установить .rva', icon: '⬆', action: () => openInstallDialog() },
      { label: 'Открыть Файлы', icon: '🗂', action: () => launchApp('sys.files') },
      { label: 'Настройки', icon: '⚙', action: () => launchApp('sys.settings') },
      { label: 'RID3 IDE', icon: '🧑‍💻', action: () => launchApp('sys.ide') },
    ]);

    document.querySelectorAll('.start-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        closeStartMenu();
        if (action === 'install-app') openInstallDialog();
        if (action === 'open-files') launchApp('sys.files');
        if (action === 'open-settings') launchApp('sys.settings');
        if (action === 'open-ide') launchApp('sys.ide');
      });
    });

    document.getElementById('rva-file-input').addEventListener('change', (e) => {
      handleInstallFiles(e.target.files);
      e.target.value = '';
    });
    document.getElementById('rva-folder-input').addEventListener('change', (e) => {
      handleInstallFiles(e.target.files);
      e.target.value = '';
    });

    document.getElementById('start-search').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('.start-app').forEach(el => {
        const label = el.querySelector('.label').textContent.toLowerCase();
        el.style.display = label.includes(q) ? '' : 'none';
      });
    });
  }

  function bindHotkeys() {
    RID3Hotkeys.on('escape', () => {
      closeStartMenu();
      const focused = document.querySelector('.os-window.focused');
      if (focused && focused.__winId) RID3Windows.close(focused.__winId);
    });
    RID3Hotkeys.on('ctrl+q', () => {
      const focused = document.querySelector('.os-window.focused');
      if (focused && focused.__winId) RID3Windows.close(focused.__winId);
    });
    RID3Hotkeys.on('delete', () => {
      const sel = getSelectedDesktopIcon();
      if (!sel) return;
      const label = sel.querySelector('.label').textContent;
      const app = Object.values(RID3Apps.installed).find(a => a.name === label);
      if (app) uninstallApp(app.id);
    });
    RID3Hotkeys.on('ctrl+m', () => toggleStartMenu());
  }

  function startClock() {
    function tick() {
      const now = new Date();
      const seconds = RID3Settings.get('clockSeconds');
      const opts = { hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) };
      document.getElementById('clock').textContent = now.toLocaleTimeString('ru-RU', opts);
    }
    tick();
    setInterval(tick, 1000);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // ---------- Модалки ----------
  function modal(html) {
    const layer = document.getElementById('modal-layer');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = html;
    layer.appendChild(backdrop);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); backdrop.remove(); document.removeEventListener('keydown', onKey, true); }
    };
    document.addEventListener('keydown', onKey, true);
    return backdrop;
  }

  function error(title, messageHtml) {
    const backdrop = modal(`
      <div class="modal-box error">
        <div class="modal-head"><span class="icon">⛔</span><span class="title">${title}</span></div>
        <div class="modal-body">${messageHtml}</div>
        <div class="modal-foot"><button class="btn primary" data-close>Понятно</button></div>
      </div>
    `);
    backdrop.querySelector('[data-close]').addEventListener('click', () => backdrop.remove());
    return backdrop;
  }

  function warning(title, messageHtml) {
    const backdrop = modal(`
      <div class="modal-box warning">
        <div class="modal-head"><span class="icon">⚠️</span><span class="title">${title}</span></div>
        <div class="modal-body">${messageHtml}</div>
        <div class="modal-foot"><button class="btn primary" data-close>Понятно</button></div>
      </div>
    `);
    backdrop.querySelector('[data-close]').addEventListener('click', () => backdrop.remove());
    return backdrop;
  }

  function confirm(title, messageHtml, onYes) {
    const backdrop = modal(`
      <div class="modal-box">
        <div class="modal-head"><span class="icon">❓</span><span class="title">${title}</span></div>
        <div class="modal-body">${messageHtml}</div>
        <div class="modal-foot">
          <button class="btn ghost" data-cancel>Отмена</button>
          <button class="btn danger" data-yes>Подтвердить</button>
        </div>
      </div>
    `);
    backdrop.querySelector('[data-cancel]').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('[data-yes]').addEventListener('click', () => { backdrop.remove(); onYes(); });
    return backdrop;
  }

  function prompt(title, label, placeholder, onSubmit) {
    const backdrop = modal(`
      <div class="modal-box">
        <div class="modal-head"><span class="icon">✏️</span><span class="title">${title}</span></div>
        <div class="modal-body">
          <label class="field-label" style="margin-top:0">${label}</label>
          <input class="field" id="prompt-input" placeholder="${placeholder}">
        </div>
        <div class="modal-foot">
          <button class="btn ghost" data-cancel>Отмена</button>
          <button class="btn primary" data-ok>ОК</button>
        </div>
      </div>
    `);
    const input = backdrop.querySelector('#prompt-input');
    input.value = '';
    input.focus();
    const submit = () => { const v = input.value.trim(); backdrop.remove(); onSubmit(v); };
    backdrop.querySelector('[data-cancel]').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('[data-ok]').addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    return backdrop;
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.cssText = 'position:fixed; left:50%; bottom:74px; transform:translateX(-50%); background:var(--surface-3); border:1px solid var(--border); padding:10px 16px; border-radius:10px; font-size:12.5px; z-index:9500; box-shadow:0 12px 30px rgba(0,0,0,.4);';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  document.addEventListener('DOMContentLoaded', boot);

  return { launchApp, refreshLaunchers, uninstallApp, error, warning, confirm, prompt, toast, openFilesAt };
})();
