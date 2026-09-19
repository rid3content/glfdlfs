/**
 * RID3 Boot Loader (lib/boot-loader.js)
 * ======================================
 * Отвечает за самый первый, критичный шаг инициализации Web OS —
 * загрузку реестра приложений `/apps/apps.json`, который заранее
 * генерируется офлайн-скриптом `lib/local/script.py`.
 *
 * Контракт:
 *   1. Запрос к /apps/apps.json уходит НЕМЕДЛЕННО при разборе этого
 *      скрипта (до DOMContentLoaded), поэтому тег <script src="lib/boot-loader.js">
 *      должен стоять в <head> или в самом начале <body>, ДО остальных
 *      скриптов ОС и до того, как экран загрузки (#boot-screen) может
 *      быть скрыт.
 *   2. Если ответ на /apps/apps.json НЕ 200, тело не парсится как JSON,
 *      данные не проходят валидацию, либо любой из ресурсов приложений
 *      (entry-файл каждого приложения из реестра) отвечает НЕ 200 —
 *      загрузка полностью останавливается: рисуется чёрный экран
 *      "Critical Boot Error", и остальная ОС дальше не инициализируется.
 *   3. Если всё успешно — экран загрузки может быть скрыт СТРОГО после
 *      этого момента. Готовый список приложений передаётся дальше
 *      контроллеру интерфейса (RID3Apps/RID3OS) через:
 *        - window.RID3BootLoader.ready  → Promise<AppEntry[]>
 *        - событие "rid3:apps-ready"    → CustomEvent.detail = AppEntry[]
 *
 * Ничего в этом файле не зависит от остальных скриптов ОС — при сбое
 * он способен нарисовать критический экран даже если ни один другой
 * скрипт ещё не выполнился.
 */
