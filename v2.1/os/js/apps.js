/**
 * RID3 Apps — реестр приложений (встроенные системные + установленные .rva).
 * Установленные приложения хранятся в localStorage вместе с содержимым файлов,
 * а их исходные файлы дополнительно зеркалируются в /Система/Приложения/<id>/
 * виртуальной ФС — это и есть «путь к файлам», который можно посмотреть в Файлах
 * или через контекстное меню приложения.
 */
const RID3Apps = (() => {
  const KEY = 'rid3_apps_v2';
  let installed = {};
  // Встроенные приложения, пришедшие из /apps/apps.json (генерируется
  // lib/local/script.py и подтверждается lib/boot-loader.js во время
  // старта ОС — см. RID3OS.boot()). В отличие от `installed`, эти
  // приложения не хранятся в localStorage и не редактируются через UI.
  let staticApps = [];

  /** Вызывается из RID3OS.boot() после успешной проверки реестра. */
  function registerStaticApps(list) {
    staticApps = Array.isArray(list)
      ? list.map((a) => ({ ...a, static: true }))
      : [];
  }

  function load() {
    try { installed = JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (e) { installed = {}; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(installed)); }

  // ---- Системные (встроенные) приложения — не проходят через .rva, живут в самой ОС.
  // Их нельзя удалить, переименовать или изменить конфиг — это защищено на уровне UI.
  const SYSTEM_APPS = [
    { id: 'sys.files', name: 'Файлы', icon: 'svg:files', system: true, window: { width: 760, height: 500, resizable: true } },
    { id: 'sys.settings', name: 'Настройки', icon: 'svg:settings', system: true, window: { width: 680, height: 480, resizable: true } },
    { id: 'sys.ide', name: 'RID3 IDE', icon: 'svg:code', system: true, window: { width: 980, height: 640, resizable: true } },
  ];

  function allApps() {
    return [...SYSTEM_APPS, ...staticApps, ...Object.values(installed)];
  }

  function getApp(id) {
    return SYSTEM_APPS.find(a => a.id === id)
      || staticApps.find(a => a.id === id)
      || installed[id];
  }

  function isSystem(id) {
    return SYSTEM_APPS.some(a => a.id === id);
  }

  /** Путь к файлам приложения в виртуальной ФС (для «Показать путь к файлам»). */
  function filesPath(id) {
    return '/' + RID3FS.appFolderPath(id);
  }

  /**
   * Установка приложения из списка выбранных файлов пользователя.
   * fileList — массив объектов File (из <input type=file multiple> или webkitdirectory).
   * Возвращает Promise<{ok:true, app} | {ok:false, error}>
   */
  async function installFromFiles(fileList) {
    const files = Array.from(fileList);
    const cfgFile = files.find(f => f.name.toLowerCase().endsWith(RID3Manifest.EXT));
    if (!cfgFile) {
      return { ok: false, error: `Среди выбранных файлов не найден файл конфигурации <code>${RID3Manifest.EXT}</code>. Выберите его вместе с файлами приложения.` };
    }

    const cfgText = await readAsText(cfgFile);
    const parsed = RID3Manifest.parse(cfgText);
    if (!parsed.ok) return { ok: false, error: `Ошибка чтения ${RID3Manifest.EXT}: ${parsed.error}` };

    const validation = RID3Manifest.validate(parsed.data);
    if (!validation.ok) return { ok: false, error: validation.error };

    const data = parsed.data;
    const byName = {};
    files.forEach(f => { byName[f.name] = f; });

    const missing = data.files.filter(name => !byName[name]);
    if (missing.length) {
      return {
        ok: false,
        error: `Приложение <b>${escapeHtml(data.app)}</b> ссылается на файлы, которых нет рядом с <code>${cfgFile.name}</code>: ${missing.map(m => `<code>${escapeHtml(m)}</code>`).join(', ')}.`
      };
    }

    const fileContents = {};
    for (const name of data.files) {
      fileContents[name] = await readAsText(byName[name]);
    }

    const id = 'app.' + slug(data.app) + '.' + Date.now().toString(36);
    const app = buildAppRecord(id, data, fileContents, 'rva');
    installed[id] = app;
    save();
    RID3FS.writeAppFiles(id, fileContents);
    RID3FS.createFile(RID3FS.appFolderPath(id) + '/' + slug(data.app) + RID3Manifest.EXT, RID3Manifest.serialize(data));
    return { ok: true, app };
  }

  /**
   * Прямая установка (используется IDE): data — распарсенный .rva,
   * filesContent — { имяФайла: содержимое }.
   */
  function installFromData(data, filesContent) {
    const validation = RID3Manifest.validate(data);
    if (!validation.ok) return { ok: false, error: validation.error };
    const missing = data.files.filter(f => !(f in filesContent));
    if (missing.length) {
      return { ok: false, error: `Не хватает содержимого для файлов: ${missing.map(escapeHtml).join(', ')}.` };
    }
    const id = 'app.' + slug(data.app) + '.' + Date.now().toString(36);
    const app = buildAppRecord(id, data, filesContent, 'ide');
    installed[id] = app;
    save();
    RID3FS.writeAppFiles(id, filesContent);
    RID3FS.createFile(RID3FS.appFolderPath(id) + '/' + slug(data.app) + RID3Manifest.EXT, RID3Manifest.serialize(data));
    return { ok: true, app };
  }

  function buildAppRecord(id, data, filesContent, source) {
    return {
      id,
      name: data.app,
      icon: data.icon || '📦',
      version: data.version || '1.0',
      type: data.type,
      entry: data.entry,
      files: filesContent,
      permissions: Array.isArray(data.permissions) ? data.permissions.slice() : [],
      resources: { memory: RID3Manifest.getMemory(data) },
      window: {
        width: (data.window && data.window.width) || 480,
        height: (data.window && data.window.height) || 380,
        resizable: data.window ? data.window.resizable !== false : true
      },
      installedAt: Date.now(),
      source
    };
  }

  function uninstall(id) {
    if (isSystem(id) || !installed[id]) return false;
    delete installed[id];
    save();
    RID3FS.removeAppFolder(id);
    return true;
  }

  /** Переименовать приложение (ПКМ → «Переименовать»). Системные — запрещено. */
  function rename(id, newName) {
    if (isSystem(id) || !installed[id] || !newName || !newName.trim()) return false;
    installed[id].name = newName.trim();
    save();
    return true;
  }

  /**
   * Обновить конфиг приложения (иконка, размер окна, права, память и т.д.)
   * patch — частичный объект, например { icon, window: {width,height}, permissions, resources }.
   */
  function updateConfig(id, patch) {
    if (isSystem(id) || !installed[id]) return false;
    const app = installed[id];
    if (patch.icon !== undefined) app.icon = patch.icon;
    if (patch.window) app.window = { ...app.window, ...patch.window };
    if (patch.permissions) app.permissions = patch.permissions.slice();
    if (patch.resources) app.resources = { ...app.resources, ...patch.resources };
    save();
    return true;
  }

  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsText(file);
    });
  }

  function slug(str) {
    return (str || 'app').toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/(^-|-$)/g, '') || 'app';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  load();
  return {
    allApps, getApp, isSystem, filesPath,
    installFromFiles, installFromData, uninstall, rename, updateConfig,
    registerStaticApps,
    SYSTEM_APPS, get installed() { return installed; }
  };
})();
