const RID3FileManager = (() => {

  function isSystemPath(path) {
    return path === 'Система' || path.startsWith('Система/');
  }

  function buildUI(initialPath) {
    const root = document.createElement('div');
    root.className = 'app-pane fm-layout';
    let currentPath = initialPath || '';
    let selected = null;

    root.innerHTML = `
      <div class="fm-sidebar" id="fm-tree"></div>
      <div class="fm-main">
        <div class="pane-toolbar">
          <button class="btn" data-act="new-folder">📁 Новая папка</button>
          <button class="btn" data-act="new-file">📄 Новый файл</button>
          <button class="btn" data-act="upload">⬆ Загрузить фото/видео</button>
          <button class="btn danger" data-act="delete" style="margin-left:auto">🗑 Удалить</button>
        </div>
        <div class="fm-path" id="fm-path">/</div>
        <div class="fm-grid" id="fm-grid"></div>
      </div>
      <input type="file" id="fm-upload-input" accept="image/*,video/*" multiple hidden>
    `;

    const uploadInput = root.querySelector('#fm-upload-input');

    function renderTree() {
      const tree = root.querySelector('#fm-tree');
      const roots = RID3FS.list('');
      tree.innerHTML = '';
      const rootItem = mkTreeItem('/ Домашняя папка', '');
      tree.appendChild(rootItem);
      roots.filter(n => n.type === 'folder').forEach(n => tree.appendChild(mkTreeItem((n.system ? '🔒 ' : '📁 ') + n.name, n.name)));
    }
    function mkTreeItem(label, path) {
      const el = document.createElement('div');
      el.className = 'fm-tree-item' + (path === currentPath ? ' active' : '');
      el.textContent = label;
      el.addEventListener('click', () => { currentPath = path; selected = null; renderAll(); });
      return el;
    }

    function renderGrid() {
      const grid = root.querySelector('#fm-grid');
      root.querySelector('#fm-path').textContent = '/' + currentPath + (isSystemPath(currentPath) ? '  (системная зона — только чтение)' : '');
      const items = RID3FS.list(currentPath);
      grid.innerHTML = '';
      const inSystem = isSystemPath(currentPath);
      root.querySelectorAll('[data-act="new-folder"],[data-act="new-file"],[data-act="upload"]').forEach(b => b.disabled = inSystem);
      if (!items.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="glyph">🗂</div><div>Здесь пусто.${inSystem ? '' : ' Создайте папку, файл или загрузите фото/видео.'}</div></div>`;
        return;
      }
      items.forEach(node => {
        const el = document.createElement('div');
        const path = currentPath ? currentPath + '/' + node.name : node.name;
        el.className = 'fm-item' + (selected === path ? ' selected' : '');
        el.innerHTML = `<div class="glyph">${glyphContent(node)}</div><div class="label">${node.name}</div>`;
        el.addEventListener('click', (e) => { e.stopPropagation(); selected = path; renderGrid(); });
        el.addEventListener('dblclick', () => {
          if (node.type === 'folder') { currentPath = path; selected = null; renderAll(); }
          else openFile(path, node);
        });
        RID3Menu.bind(el, () => {
          selected = path; renderGrid();
          return itemContextMenu(path, node);
        });
        grid.appendChild(el);
      });
    }

    function glyphContent(node) {
      if (node.type === 'folder') return node.system ? '🔒' : '📁';
      if (node.mime && node.mime.startsWith('image/') && node.encoding === 'dataurl') {
        return `<img src="${node.content}" class="fm-thumb" draggable="false">`;
      }
      if (node.mime && node.mime.startsWith('video/')) return '🎬';
      if (node.mime && node.mime.startsWith('audio/')) return '🎵';
      return glyphFor(node.name);
    }

    function glyphFor(name) {
      if (name.endsWith(RID3Manifest.EXT)) return '🧩';
      if (name.endsWith('.html')) return '🌐';
      return '📄';
    }

    function itemContextMenu(path, node) {
      const inSystem = isSystemPath(path);
      const items = [];
      items.push({ label: 'Открыть', icon: '↗', action: () => node.type === 'folder' ? (currentPath = path, selected = null, renderAll()) : openFile(path, node) });
      if (node.type === 'file' && node.encoding === 'dataurl') {
        items.push({ label: 'Скачать', icon: '⬇', action: () => downloadDataUrl(node.name, node.content) });
      }
      items.push('-');
      if (inSystem) {
        items.push({ label: 'Переименовать', icon: '✏️', disabled: true, title: 'Системная зона — изменение запрещено' });
        items.push('-');
        items.push({ label: 'Удалить', icon: '🗑', disabled: true, title: 'Управляйте приложением через ПКМ на рабочем столе' });
      } else {
        items.push({ label: 'Переименовать', icon: '✏️', shortcut: 'F2', action: () => renamePrompt(path) });
        items.push('-');
        items.push({ label: 'Удалить', icon: '🗑', danger: true, shortcut: 'Del', action: () => deletePath(path) });
      }
      return items;
    }

    function renamePrompt(path) {
      if (isSystemPath(path)) return;
      const node = RID3FS.resolve(path);
      if (!node) return;
      RID3OS.prompt('Переименовать', 'Новое имя', node.name, (name) => {
        if (!name || name === node.name) return;
        if (!RID3FS.rename(path, name)) return RID3OS.error('Не удалось переименовать', 'Файл или папка с таким именем уже существует.');
        renderAll();
      });
    }

    function deletePath(path) {
      if (isSystemPath(path)) return;
      RID3OS.confirm('Удалить безвозвратно?', `<code>${path}</code> будет удалён.`, () => {
        RID3FS.remove(path);
        if (selected === path) selected = null;
        renderAll();
      });
    }

    function downloadDataUrl(name, dataUrl) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = name;
      a.click();
    }

    function openFile(path, node) {
      if (node.mime && node.mime.startsWith('image/') && node.encoding === 'dataurl') {
        const wrap = document.createElement('div');
        wrap.className = 'media-viewer';
        wrap.innerHTML = `<img src="${node.content}" alt="${node.name}">`;
        return RID3Windows.open({ id: 'file.' + path, title: node.name, icon: '🖼', width: 640, height: 480, resizable: true, contentEl: wrap, singleton: false });
      }
      if (node.mime && node.mime.startsWith('video/') && node.encoding === 'dataurl') {
        const wrap = document.createElement('div');
        wrap.className = 'media-viewer';
        wrap.innerHTML = `<video src="${node.content}" controls autoplay></video>`;
        return RID3Windows.open({ id: 'file.' + path, title: node.name, icon: '🎬', width: 720, height: 480, resizable: true, contentEl: wrap, singleton: false });
      }
      if (node.mime && node.mime.startsWith('audio/') && node.encoding === 'dataurl') {
        const wrap = document.createElement('div');
        wrap.className = 'media-viewer audio';
        wrap.innerHTML = `<div class="audio-glyph">🎵</div><audio src="${node.content}" controls autoplay></audio>`;
        return RID3Windows.open({ id: 'file.' + path, title: node.name, icon: '🎵', width: 420, height: 220, resizable: false, contentEl: wrap, singleton: false });
      }

      const readOnly = isSystemPath(path);
      const editor = document.createElement('div');
      editor.style.cssText = 'height:100%; display:flex; flex-direction:column;';
      editor.innerHTML = `
        <div class="pane-toolbar"><span style="font-size:12px;color:var(--muted)">${path}${readOnly ? ' (только чтение)' : ''}</span>${readOnly ? '' : '<button class="btn primary" style="margin-left:auto" id="save-btn">Сохранить</button>'}</div>
        <textarea class="field" ${readOnly ? 'readonly' : ''} style="flex:1; border-radius:0; resize:none; font-family:var(--font-mono)">${escapeHtml(node.content)}</textarea>
      `;
      if (!readOnly) {
        editor.querySelector('#save-btn').addEventListener('click', () => {
          RID3FS.writeFile(path, editor.querySelector('textarea').value);
          RID3OS.toast('Файл сохранён: ' + node.name);
        });
      }
      RID3Windows.open({ id: 'file.' + path, title: node.name, icon: '📄', width: 520, height: 420, resizable: true, contentEl: editor, singleton: false });
    }

    function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    function renderAll() { renderTree(); renderGrid(); }

    async function uploadFiles(fileList) {
      if (isSystemPath(currentPath)) return;
      const files = Array.from(fileList || []);
      for (const file of files) {
        try {
          const dataUrl = await RID3Icon.readFileAsDataUrl(file);
          let name = file.name || 'файл';
          let path = currentPath ? currentPath + '/' + name : name;
          let i = 1;
          while (RID3FS.exists(path)) {
            const dot = name.lastIndexOf('.');
            const base = dot > 0 ? name.slice(0, dot) : name;
            const ext = dot > 0 ? name.slice(dot) : '';
            path = (currentPath ? currentPath + '/' : '') + base + ' (' + (++i) + ')' + ext;
          }
          RID3FS.createFile(path, dataUrl, file.type || 'application/octet-stream', 'dataurl');
        } catch (e) {
          RID3OS.error('Не удалось загрузить файл', 'Ошибка чтения файла: ' + (file.name || ''));
        }
      }
      renderAll();
      if (files.length) RID3OS.toast(files.length === 1 ? 'Файл загружен' : `Загружено файлов: ${files.length}`);
    }

    root.querySelector('[data-act="new-folder"]').addEventListener('click', () => {
      if (isSystemPath(currentPath)) return;
      RID3OS.prompt('Новая папка', 'Введите имя папки', 'Новая папка', name => {
        if (!name) return;
        const path = currentPath ? currentPath + '/' + name : name;
        if (!RID3FS.createFolder(path)) return RID3OS.error('Не удалось создать папку', `Папка <code>${name}</code> уже существует.`);
        renderAll();
      });
    });
    root.querySelector('[data-act="new-file"]').addEventListener('click', () => {
      if (isSystemPath(currentPath)) return;
      RID3OS.prompt('Новый файл', 'Введите имя файла (с расширением)', 'файл.txt', name => {
        if (!name) return;
        const path = currentPath ? currentPath + '/' + name : name;
        if (!RID3FS.createFile(path, '')) return RID3OS.error('Не удалось создать файл', `Файл <code>${name}</code> уже существует или папка недоступна.`);
        renderAll();
      });
    });
    root.querySelector('[data-act="upload"]').addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', (e) => { uploadFiles(e.target.files); e.target.value = ''; });
    root.querySelector('[data-act="delete"]').addEventListener('click', () => {
      if (!selected) return RID3OS.toast('Сначала выберите файл или папку');
      deletePath(selected);
    });

    const grid = root.querySelector('#fm-grid');
    grid.addEventListener('dragover', (e) => { e.preventDefault(); grid.classList.add('drag-over'); });
    grid.addEventListener('dragleave', () => grid.classList.remove('drag-over'));
    grid.addEventListener('drop', (e) => {
      e.preventDefault();
      grid.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
    });

    RID3Menu.bind(grid, (e) => {
      if (e.target !== grid && e.target.id !== 'fm-grid') return null;
      if (isSystemPath(currentPath)) return [{ label: 'Системная зона — только чтение', icon: '🔒', disabled: true }];
      selected = null; renderGrid();
      return [
        { label: 'Новая папка', icon: '📁', action: () => root.querySelector('[data-act="new-folder"]').click() },
        { label: 'Новый файл', icon: '📄', action: () => root.querySelector('[data-act="new-file"]').click() },
        { label: 'Загрузить фото/видео', icon: '⬆', action: () => uploadInput.click() },
      ];
    });

    root.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' && selected) { e.preventDefault(); deletePath(selected); }
      if (e.key === 'F2' && selected) { e.preventDefault(); renamePrompt(selected); }
    });
    root.tabIndex = 0;
    root.addEventListener('mousedown', () => root.focus());

    renderAll();
    return root;
  }

  return { buildUI };
})();
