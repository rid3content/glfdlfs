const RID3Menu = (() => {
  let currentMenu = null;

  function close() {
    if (currentMenu) { currentMenu.remove(); currentMenu = null; }
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onEsc, true);
  }
  function onOutside(e) {
    if (currentMenu && !currentMenu.contains(e.target)) close();
  }
  function onEsc(e) {
    if (e.key === 'Escape') { close(); e.stopPropagation(); }
  }

  function open(x, y, items) {
    close();
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    items.forEach(item => {
      if (item === '-') {
        const sep = document.createElement('div');
        sep.className = 'ctx-sep';
        menu.appendChild(sep);
        return;
      }
      const btn = document.createElement('button');
      btn.className = 'ctx-item' + (item.danger ? ' danger' : '') + (item.disabled ? ' disabled' : '');
      btn.innerHTML = `<span class="ctx-icon">${item.icon || ''}</span><span>${item.label}</span>${item.shortcut ? `<span class="ctx-shortcut">${item.shortcut}</span>` : ''}`;
      if (item.disabled && item.title) btn.title = item.title;
      if (!item.disabled) {
        btn.addEventListener('click', () => { close(); item.action && item.action(); });
      }
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    menu.style.left = Math.max(4, Math.min(x, maxX)) + 'px';
    menu.style.top = Math.max(4, Math.min(y, maxY)) + 'px';
    currentMenu = menu;
    setTimeout(() => {
      document.addEventListener('mousedown', onOutside, true);
      document.addEventListener('keydown', onEsc, true);
    }, 0);
    return menu;
  }

  function bind(el, itemsFn) {
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const items = itemsFn(e);
      if (items && items.length) open(e.clientX, e.clientY, items);
    });
  }

  return { open, close, bind };
})();

const RID3Hotkeys = (() => {
  const handlers = [];
  function on(combo, handler, opts) {
    handlers.push({ combo: combo.toLowerCase(), handler, opts: opts || {} });
  }
  function matches(e, combo) {
    const parts = combo.split('+');
    const key = parts.pop();
    const need = { ctrl: parts.includes('ctrl'), shift: parts.includes('shift'), alt: parts.includes('alt') };
    if (need.ctrl !== (e.ctrlKey || e.metaKey)) return false;
    if (need.shift !== e.shiftKey) return false;
    if (need.alt !== e.altKey) return false;
    return e.key.toLowerCase() === key;
  }
  document.addEventListener('keydown', (e) => {
    const inField = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
    for (const h of handlers) {
      if (inField && !h.opts.allowInField) continue;
      if (matches(e, h.combo)) {
        h.handler(e);
      }
    }
  });
  return { on };
})();
