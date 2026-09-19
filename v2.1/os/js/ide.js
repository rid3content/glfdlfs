/**
 * RID3 IDE — среда разработки .rva-приложений в стиле Android Studio:
 * проводник проекта (файловое дерево), вкладки открытых файлов, редактор кода
 * с подсветкой синтаксиса, панель прав доступа, требования к памяти,
 * предпросмотр (Run) и сборка (Build → установить локально или скачать файлы).
 */
const RID3IDE = (() => {

  const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Моё приложение</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Привет из RID3 IDE 👋</h1>
  <p id="clock">…</p>
  <script src="script.js"></script>
</body>
</html>`;

  const SAMPLE_CSS = `body{
  margin:0; font-family:sans-serif; background:#0f1220; color:#e7eaf2;
  display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh;
}
h1{ font-weight:600; }`;

  const SAMPLE_JS = `// Пример использования системного API (нужны права "time")
window.addEventListener('rva-ready', async () => {
  try {
    const t = await RVA.time.now();
    document.getElementById('clock').textContent = 'Системное время: ' + t.iso;
  } catch (e) {
    document.getElementById('clock').textContent = 'Нет доступа: ' + e.message;
  }
});`;

  function freshProject() {
    return {
      sourceAppId: null,
      name: 'Моё приложение',
      icon: '✨',
      entry: 'index.html',
      window: { width: 520, height: 400, resizable: true },
      permissions: [],
      memory: 64,
      files: { 'index.html': SAMPLE_HTML, 'style.css': SAMPLE_CSS, 'script.js': SAMPLE_JS }
    };
  }

  function buildUI() {
    let project = freshProject();
    let openTabs = ['index.html'];
    let activeFile = 'index.html';

    const root = document.createElement('div');
    root.className = 'app-pane ide-layout';
    root.innerHTML = `
      <div class="ide-toolbar">
        <select class="field ide-project-select" id="ide-project-select" style="width:220px"></select>
        <button class="btn" id="ide-new">＋ Новый проект</button>
        <span style="flex:1"></span>
        <button class="btn" id="ide-run">▶ Запустить</button>
        <button class="btn primary" id="ide-install">📦 Собрать и установить</button>
        <button class="btn" id="ide-download">⬇ Скачать файлы</button>
      </div>
      <div class="ide-body">
        <div class="ide-sidebar">
          <div class="ide-sidebar-tabs">
            <button class="ide-sidebar-tab active" data-panel="explorer">Проводник</button>
            <button class="ide-sidebar-tab" data-panel="config">Настройки</button>
            <button class="ide-sidebar-tab" data-panel="perms">Права</button>
          </div>
          <div class="ide-sidebar-panel" id="ide-panel-explorer"></div>
          <div class="ide-sidebar-panel" id="ide-panel-config" style="display:none"></div>
          <div class="ide-sidebar-panel" id="ide-panel-perms" style="display:none"></div>
        </div>
        <div class="ide-main">
          <div class="ide-tabs" id="ide-tabs"></div>
          <div class="ide-editor-wrap">
            <pre class="ide-highlight" id="ide-highlight"></pre>
            <textarea class="ide-textarea" id="ide-textarea" spellcheck="false"></textarea>
          </div>
          <div class="ide-console" id="ide-console">Готово. Заполните проект и нажмите «Собрать и установить» или «Запустить» для предпросмотра.</div>
        </div>
      </div>
    `;
    const $ = sel => root.querySelector(sel);

    // ---------- Селектор проекта ----------
    function renderProjectSelect() {
      const sel = $('#ide-project-select');
      const options = ['<option value="">— Новый проект —</option>']
        .concat(Object.values(RID3Apps.installed).map(a => `<option value="${a.id}">${a.name}</option>`));
      sel.innerHTML = options.join('');
      sel.value = project.sourceAppId || '';
    }
    $('#ide-project-select').addEventListener('change', (e) => {
      const id = e.target.value;
      if (!id) { project = freshProject(); }
      else {
        const app = RID3Apps.getApp(id);
        project = {
          sourceAppId: null, // сборка всегда создаёт отдельную установленную копию
          name: app.name + ' (копия)',
          icon: RID3Icon.isImage(app.icon) ? '📦' : app.icon,
          entry: app.entry,
          window: { ...app.window },
          permissions: (app.permissions || []).slice(),
          memory: (app.resources && app.resources.memory) || RID3Manifest.DEFAULT_MEMORY,
          files: { ...app.files }
        };
      }
      openTabs = [project.entry];
      activeFile = project.entry;
      renderAll();
      log('Проект загружен: ' + project.name);
    });

    $('#ide-new').addEventListener('click', () => {
      project = freshProject();
      openTabs = [project.entry];
      activeFile = project.entry;
      renderProjectSelect();
      renderAll();
      log('Создан новый проект.');
    });

    // ---------- Переключение боковых панелей ----------
    root.querySelectorAll('.ide-sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        root.querySelectorAll('.ide-sidebar-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        root.querySelectorAll('.ide-sidebar-panel').forEach(p => p.style.display = 'none');
        $('#ide-panel-' + tab.dataset.panel).style.display = 'block';
      });
    });

    // ---------- Проводник ----------
    function renderExplorer() {
      const panel = $('#ide-panel-explorer');
      panel.innerHTML = `
        <div class="ide-explorer-toolbar">
          <span class="ide-explorer-title">${project.name} <span class="ide-title-icon">${RID3Icon.html(project.icon, project.name)}</span></span>
          <button class="btn" id="ide-add-file" title="Новый файл">＋</button>
        </div>
        <div class="ide-file-list" id="ide-file-list"></div>
      `;
      const list = panel.querySelector('#ide-file-list');
      Object.keys(project.files).forEach(name => {
        const row = document.createElement('div');
        row.className = 'ide-file-row' + (name === activeFile ? ' active' : '') + (name === project.entry ? ' entry' : '');
        row.innerHTML = `<span class="ide-file-icon">${fileGlyph(name)}</span><span class="ide-file-name">${name}</span>${name === project.entry ? '<span class="ide-file-badge">entry</span>' : ''}`;
        row.addEventListener('click', () => openFile(name));
        RID3Menu.bind(row, () => [
          { label: 'Открыть', icon: '↗', action: () => openFile(name) },
          { label: 'Сделать главным файлом (entry)', icon: '🎯', disabled: name === project.entry, action: () => { project.entry = name; renderAll(); log('Главный файл: ' + name); } },
          '-',
          { label: 'Переименовать', icon: '✏️', action: () => renameFile(name) },
          { label: 'Удалить', icon: '🗑', danger: true, disabled: Object.keys(project.files).length <= 1, action: () => deleteFile(name) },
        ]);
        list.appendChild(row);
      });
      panel.querySelector('#ide-add-file').addEventListener('click', addFile);
    }

    function fileGlyph(name) {
      if (name.endsWith('.html')) return '🌐';
      if (name.endsWith('.css')) return '🎨';
      if (name.endsWith('.js')) return '📜';
      return '📄';
    }

    function addFile() {
      RID3OS.prompt('Новый файл', 'Имя файла (с расширением)', 'script.js', (name) => {
        if (!name) return;
        if (project.files[name]) return RID3OS.error('Файл уже существует', `Файл <code>${name}</code> уже есть в проекте.`);
        project.files[name] = name.endsWith('.css') ? '/* новый файл */' : name.endsWith('.js') ? '// новый файл' : '<!-- новый файл -->';
        openTabs.push(name);
        activeFile = name;
        renderAll();
        log('Добавлен файл: ' + name);
      });
    }

    function renameFile(oldName) {
      RID3OS.prompt('Переименовать файл', 'Новое имя', oldName, (newName) => {
        if (!newName || newName === oldName || project.files[newName]) return;
        project.files[newName] = project.files[oldName];
        delete project.files[oldName];
        if (project.entry === oldName) project.entry = newName;
        openTabs = openTabs.map(t => t === oldName ? newName : t);
        if (activeFile === oldName) activeFile = newName;
        // подставляем новое имя во все текстовые ссылки других файлов проекта
        Object.keys(project.files).forEach(f => {
          project.files[f] = project.files[f].split('"' + oldName + '"').join('"' + newName + '"').split("'" + oldName + "'").join("'" + newName + "'");
        });
        renderAll();
        log(`Файл переименован: ${oldName} → ${newName}`);
      });
    }

    function deleteFile(name) {
      if (Object.keys(project.files).length <= 1) return;
      if (name === project.entry) return RID3OS.error('Нельзя удалить', 'Сначала назначьте другой файл главным (entry), затем удалите этот.');
      RID3OS.confirm('Удалить файл?', `Файл <code>${name}</code> будет удалён из проекта.`, () => {
        delete project.files[name];
        openTabs = openTabs.filter(t => t !== name);
        if (activeFile === name) activeFile = openTabs[0] || project.entry;
        renderAll();
        log('Файл удалён: ' + name);
      });
    }

    // ---------- Настройки проекта (имя/иконка/окно/память) ----------
    function renderConfig() {
      const panel = $('#ide-panel-config');
      panel.innerHTML = `
        <label class="field-label" style="margin-top:0">Название приложения</label>
        <input class="field" id="ide-name" value="${project.name}">
        <label class="field-label">Иконка (эмодзи, ссылка/картинка или svg:ключ)</label>
        <input class="field" id="ide-icon" value="${project.icon}">
        <label class="field-label">Или выберите SVG-иконку из библиотеки</label>
        ${RID3Icon.pickerHTML(RID3Icon.libraryKey(project.icon))}
        <label class="field-label">Ширина / высота окна</label>
        <div style="display:flex; gap:8px;">
          <input class="field" id="ide-w" type="number" value="${project.window.width}">
          <input class="field" id="ide-h" type="number" value="${project.window.height}">
        </div>
        <label class="field-label">Заявленная память (МБ)</label>
        <input class="field" id="ide-mem" type="number" min="16" value="${project.memory}">
        <div class="row-desc" style="margin-top:6px;">Чем больше объявленная память — тем дольше приложение будет «грузиться» при запуске и тем выше риск отказа, если в системе не хватит ресурсов.</div>
        <label class="field-label">Предпросмотр манифеста (.rva)</label>
        <div class="builder-preview">${escapeHtml(RID3Manifest.serialize(manifestData()))}</div>
      `;
      panel.querySelector('#ide-name').addEventListener('input', e => { project.name = e.target.value; renderExplorer(); refreshPreviewBlock(); });
      panel.querySelector('#ide-icon').addEventListener('input', e => { project.icon = e.target.value || '✨'; renderExplorer(); refreshPreviewBlock(); });
      RID3Icon.bindPicker(panel, (key) => {
        project.icon = RID3Icon.SVG_PREFIX + key;
        panel.querySelector('#ide-icon').value = project.icon;
        renderExplorer(); refreshPreviewBlock();
      });
      panel.querySelector('#ide-w').addEventListener('input', e => { project.window.width = Number(e.target.value) || project.window.width; refreshPreviewBlock(); });
      panel.querySelector('#ide-h').addEventListener('input', e => { project.window.height = Number(e.target.value) || project.window.height; refreshPreviewBlock(); });
      panel.querySelector('#ide-mem').addEventListener('input', e => { project.memory = Math.max(16, Number(e.target.value) || project.memory); refreshPreviewBlock(); });
    }
    function refreshPreviewBlock() {
      const block = $('#ide-panel-config .builder-preview');
      if (block) block.textContent = RID3Manifest.serialize(manifestData());
    }

    // ---------- Права доступа ----------
    function renderPerms() {
      const panel = $('#ide-panel-perms');
      panel.innerHTML = `
        <div class="row-desc" style="margin-bottom:10px;">Отметьте, какие системные возможности нужны приложению. Внутри приложения они доступны через <code>window.RVA</code> (см. пример в script.js).</div>
        <div class="perm-list">
          ${RID3Permissions.ALL.map(p => `
            <label class="perm-row">
              <input type="checkbox" data-perm="${p.id}" ${project.permissions.includes(p.id) ? 'checked' : ''}>
              <span class="perm-icon">${p.icon}</span>
              <span><span class="perm-name">${p.name}</span><br><span class="row-desc">${p.desc}</span></span>
            </label>`).join('')}
        </div>
      `;
      panel.querySelectorAll('[data-perm]').forEach(cb => {
        cb.addEventListener('change', () => {
          const id = cb.dataset.perm;
          if (cb.checked && !project.permissions.includes(id)) project.permissions.push(id);
          if (!cb.checked) project.permissions = project.permissions.filter(p => p !== id);
        });
      });
    }

    // ---------- Вкладки и редактор ----------
    function renderTabs() {
      const tabsEl = $('#ide-tabs');
      tabsEl.innerHTML = '';
      openTabs.forEach(name => {
        const tab = document.createElement('div');
        tab.className = 'ide-tab' + (name === activeFile ? ' active' : '');
        tab.innerHTML = `<span>${fileGlyph(name)} ${name}</span><span class="ide-tab-close">✕</span>`;
        tab.addEventListener('click', (e) => { if (!e.target.classList.contains('ide-tab-close')) openFile(name); });
        tab.querySelector('.ide-tab-close').addEventListener('click', (e) => {
          e.stopPropagation();
          openTabs = openTabs.filter(t => t !== name);
          if (activeFile === name) activeFile = openTabs[openTabs.length - 1] || project.entry;
          renderAll();
        });
        tabsEl.appendChild(tab);
      });
    }

    function openFile(name) {
      if (!openTabs.includes(name)) openTabs.push(name);
      activeFile = name;
      renderAll();
    }

    function renderEditor() {
      const ta = $('#ide-textarea');
      ta.value = project.files[activeFile] || '';
      highlight();
    }

    function langFor(name) {
      if (name.endsWith('.css')) return 'css';
      if (name.endsWith('.js')) return 'js';
      return 'html';
    }

    function highlight() {
      const pre = $('#ide-highlight');
      const code = project.files[activeFile] || '';
      pre.innerHTML = tokenize(code, langFor(activeFile));
    }

    function tokenize(code, lang) {
      const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let src = esc(code);
      if (lang === 'html') {
        src = src.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tok-comment">$1</span>');
        src = src.replace(/(&lt;\/?)([a-zA-Z0-9-]+)/g, '$1<span class="tok-tag">$2</span>');
        src = src.replace(/([a-zA-Z-]+)(=)(&quot;.*?&quot;|&#39;.*?&#39;)/g, '<span class="tok-attr">$1</span>$2<span class="tok-string">$3</span>');
      } else if (lang === 'css') {
        src = src.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-comment">$1</span>');
        src = src.replace(/([.#]?[a-zA-Z0-9_-]+)(\s*\{)/g, '<span class="tok-tag">$1</span>$2');
        src = src.replace(/([a-zA-Z-]+)(\s*:)/g, '<span class="tok-attr">$1</span>$2');
        src = src.replace(/(:\s*)([^;{}]+)(;)/g, '$1<span class="tok-string">$2</span>$3');
      } else if (lang === 'js') {
        src = src.replace(/(\/\/.*$)/gm, '<span class="tok-comment">$1</span>');
        src = src.replace(/(&#39;.*?&#39;|&quot;.*?&quot;|`[^`]*`)/g, '<span class="tok-string">$1</span>');
        src = src.replace(/\b(const|let|var|function|return|if|else|for|while|await|async|new|class|try|catch|throw|typeof|import|export|default|from)\b/g, '<span class="tok-kw">$1</span>');
        src = src.replace(/\b(\d+)\b/g, '<span class="tok-num">$1</span>');
      }
      return src + '\n';
    }

    $('#ide-textarea').addEventListener('input', (e) => {
      project.files[activeFile] = e.target.value;
      highlight();
      renderExplorer(); // на случай если имя записано в подсказках предпросмотра
    });
    $('#ide-textarea').addEventListener('scroll', (e) => {
      $('#ide-highlight').scrollTop = e.target.scrollTop;
      $('#ide-highlight').scrollLeft = e.target.scrollLeft;
    });

    // ---------- Консоль вывода ----------
    function log(msg, kind) {
      const console_ = $('#ide-console');
      const line = document.createElement('div');
      line.className = 'ide-console-line' + (kind ? ' ' + kind : '');
      line.textContent = msg;
      console_.appendChild(line);
      console_.scrollTop = console_.scrollHeight;
    }

    // ---------- Манифест / валидация / сборка ----------
    function manifestData() {
      return {
        app: project.name,
        version: '1.0',
        icon: RID3Icon.isImage(project.icon) ? '📦' : project.icon,
        type: 'html',
        entry: project.entry,
        files: Object.keys(project.files),
        window: project.window,
        permissions: project.permissions,
        resources: { memory: project.memory }
      };
    }

    function validateProject() {
      const data = manifestData();
      const v = RID3Manifest.validate(data);
      if (!v.ok) { log('Ошибка валидации: ' + v.error, 'error'); return null; }
      return data;
    }

    $('#ide-run').addEventListener('click', () => {
      const data = validateProject();
      if (!data) return;
      const fakeApp = { id: 'preview.' + Date.now().toString(36), name: project.name + ' (предпросмотр)', icon: project.icon, entry: project.entry, files: { ...project.files }, permissions: project.permissions.slice(), window: project.window, type: 'html' };
      RID3Windows.open({ id: fakeApp.id, title: fakeApp.name, icon: fakeApp.icon, width: project.window.width, height: project.window.height, resizable: project.window.resizable, contentEl: buildPreviewContent(fakeApp), singleton: false });
      log('Запущен предпросмотр: ' + project.name);
    });

    function buildPreviewContent(app) {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups');
      let html = app.files[app.entry] || '';
      Object.entries(app.files).forEach(([name, content]) => {
        if (name === app.entry) return;
        const blob = new Blob([content], { type: name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'application/javascript' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        html = html.split('"' + name + '"').join('"' + url + '"').split("'" + name + "'").join("'" + url + "'");
      });
      if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, m => m + RID3Bridge.buildClientScript());
      else html = RID3Bridge.buildClientScript() + html;
      iframe.srcdoc = html;
      RID3Bridge.attach(iframe, app);
      return iframe;
    }

    $('#ide-install').addEventListener('click', () => {
      const data = validateProject();
      if (!data) return;
      const res = RID3Apps.installFromData(data, { ...project.files });
      if (!res.ok) return log('Сборка не удалась: ' + res.error, 'error');
      log(`Собрано и установлено: «${res.app.name}» (${RID3Manifest.EXT} + ${data.files.length} файл(ов), права: ${RID3Permissions.labelList(data.permissions)}, память: ${data.resources.memory} МБ).`, 'ok');
      RID3OS.toast(`Приложение «${res.app.name}» установлено`);
      RID3OS.refreshLaunchers();
      renderProjectSelect();
    });

    $('#ide-download').addEventListener('click', async () => {
      const data = validateProject();
      if (!data) return;
      if (typeof JSZip === 'undefined') {
        Object.entries(project.files).forEach(([name, content], i) => setTimeout(() => downloadText(name, content), i * 150));
        setTimeout(() => downloadText(slug(project.name) + RID3Manifest.EXT, RID3Manifest.serialize(data)), Object.keys(project.files).length * 150);
        return log('JSZip недоступен — файлы скачаны по отдельности.', 'ok');
      }
      const zip = new JSZip();
      zip.file(slug(project.name) + RID3Manifest.EXT, RID3Manifest.serialize(data));
      Object.entries(project.files).forEach(([name, content]) => zip.file(name, content));
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = slug(project.name) + '-rva-project.zip';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      log('Проект скачан как ZIP — распакуйте и выберите все файлы вместе при установке.', 'ok');
    });

    function downloadText(name, text) {
      const blob = new Blob([text], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    function slug(str) { return (str || 'app').toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/(^-|-$)/g, '') || 'app'; }
    function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    function renderAll() {
      renderExplorer();
      renderConfig();
      renderPerms();
      renderTabs();
      renderEditor();
    }

    renderProjectSelect();
    renderAll();
    return root;
  }

  return { buildUI };
})();
