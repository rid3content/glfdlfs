/**
 * RID3 Window Manager
 */
const RID3Windows = (() => {
  const layer = () => document.getElementById('window-layer');
  const taskbarApps = () => document.getElementById('taskbar-apps');
  let windows = {};
  let zTop = 10;
  let counter = 0;

  function open({ id, title, icon, width = 480, height = 380, resizable = true, contentEl, onClose, singleton = true }) {
    // если окно с таким id уже открыто (для системных приложений) — просто фокусируем
    const existing = Object.values(windows).find(w => w.appId === id && w.singleton);
    if (existing) { focus(existing.winId); if (existing.minimized) toggleMinimize(existing.winId); return existing.winId; }

    const winId = 'w' + (++counter);
    const el = document.createElement('div');
    el.className = 'os-window opening';
    el.style.width = width + 'px';
    el.style.height = height + 'px';
    el.style.left = (40 + (counter % 6) * 28) + 'px';
    el.style.top = (30 + (counter % 6) * 24) + 'px';
    el.style.zIndex = ++zTop;

    el.innerHTML = `
      <div class="win-topline"></div>
      <div class="win-titlebar">
        <span class="win-icon">${RID3Icon.html(icon || '▫', title)}</span>
        <span class="win-title">${title}</span>
        <div class="win-controls">
          <button class="win-btn min" title="Свернуть">–</button>
          <button class="win-btn max" title="Развернуть">▢</button>
          <button class="win-btn close" title="Закрыть">✕</button>
        </div>
      </div>
      <div class="win-body"></div>
      ${resizable ? '<div class="win-resize-handle"></div>' : ''}
    `;
    el.querySelector('.win-body').appendChild(contentEl);
    el.__winId = winId;
    layer().appendChild(el);

    windows[winId] = { winId, appId: id, el, title, icon, minimized: false, maximized: false, singleton, onClose, prevRect: null };

    bindWindowEvents(winId);
    addTaskbarEntry(winId);
    focus(winId);

    requestAnimationFrame(() => {
      el.addEventListener('animationend', () => el.classList.remove('opening'), { once: true });
    });

    return winId;
  }

  function bindWindowEvents(winId) {
    const w = windows[winId];
    const el = w.el;
    const titlebar = el.querySelector('.win-titlebar');

    el.addEventListener('mousedown', () => focus(winId));

    // Перетаскивание
    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.win-btn')) return;
      if (w.maximized) return;
      const startX = e.clientX, startY = e.clientY;
      const startLeft = el.offsetLeft, startTop = el.offsetTop;
      function onMove(ev) {
        el.style.left = (startLeft + ev.clientX - startX) + 'px';
        el.style.top = Math.max(0, startTop + ev.clientY - startY) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    titlebar.addEventListener('dblclick', () => toggleMaximize(winId));

    // Ресайз
    const handle = el.querySelector('.win-resize-handle');
    if (handle) {
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const startW = el.offsetWidth, startH = el.offsetHeight;
        function onMove(ev) {
          el.style.width = Math.max(320, startW + ev.clientX - startX) + 'px';
          el.style.height = Math.max(200, startH + ev.clientY - startY) + 'px';
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }

    el.querySelector('.win-btn.close').addEventListener('click', () => close(winId));
    el.querySelector('.win-btn.min').addEventListener('click', () => toggleMinimize(winId));
    el.querySelector('.win-btn.max').addEventListener('click', () => toggleMaximize(winId));

    RID3Menu.bind(titlebar, () => [
      { label: w.maximized ? 'Восстановить' : 'Развернуть', icon: '▢', action: () => toggleMaximize(winId) },
      { label: 'Свернуть', icon: '–', action: () => toggleMinimize(winId) },
      '-',
      { label: 'Закрыть', icon: '✕', danger: true, shortcut: 'Ctrl+Q', action: () => close(winId) },
    ]);
  }

  function addTaskbarEntry(winId) {
    const w = windows[winId];
    const btn = document.createElement('button');
    btn.className = 'taskbar-app active';
    btn.dataset.winId = winId;
    btn.innerHTML = `<span class="dot"></span><span>${w.icon || ''} ${w.title}</span>`;
    btn.addEventListener('click', () => {
      if (w.minimized) toggleMinimize(winId);
      else if (windows[winId].el.classList.contains('focused')) toggleMinimize(winId);
      else focus(winId);
    });
    RID3Menu.bind(btn, () => [
      { label: w.minimized ? 'Восстановить' : 'Свернуть', icon: '–', action: () => toggleMinimize(winId) },
      { label: 'Закрыть', icon: '✕', danger: true, action: () => close(winId) },
    ]);
    taskbarApps().appendChild(btn);
    w.taskbarBtn = btn;
    updatePulse();
  }

  function focus(winId) {
    Object.values(windows).forEach(w => w.el.classList.remove('focused'));
    Object.values(windows).forEach(w => w.taskbarBtn && w.taskbarBtn.classList.remove('active'));
    const w = windows[winId];
    if (!w) return;
    w.el.style.zIndex = ++zTop;
    w.el.classList.add('focused');
    if (w.taskbarBtn) w.taskbarBtn.classList.add('active');
  }

  function toggleMinimize(winId) {
    const w = windows[winId];
    w.minimized = !w.minimized;
    w.el.style.display = w.minimized ? 'none' : 'flex';
    if (w.taskbarBtn) w.taskbarBtn.classList.toggle('minimized', w.minimized);
    if (!w.minimized) focus(winId);
  }

  function toggleMaximize(winId) {
    const w = windows[winId];
    if (!w.maximized) {
      w.prevRect = { left: w.el.style.left, top: w.el.style.top, width: w.el.style.width, height: w.el.style.height };
      w.el.style.left = '0'; w.el.style.top = '0'; w.el.style.width = '100%'; w.el.style.height = '100%';
      w.el.classList.add('maximized');
    } else {
      Object.assign(w.el.style, w.prevRect);
      w.el.classList.remove('maximized');
    }
    w.maximized = !w.maximized;
  }

  function close(winId) {
    const w = windows[winId];
    if (!w) return;
    w.el.classList.add('closing');
    setTimeout(() => {
      w.el.remove();
      if (w.taskbarBtn) w.taskbarBtn.remove();
      delete windows[winId];
      RID3Resources.release(winId);
      updatePulse();
      if (typeof w.onClose === 'function') w.onClose();
    }, 140);
  }

  function updatePulse() {
    const count = Object.keys(windows).length;
    const el = document.getElementById('pulse-count');
    if (el) el.textContent = count;
  }

  /** Заменяет содержимое уже открытого окна (используется при переходе «загрузка → готово»). */
  function setContent(winId, el) {
    const w = windows[winId];
    if (!w) return false;
    const body = w.el.querySelector('.win-body');
    body.innerHTML = '';
    body.appendChild(el);
    return true;
  }

  return { open, close, focus, toggleMinimize, toggleMaximize, setContent, get all() { return windows; } };
})();
