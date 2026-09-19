/**
 * RID3 FS — виртуальная файловая система поверх localStorage.
 * Дерево: { type:'folder', name, children:{ name: node } }
 *         { type:'file',   name, content, mime, created, modified }
 *
 * Служебная зона /Система/Приложения/<appId>/ используется для:
 *  - хранения исходных файлов установленного .rva-приложения ("путь к файлам");
 *  - личного хранилища приложения (permissions: storage), если оно разрешено.
 * Пользователь видит эту зону в Файлах, но не может редактировать системные части.
 */
const RID3FS = (() => {
  const KEY = 'rid3_fs_v2';
  const APPS_ROOT = 'Система/Приложения';

  function emptyRoot() {
    return { type: 'folder', name: '/', children: {} };
  }

  let root = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      root = raw ? JSON.parse(raw) : migrateOrSeed();
    } catch (e) {
      root = seedDefault();
    }
    save();
  }

  function migrateOrSeed() {
    // Пробуем мягко перенести данные со старой версии ФС (rid3_fs_v1), если есть.
    try {
      const old = localStorage.getItem('rid3_fs_v1');
      if (old) return JSON.parse(old);
    } catch (e) { /* игнорируем */ }
    return seedDefault();
  }

  function seedDefault() {
    const r = emptyRoot();
    r.children['Документы'] = { type: 'folder', name: 'Документы', children: {} };
    r.children['Загрузки'] = { type: 'folder', name: 'Загрузки', children: {} };
    r.children['Документы'].children['README.txt'] = fileNode(
      'README.txt',
      'Добро пожаловать в RID3 OS.\n\nЭто виртуальная файловая система — всё, что вы создаёте здесь, хранится в localStorage вашего браузера и может быть выгружено целиком через Настройки → Система → «Скачать всё как ZIP».'
    );
    r.children['Система'] = { type: 'folder', name: 'Система', system: true, children: {
      'Приложения': { type: 'folder', name: 'Приложения', system: true, children: {} }
    } };
    return r;
  }

  function fileNode(name, content, mime, encoding) {
    const now = Date.now();
    return { type: 'file', name, content: content || '', mime: mime || 'text/plain', encoding: encoding || 'text', created: now, modified: now };
  }

  function isMediaMime(mime) {
    return typeof mime === 'string' && (mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/'));
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(root));
  }

  function splitPath(path) {
    return String(path || '').split('/').filter(Boolean);
  }

  function resolve(path, createFolders) {
    const parts = splitPath(path);
    let node = root;
    for (const part of parts) {
      if (node.type !== 'folder') return null;
      if (!node.children[part]) {
        if (createFolders) node.children[part] = { type: 'folder', name: part, children: {} };
        else return null;
      }
      node = node.children[part];
    }
    return node;
  }

  function resolveParent(path) {
    const parts = splitPath(path);
    const name = parts.pop();
    const parent = parts.length ? resolve(parts.join('/'), true) : root;
    return { parent, name };
  }

  function list(path) {
    const node = path ? resolve(path) : root;
    if (!node || node.type !== 'folder') return [];
    return Object.values(node.children).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, 'ru');
    });
  }

  function exists(path) {
    return !!resolve(path);
  }

  function createFolder(path) {
    const { parent, name } = resolveParent(path);
    if (!parent || parent.children[name]) return false;
    parent.children[name] = { type: 'folder', name, children: {} };
    save();
    return true;
  }

  function createFile(path, content = '', mime = 'text/plain', encoding = 'text') {
    const { parent, name } = resolveParent(path);
    if (!parent || parent.children[name]) return false;
    parent.children[name] = fileNode(name, content, mime, encoding);
    save();
    return true;
  }

  function writeFile(path, content, mime, encoding) {
    const node = resolve(path);
    if (!node || node.type !== 'file') return createFile(path, content, mime, encoding);
    node.content = content;
    if (mime) node.mime = mime;
    if (encoding) node.encoding = encoding;
    node.modified = Date.now();
    save();
    return true;
  }

  function remove(path) {
    const { parent, name } = resolveParent(path);
    if (!parent || !parent.children[name]) return false;
    delete parent.children[name];
    save();
    return true;
  }

  function rename(path, newName) {
    const { parent, name } = resolveParent(path);
    if (!parent || !parent.children[name] || parent.children[newName]) return false;
    const node = parent.children[name];
    node.name = newName;
    delete parent.children[name];
    parent.children[newName] = node;
    save();
    return true;
  }

  function reset() {
    root = seedDefault();
    save();
  }

  function getRoot() { return root; }

  // ---------- Служебная зона приложений ----------
  function appFolderPath(appId) { return APPS_ROOT + '/' + appId; }

  function ensureAppFolder(appId) {
    const path = appFolderPath(appId);
    if (!exists(path)) {
      const { parent, name } = resolveParent(path);
      if (parent) { parent.children[name] = { type: 'folder', name, system: true, children: {} }; save(); }
    }
    return path;
  }

  function writeAppFiles(appId, filesObj) {
    const base = ensureAppFolder(appId);
    const node = resolve(base);
    if (node) node.children = {};
    Object.entries(filesObj).forEach(([name, content]) => {
      createFile(base + '/' + name, content);
    });
    return base;
  }

  function removeAppFolder(appId) {
    remove(appFolderPath(appId));
  }

  // Личное хранилище приложения (для permission "storage") — key/value JSON внутри одного файла.
  function appStorageGet(appId, key) {
    const path = appFolderPath(appId) + '/.storage.json';
    const node = resolve(path);
    if (!node) return null;
    try { return JSON.parse(node.content)[key] ?? null; } catch (e) { return null; }
  }
  function appStorageSet(appId, key, value) {
    const path = appFolderPath(appId) + '/.storage.json';
    let data = {};
    const node = resolve(path);
    if (node) { try { data = JSON.parse(node.content) || {}; } catch (e) { data = {}; } }
    data[key] = value;
    writeFile(path, JSON.stringify(data));
    return true;
  }

  load();

  return {
    list, exists, createFolder, createFile, writeFile, remove, rename, resolve, reset, getRoot, save, isMediaMime,
    appFolderPath, ensureAppFolder, writeAppFiles, removeAppFolder, appStorageGet, appStorageSet, APPS_ROOT
  };
})();
