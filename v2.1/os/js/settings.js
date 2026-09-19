/**
 * RID3 Settings — приложение настроек ОС.
 */
const RID3Settings = (() => {
  const KEY = 'rid3_settings_v1';

  // Отслеживаем состояние реестра приложений (apps/apps.json) для вкладки
  // «Реестр» — момент последней успешной проверки и последнюю ошибку,
  // если «Обновить реестр» когда-либо завершалось неудачей.
  const registryInfo = { checkedAt: null, error: null };
  window.addEventListener('rid3:apps-ready', () => { registryInfo.checkedAt = new Date(); registryInfo.error = null; });
  if (window.RID3BootLoader) {
    window.RID3BootLoader.ready
      .then(() => { registryInfo.checkedAt = new Date(); })
      .catch((e) => { registryInfo.error = (e && e.message) || 'Реестр приложений недоступен.'; });
  }

  const defaults = {
    motion: 'full',        // full | reduced | off
    accent: 'cyan',        // cyan | violet | warm
    wallpaperGrid: true,
    clockSeconds: false,
    iconSize: 'md'         // sm | md | lg
  };

  let state = { ...defaults };

  function load() {
    try { state = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch (e) { state = { ...defaults }; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  function apply() {
    document.body.classList.toggle('no-motion', state.motion === 'off');
    document.body.classList.toggle('reduced-motion', state.motion === 'reduced');

    const accents = {
      cyan: ['#6EE7F9', '#A78BFA'],
      violet: ['#A78BFA', '#FF8FE0'],
      warm: ['#FFB86B', '#FF6B6B']
    };
    const [a1, a2] = accents[state.accent] || accents.cyan;
    document.documentElement.style.setProperty('--accent', a1);
    document.documentElement.style.setProperty('--accent-2', a2);

    const grid = document.getElementById('wallpaper');
    if (grid) grid.style.setProperty('--grid-opacity', state.wallpaperGrid ? '1' : '0');

    document.getElementById('wallpaper')?.classList.toggle('no-grid', !state.wallpaperGrid);
  }

  function set(key, value) {
    state[key] = value;
    save();
    apply();
  }

  function get(key) { return state[key]; }

  function buildUI() {
    const root = document.createElement('div');
    root.className = 'app-pane settings-layout';
    root.innerHTML = `
      <div class="settings-nav">
        <button class="settings-nav-item active" data-tab="appearance">Оформление</button>
        <button class="settings-nav-item" data-tab="motion">Анимации</button>
        <button class="settings-nav-item" data-tab="performance">Производительность</button>
        <button class="settings-nav-item" data-tab="system">Система</button>
        <button class="settings-nav-item" data-tab="registry">Реестр</button>
        <button class="settings-nav-item" data-tab="about">О системе</button>
      </div>
      <div class="settings-content" id="settings-content"></div>
    `;
    const nav = root.querySelectorAll('.settings-nav-item');
    const content = root.querySelector('#settings-content');

    function render(tab) {
      nav.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      content.innerHTML = tabs[tab]();
      bindTab(tab, content, render);
    }

    nav.forEach(b => b.addEventListener('click', () => render(b.dataset.tab)));
    render('appearance');
    return root;
  }

  const tabs = {
    appearance: () => `
      <h2 class="settings-section-title">Оформление</h2>
      <p class="settings-section-sub">Акцентный цвет и вид рабочего стола.</p>
      <label class="field-label">Акцентный цвет</label>
      <div class="theme-swatches">
        <div class="theme-swatch ${state.accent==='cyan'?'active':''}" data-accent="cyan" style="background:linear-gradient(135deg,#6EE7F9,#A78BFA)"></div>
        <div class="theme-swatch ${state.accent==='violet'?'active':''}" data-accent="violet" style="background:linear-gradient(135deg,#A78BFA,#FF8FE0)"></div>
        <div class="theme-swatch ${state.accent==='warm'?'active':''}" data-accent="warm" style="background:linear-gradient(135deg,#FFB86B,#FF6B6B)"></div>
      </div>
      <div class="setting-row">
        <div><div class="row-label">Сетка на обоях</div><div class="row-desc">Тонкая координатная сетка поверх фона рабочего стола.</div></div>
        <label class="switch"><input type="checkbox" id="opt-grid" ${state.wallpaperGrid?'checked':''}><span class="track"><span class="thumb"></span></span></label>
      </div>
      <div class="setting-row">
        <div><div class="row-label">Секунды на часах</div><div class="row-desc">Показывать секунды в панели задач.</div></div>
        <label class="switch"><input type="checkbox" id="opt-seconds" ${state.clockSeconds?'checked':''}><span class="track"><span class="thumb"></span></span></label>
      </div>
    `,
    motion: () => `
      <h2 class="settings-section-title">Анимации</h2>
      <p class="settings-section-sub">Управление движением интерфейса — окна, меню, переходы.</p>
      <div class="setting-row" style="flex-direction:column; align-items:stretch; gap:10px;">
        <div class="row-label">Режим анимации</div>
        <select class="field" id="opt-motion">
          <option value="full" ${state.motion==='full'?'selected':''}>Полные — все эффекты и плавные переходы</option>
          <option value="reduced" ${state.motion==='reduced'?'selected':''}>Сокращённые — короче и мягче</option>
          <option value="off" ${state.motion==='off'?'selected':''}>Выключены — мгновенные переходы</option>
        </select>
        <div class="row-desc">Влияет на открытие/закрытие окон, стартовое меню, пульс в панели задач и всплывающие подсказки.</div>
      </div>
    `,
    performance: () => `
      <h2 class="settings-section-title">Производительность</h2>
      <p class="settings-section-sub">Симуляция ограниченной оперативной памяти. Каждое приложение объявляет свою потребность в памяти (МБ) в манифесте .rva — если суммарно запущенные приложения превысят лимит, новое приложение не запустится.</p>
      <div class="setting-row" style="flex-direction:column; align-items:stretch; gap:10px;">
        <div class="row-label">Общий объём «ОЗУ» системы: <b id="mem-total-label">${RID3Resources.getTotal()} МБ</b></div>
        <input type="range" id="opt-memory" min="128" max="8192" step="128" value="${RID3Resources.getTotal()}">
        <div class="row-desc">Системные приложения (Файлы, Настройки, IDE) не расходуют этот бюджет — только установленные .rva-приложения.</div>
      </div>
      <div class="setting-row">
        <div><div class="row-label">Используется сейчас</div><div class="row-desc">${RID3Resources.getUsed()} МБ занято запущенными приложениями, свободно ${RID3Resources.getFree()} МБ.</div></div>
      </div>
      <div class="app-list">
        ${RID3Resources.runningApps().map(u => {
          const app = RID3Apps.getApp(u.appId);
          return `<div class="app-list-row"><span class="app-list-icon">${app ? RID3Icon.html(app.icon, app.name) : '📦'}</span><span class="app-list-name">${app ? app.name : u.appId}</span><span class="row-desc">${u.memory} МБ</span></div>`;
        }).join('') || '<div class="row-desc" style="padding:10px 0">Сейчас не запущено ни одного .rva-приложения.</div>'}
      </div>
    `,
    system: () => `
      <h2 class="settings-section-title">Система</h2>
      <p class="settings-section-sub">Хранилище, приложения и экспорт данных.</p>
      <div class="setting-row">
        <div><div class="row-label">Скачать всё как ZIP</div><div class="row-desc">Файловая система, установленные приложения и настройки — одним архивом.</div></div>
        <button class="btn primary" id="opt-export">Скачать .zip</button>
      </div>
      <div class="setting-row">
        <div><div class="row-label">Установленные .rva-приложения</div><div class="row-desc">${Object.keys(RID3Apps.installed).length} приложений установлено локально.</div></div>
        <button class="btn" id="opt-open-installer">Установить новое</button>
      </div>
      <div class="app-list" id="opt-app-list">
        ${Object.values(RID3Apps.installed).map(app => `
          <div class="app-list-row" data-id="${app.id}">
            <span class="app-list-icon">${RID3Icon.html(app.icon, app.name)}</span>
            <span class="app-list-name">${app.name}<br><span class="row-desc">${RID3Permissions.labelList(app.permissions)} · ${(app.resources && app.resources.memory) || RID3Manifest.DEFAULT_MEMORY} МБ</span></span>
            <button class="btn danger" data-uninstall="${app.id}">Удалить</button>
          </div>
        `).join('') || '<div class="row-desc" style="padding:10px 0">Нет установленных приложений.</div>'}
      </div>
      <div class="setting-row">
        <div><div class="row-label">Сбросить систему</div><div class="row-desc">Удалить все файлы, приложения и настройки из этого браузера.</div></div>
        <button class="btn danger" id="opt-reset">Сбросить</button>
      </div>
    `,
    registry: () => {
      const staticApps = RID3Apps.allApps().filter(a => a.static);
      const statusHtml = registryInfo.error
        ? `<span style="color:var(--danger)">Ошибка: ${escapeHtml(registryInfo.error)}</span>`
        : registryInfo.checkedAt
          ? `Проверено: ${registryInfo.checkedAt.toLocaleTimeString()}`
          : 'Ещё не проверялось.';
      return `
      <h2 class="settings-section-title">Реестр приложений</h2>
      <p class="settings-section-sub">Встроенные приложения, загруженные из <code>apps/apps.json</code> при старте ОС (см. <code>lib/local/script.py</code> и <code>lib/boot-loader.js</code>).</p>
      <div class="setting-row">
        <div><div class="row-label">Статус</div><div class="row-desc" id="registry-status">${statusHtml}</div></div>
        <button class="btn primary" id="opt-registry-reload">Обновить реестр</button>
      </div>
      <div class="app-list" id="registry-app-list">
        ${staticApps.map(app => `
          <div class="app-list-row" data-id="${app.id}">
            <span class="app-list-icon">${RID3Icon.html(app.icon, app.name)}</span>
            <span class="app-list-name">${app.name}<br><span class="row-desc">v${app.version} · ${app.path} · ${(app.resources && app.resources.memory) || RID3Manifest.DEFAULT_MEMORY} МБ</span></span>
          </div>
        `).join('') || '<div class="row-desc" style="padding:10px 0">Реестр пуст или ещё не загружен.</div>'}
      </div>
    `;
    },
    about: () => `
      <h2 class="settings-section-title">RID3 OS</h2>
      <p class="settings-section-sub">версия 2.0 · веб-ОС на HTML/CSS/JS</p>
      <div class="setting-row"><div class="row-label">Формат приложений</div><div class="row-desc">.rva — текстовый конфиг вида ключ: значение, описывающий главную страницу приложения, его файлы, права доступа и требования к памяти.</div></div>
      <div class="setting-row"><div class="row-label">Хранилище</div><div class="row-desc">localStorage браузера. Ничего не отправляется на сервер.</div></div>
      <div class="setting-row"><div class="row-label">IDE</div><div class="row-desc">Полноценная среда разработки .rva-приложений — файловый проводник, вкладки, подсветка синтаксиса, менеджер прав и сборка. См. значок 🧑‍💻 на рабочем столе.</div></div>
    `
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function bindTab(tab, content, render) {
    if (tab === 'appearance') {
      content.querySelectorAll('.theme-swatch').forEach(s => s.addEventListener('click', () => {
        set('accent', s.dataset.accent);
        content.querySelectorAll('.theme-swatch').forEach(x => x.classList.remove('active'));
        s.classList.add('active');
      }));
      content.querySelector('#opt-grid').addEventListener('change', e => set('wallpaperGrid', e.target.checked));
      content.querySelector('#opt-seconds').addEventListener('change', e => set('clockSeconds', e.target.checked));
    }
    if (tab === 'motion') {
      content.querySelector('#opt-motion').addEventListener('change', e => set('motion', e.target.value));
    }
    if (tab === 'performance') {
      const range = content.querySelector('#opt-memory');
      const label = content.querySelector('#mem-total-label');
      range.addEventListener('input', e => { label.textContent = e.target.value + ' МБ'; });
      range.addEventListener('change', e => { RID3Resources.setTotal(Number(e.target.value)); render('performance'); });
    }
    if (tab === 'registry') {
      content.querySelector('#opt-registry-reload').addEventListener('click', async (e) => {
        const btn = e.target;
        const statusEl = content.querySelector('#registry-status');
        if (!window.RID3BootLoader) {
          statusEl.innerHTML = '<span style="color:var(--danger)">RID3BootLoader недоступен.</span>';
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Проверка…';
        try {
          const apps = await window.RID3BootLoader.reload();
          RID3Apps.registerStaticApps(apps);
          registryInfo.checkedAt = new Date();
          registryInfo.error = null;
          RID3OS.refreshLaunchers();
          render('registry');
          RID3OS.toast(`Реестр обновлён: ${apps.length} прил.`);
        } catch (err) {
          registryInfo.error = (err && (err.title ? `${err.title} ${err.detail || ''}`.trim() : err.message)) || 'Не удалось обновить реестр.';
          render('registry');
          RID3OS.error('Не удалось обновить реестр', registryInfo.error);
        } finally {
          btn.disabled = false;
          btn.textContent = 'Обновить реестр';
        }
      });
    }
    if (tab === 'system') {
      content.querySelector('#opt-export').addEventListener('click', () => RID3Export.downloadZip());
      content.querySelector('#opt-open-installer').addEventListener('click', () => document.getElementById('rva-file-input').click());
      content.querySelectorAll('[data-uninstall]').forEach(btn => {
        btn.addEventListener('click', () => RID3OS.uninstallApp(btn.dataset.uninstall, () => render('system')));
      });
      content.querySelector('#opt-reset').addEventListener('click', () => {
        RID3OS.confirm('Сбросить систему?', 'Все файлы, установленные приложения и настройки будут удалены безвозвратно.', () => {
          localStorage.clear();
          location.reload();
        });
      });
    }
  }

  load();
  return { apply, set, get, buildUI };
})();