(function () {
  'use strict';

  // ВАЖНО: пути нельзя резолвить относительно URL страницы — если сайт
  // открыт без завершающего "/" (например, https://host/os вместо
  // https://host/os/, так бывает на Firebase Hosting и подобных
  // статических хостингах), браузер трактует последний сегмент как имя
  // файла, а не папки, и относительные пути "уезжают" на уровень выше
  // (apps/apps.json → https://host/apps/apps.json вместо .../os/apps/apps.json).
  // Поэтому корень проекта вычисляется от URL самого этого скрипта —
  // он гарантированно лежит в <корень проекта>/lib/boot-loader.js.
  const scriptEl = document.currentScript;
  const PROJECT_ROOT_URL = scriptEl && scriptEl.src
    ? new URL('../', scriptEl.src).href
    : new URL('.', document.baseURI).href; // запасной вариант, если скрипт подключён нестандартно

  // ВАЖНО: реестр приложений запрашивается по ЖЁСТКО заданному абсолютному
  // URL, а не по пути, вычисленному относительно скрипта/страницы. На
  // Firebase Hosting относительный путь может резолвиться некорректно
  // (см. комментарий выше про отсутствующий "/"), поэтому здесь всегда
  // используется полный адрес конкретного файла на хостинге.
  const REGISTRY_URL = 'https://gpack-org.web.app/os/apps/apps.json';
  const REQUIRED_APP_FIELDS = ['id', 'name', 'entry', 'files', 'path'];

  /** Ошибка загрузки/валидации реестра с разделёнными title/detail — используется
   *  и для критического экрана при старте, и для тихого reject() при живом reload(). */
  class BootError extends Error {
    constructor(title, detail) {
      super(`${title} ${detail}`.trim());
      this.title = title;
      this.detail = detail;
    }
  }

  /** @type {(value: any) => void} */
  let resolveReady;
  /** @type {(reason: any) => void} */
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // На необработанный reject (если никто не подписался на .ready) не должно
  // сыпаться в консоль лишний unhandledrejection — критический экран уже
  // сам сообщает об ошибке пользователю.
  ready.catch(() => {});

  window.RID3BootLoader = {
    ready,
    REGISTRY_URL,
    PROJECT_ROOT_URL,
    showCriticalError: renderCriticalScreen, // экспортируется на случай ручного вызова из os.js
    /**
     * Заново запрашивает и проверяет /apps/apps.json ПОСЛЕ старта ОС —
     * например, по кнопке «Обновить реестр» в Настройках. В отличие от
     * первичной загрузки, при ошибке НЕ рисует чёрный экран (ОС уже
     * работает) — просто отклоняет промис с { title, detail }, чтобы
     * вызывающий код (см. RID3OS.refreshRegistry) сам показал тост.
     */
    reload: loadRegistry,
  };

  runBoot();

  // ------------------------------------------------------------------

  async function runBoot() {
    try {
      const apps = await loadRegistry();
      resolveReady(apps);
      window.dispatchEvent(new CustomEvent('rid3:apps-ready', { detail: apps }));
    } catch (e) {
      fail(e.title || 'Не удалось загрузить реестр приложений.', e.detail || describeError(e));
    }
  }

  /** Один полный цикл: fetch apps.json → парсинг → валидация схемы → проверка ресурсов. */
  async function loadRegistry() {
    let response;
    try {
      response = await fetch(REGISTRY_URL, { cache: 'no-store' });
    } catch (networkErr) {
      throw new BootError(
        'Не удалось обратиться к реестру приложений.',
        `Сетевая ошибка при запросе ${REGISTRY_URL}: ${describeError(networkErr)}`
      );
    }

    if (response.status !== 200) {
      throw new BootError(
        'Реестр приложений недоступен.',
        `GET ${REGISTRY_URL} → HTTP ${response.status} ${response.statusText || ''}`.trim()
      );
    }

    let registry;
    try {
      registry = await response.json();
    } catch (parseErr) {
      throw new BootError(
        'Реестр приложений повреждён.',
        `${REGISTRY_URL} не является корректным JSON: ${describeError(parseErr)}`
      );
    }

    const apps = Array.isArray(registry) ? registry : registry && registry.apps;
    if (!Array.isArray(apps)) {
      throw new BootError(
        'Реестр приложений имеет неверный формат.',
        `Ожидался массив приложений (или объект с полем "apps"), получено: ${typeof registry}`
      );
    }

    const schemaError = validateApps(apps);
    if (schemaError) {
      throw new BootError('Реестр приложений не прошёл валидацию.', schemaError);
    }

    try {
      return await verifyAppResources(apps);
    } catch (resourceErr) {
      throw new BootError('Не удалось загрузить ресурсы приложений.', describeError(resourceErr));
    }
  }

  /** Базовая проверка структуры каждого приложения в реестре. */
  function validateApps(apps) {
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      if (!app || typeof app !== 'object') {
        return `Элемент реестра #${i} не является объектом.`;
      }
      for (const field of REQUIRED_APP_FIELDS) {
        if (!(field in app) || app[field] === '' || app[field] == null) {
          return `Приложение #${i} (${app.id || '?'}) — отсутствует обязательное поле "${field}".`;
        }
      }
      if (!Array.isArray(app.files) || app.files.length === 0) {
        return `Приложение "${app.id}" — поле "files" должно быть непустым массивом.`;
      }
      if (!app.files.includes(app.entry)) {
        return `Приложение "${app.id}" — "entry" (${app.entry}) отсутствует в списке "files".`;
      }
    }
    return null;
  }

  /**
   * Запрашивает entry-файл каждого приложения (HEAD, с фолбэком на GET,
   * если сервер не поддерживает HEAD) и требует HTTP 200 от каждого.
   * Все запросы идут параллельно; при любом отказе — Promise.all падает,
   * и весь boot немедленно блокируется.
   */
  async function verifyAppResources(apps) {
    await Promise.all(
      apps.map(async (app) => {
        const url = new URL(String(app.entry).replace(/^\/+/, ''), PROJECT_ROOT_URL).href;
        const status = await checkResource(url);
        if (status !== 200) {
          throw new Error(`Приложение "${app.id}": ресурс ${url} ответил HTTP ${status}.`);
        }
      })
    );
    return apps;
  }

  async function checkResource(url) {
    try {
      const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      // Некоторые статические хостинги не реализуют HEAD и возвращают 405 —
      // в этом случае перепроверяем через полноценный GET.
      if (head.status === 405 || head.status === 501) {
        const get = await fetch(url, { method: 'GET', cache: 'no-store' });
        return get.status;
      }
      return head.status;
    } catch (e) {
      throw e;
    }
  }

  function describeError(err) {
    if (err && err.message) return err.message;
    return String(err);
  }

  /**
   * Полностью блокирует загрузку ОС: скрывает штатный #boot-screen
   * (если он уже есть в DOM) и рисует чёрный экран критической ошибки
   * поверх всего остального. Дальнейшая инициализация ОС не запускается,
   * потому что window.RID3BootLoader.ready остаётся в состоянии rejected.
   */
  function fail(title, detail) {
    console.error('[RID3 Boot] Critical Boot Error:', title, detail);
    rejectReady(new Error(title + ' ' + detail));
    renderCriticalScreen(title, detail);
  }

  function renderCriticalScreen(title, detail) {
    const existingBoot = document.getElementById('boot-screen');
    if (existingBoot) existingBoot.style.display = 'none';
    const desktop = document.getElementById('desktop');
    if (desktop) desktop.classList.add('hidden');

    const overlay = document.createElement('div');
    overlay.id = 'rid3-critical-boot-error';
    overlay.setAttribute('role', 'alert');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '999999',
      background: '#000',
      color: '#ff4d4d',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '32px',
      fontFamily: "'JetBrains Mono', ui-monospace, Consolas, monospace",
    });

    const heading = document.createElement('div');
    heading.textContent = 'CRITICAL BOOT ERROR';
    Object.assign(heading.style, {
      fontSize: '22px',
      letterSpacing: '0.12em',
      marginBottom: '18px',
      color: '#ff4d4d',
    });

    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    Object.assign(titleEl.style, {
      fontSize: '16px',
      color: '#f5f5f5',
      marginBottom: '10px',
      maxWidth: '640px',
    });

    const detailEl = document.createElement('div');
    detailEl.textContent = detail;
    Object.assign(detailEl.style, {
      fontSize: '13px',
      color: '#999',
      maxWidth: '640px',
      lineHeight: '1.5',
    });

    const hint = document.createElement('div');
    hint.textContent = 'RID3 OS не может быть загружена: реестр приложений недоступен или повреждён.';
    Object.assign(hint.style, {
      marginTop: '24px',
      fontSize: '12px',
      color: '#555',
    });

    overlay.appendChild(heading);
    overlay.appendChild(titleEl);
    overlay.appendChild(detailEl);
    overlay.appendChild(hint);

    const mount = () => document.body.appendChild(overlay);
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount, { once: true });
  }
})();
