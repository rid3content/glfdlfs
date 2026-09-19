const CACHE = 'rid3-os-v3'; // версия увеличена: сбрасывает старые закешированные
                             // копии lib/boot-loader.js / apps/apps.json, которые
                             // могли "залипнуть" в браузере с прошлых деплоев.
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/desktop.css',
  './css/windows.css',
  './css/apps.css',
  './css/animations.css',
  './js/fs.js',
  './js/permissions.js',
  './js/manifest.js',
  './js/resources.js',
  './js/icon.js',
  './js/contextmenu.js',
  './js/bridge.js',
  './js/apps.js',
  './js/windows.js',
  './js/settings.js',
  './js/filemanager.js',
  './js/ide.js',
  './js/export.js',
  './js/os.js',
  './lib/jszip.min.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Эти пути НИКОГДА не должны отдаваться из кеша Service Worker: реестр
// приложений и сам загрузчик должны каждый раз реально проверять сервер,
// иначе "Critical Boot Error" перестаёт что-либо гарантировать — он будет
// проверять устаревшую закешированную копию, а не реальное состояние сайта.
function isNetworkOnly(url) {
  return /\/lib\/boot-loader\.js(\?|$)/.test(url) || /\/apps\//.test(url);
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  if (isNetworkOnly(e.request.url)) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res && res.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
