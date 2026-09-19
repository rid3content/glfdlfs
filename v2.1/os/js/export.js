/**
 * RID3 Export — выгрузка виртуальной ФС и установленных приложений в ZIP.
 */
const RID3Export = (() => {

  function addFolderToZip(zip, node) {
    Object.values(node.children).forEach(child => {
      if (child.type === 'folder') {
        addFolderToZip(zip.folder(child.name), child);
      } else if (child.encoding === 'dataurl') {
        const base64 = String(child.content || '').split(',')[1] || '';
        zip.file(child.name, base64, { base64: true });
      } else {
        zip.file(child.name, child.content || '');
      }
    });
  }

  async function downloadZip() {
    if (typeof JSZip === 'undefined') {
      RID3OS.error('Экспорт недоступен', 'Библиотека JSZip не найдена (lib/jszip.min.js). Проверьте, что папка lib скопирована рядом с index.html.');
      return;
    }
    const zip = new JSZip();

    const filesFolder = zip.folder('Файлы');
    addFolderToZip(filesFolder, RID3FS.getRoot());

    const appsFolder = zip.folder('Приложения');
    Object.values(RID3Apps.installed).forEach(app => {
      const folder = appsFolder.folder(sanitize(app.name));
      folder.file(sanitize(app.name) + RID3Manifest.EXT, RID3Manifest.serialize({
        app: app.name, version: app.version, icon: RID3Icon.isImage(app.icon) ? '📦' : app.icon, type: app.type,
        entry: app.entry, files: Object.keys(app.files), window: app.window,
        permissions: app.permissions || [], resources: app.resources
      }));
      Object.entries(app.files).forEach(([name, content]) => folder.file(name, content));
    });

    zip.file('настройки.json', JSON.stringify(JSON.parse(localStorage.getItem('rid3_settings_v1') || '{}'), null, 2));
    zip.file('производительность.json', JSON.stringify({ totalMemoryMB: RID3Resources.getTotal() }, null, 2));
    zip.file('О экспорте.txt',
      'Экспорт данных RID3 OS.\n\n' +
      '— «Файлы» — ваша виртуальная файловая система.\n' +
      '— «Приложения» — установленные .rva-приложения, каждое в своей папке вместе с исходным .rva.\n' +
      '— «настройки.json» — параметры оформления и анимации.\n' +
      '— «производительность.json» — лимит виртуальной памяти системы.\n\n' +
      'Чтобы переустановить приложение в другой копии RID3 OS, откройте «Установить .rva» и выберите файл .rva вместе с остальными файлами приложения из его папки.'
    );

    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rid3-export-' + new Date().toISOString().slice(0, 10) + '.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    RID3OS.toast('Архив сформирован и загружается');
  }

  function sanitize(name) {
    return String(name).replace(/[\\/:*?"<>|]/g, '_').trim() || 'app';
  }

  return { downloadZip };
})();
