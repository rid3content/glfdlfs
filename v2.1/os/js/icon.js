const RID3Icon = (() => {
  const SVG_PREFIX = 'svg:';

  function isImage(icon) {
    return typeof icon === 'string' && (icon.startsWith('data:image') || /^https?:\/\//i.test(icon));
  }
  function isLibrarySvg(icon) {
    return typeof icon === 'string' && icon.startsWith(SVG_PREFIX);
  }
  function libraryKey(icon) {
    return isLibrarySvg(icon) ? icon.slice(SVG_PREFIX.length) : null;
  }
  function html(icon, alt) {
    if (isImage(icon)) {
      const src = String(icon).replace(/"/g, '&quot;');
      return `<img src="${src}" class="icon-img" draggable="false" alt="${alt ? String(alt).replace(/"/g,'&quot;') : ''}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'📦'}))">`;
    }
    if (isLibrarySvg(icon)) {
      return `<span class="icon-svg-wrap">${RID3IconLibrary.get(libraryKey(icon))}</span>`;
    }
    return icon || '📦';
  }
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  /** Сетка выбора SVG-иконки из встроенной библиотеки (см. js/icon-library.js). */
  function pickerHTML(selectedKey) {
    return `<div class="icon-picker-grid">${RID3IconLibrary.list().map(({ key, svg }) => `
      <button type="button" class="icon-picker-item${key === selectedKey ? ' selected' : ''}" data-icon-key="${key}" title="${key}">
        <span class="icon-svg-wrap">${svg}</span>
      </button>`).join('')}</div>`;
  }

  /** Навешивает обработчик клика на пикер; onSelect(key) вызывается при выборе. */
  function bindPicker(container, onSelect) {
    const grid = container.querySelector('.icon-picker-grid');
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-icon-key]');
      if (!btn) return;
      grid.querySelectorAll('.icon-picker-item').forEach((el) => el.classList.remove('selected'));
      btn.classList.add('selected');
      onSelect(btn.dataset.iconKey);
    });
  }

  return { isImage, isLibrarySvg, libraryKey, html, readFileAsDataUrl, pickerHTML, bindPicker, SVG_PREFIX };
})();
