/**
 * RID3 Bridge — RPC-мостик между sandbox-iframe приложения и ОС.
 * Приложение вызывает window.RVA.* внутри своего iframe (см. buildClientScript()).
 * Каждый вызов идёт через MessagePort и на стороне хоста проверяется по правам
 * доступа, объявленным в манифесте .rva (app.permissions).
 */
const RID3Bridge = (() => {

  function need(app, permission) {
    return Array.isArray(app.permissions) && app.permissions.includes(permission);
  }

  function denied(permission) {
    const p = RID3Permissions.get(permission);
    return { error: 'permission_denied', permission, message: `Приложению не разрешено право «${p.name}». Выдайте его в IDE (вкладка «Права») и переустановите приложение.` };
  }

  /** Вызывается сразу после установки app.files, чтобы iframe получил mostik. */
  function attach(iframe, app) {
    iframe.addEventListener('load', () => {
      try {
        const channel = new MessageChannel();
        channel.port1.onmessage = (ev) => handleRequest(app, channel.port1, ev.data);
        iframe.contentWindow.postMessage({ __rva: 'init' }, '*', [channel.port2]);
      } catch (e) { /* iframe уже недоступен — ничего не делаем */ }
    }, { once: true });
  }

  async function handleRequest(app, port, msg) {
    if (!msg || !msg.id || !msg.action) return;
    const reply = (payload) => port.postMessage({ id: msg.id, ...payload });

    try {
      switch (msg.action) {
        case 'time.now': {
          if (!need(app, 'time')) return reply(denied('time'));
          const now = new Date();
          return reply({ result: {
            iso: now.toISOString(),
            timestamp: now.getTime(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locale: 'ru-RU'
          } });
        }
        case 'fs.list': {
          if (!need(app, 'filesystem')) return reply(denied('filesystem'));
          return reply({ result: RID3FS.list(msg.args && msg.args.path || '').map(n => ({ name: n.name, type: n.type })) });
        }
        case 'fs.read': {
          if (!need(app, 'filesystem')) return reply(denied('filesystem'));
          const node = RID3FS.resolve(msg.args && msg.args.path);
          if (!node || node.type !== 'file') return reply({ error: 'not_found', message: 'Файл не найден.' });
          return reply({ result: node.content });
        }
        case 'fs.write': {
          if (!need(app, 'filesystem')) return reply(denied('filesystem'));
          const ok = RID3FS.writeFile(msg.args.path, msg.args.content || '');
          return reply({ result: ok });
        }
        case 'storage.get': {
          if (!need(app, 'storage')) return reply(denied('storage'));
          return reply({ result: RID3FS.appStorageGet(app.id, msg.args && msg.args.key) });
        }
        case 'storage.set': {
          if (!need(app, 'storage')) return reply(denied('storage'));
          RID3FS.appStorageSet(app.id, msg.args.key, msg.args.value);
          return reply({ result: true });
        }
        case 'clipboard.write': {
          if (!need(app, 'clipboard')) return reply(denied('clipboard'));
          try { await navigator.clipboard.writeText(String(msg.args && msg.args.text || '')); return reply({ result: true }); }
          catch (e) { return reply({ error: 'clipboard_failed', message: 'Браузер отклонил доступ к буферу обмена.' }); }
        }
        case 'clipboard.read': {
          if (!need(app, 'clipboard')) return reply(denied('clipboard'));
          try { const text = await navigator.clipboard.readText(); return reply({ result: text }); }
          catch (e) { return reply({ error: 'clipboard_failed', message: 'Браузер отклонил доступ к буферу обмена.' }); }
        }
        case 'notify.show': {
          if (!need(app, 'notifications')) return reply(denied('notifications'));
          RID3OS.toast(`${app.icon || '🔔'} ${app.name}: ${msg.args && msg.args.text || ''}`);
          return reply({ result: true });
        }
        case 'device.info': {
          if (!need(app, 'device_info')) return reply(denied('device_info'));
          return reply({ result: {
            os: 'RID3 OS',
            version: '2.0',
            accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
            screen: { width: window.innerWidth, height: window.innerHeight }
          } });
        }
        case 'apps.list': {
          if (!need(app, 'apps_list')) return reply(denied('apps_list'));
          return reply({ result: RID3Apps.allApps().map(a => ({ id: a.id, name: a.name, icon: a.icon })) });
        }
        case 'net.fetch': {
          if (!need(app, 'network')) return reply(denied('network'));
          try {
            const res = await fetch(msg.args.url);
            const text = await res.text();
            return reply({ result: { status: res.status, body: text.slice(0, 20000) } });
          } catch (e) { return reply({ error: 'network_failed', message: 'Не удалось выполнить сетевой запрос (может быть заблокировано CORS).' }); }
        }
        default:
          return reply({ error: 'unknown_action', message: `Неизвестное действие: ${msg.action}` });
      }
    } catch (e) {
      return reply({ error: 'internal_error', message: String(e && e.message || e) });
    }
  }

  /**
   * Скрипт, который подставляется в начало srcdoc приложения — определяет
   * window.RVA.* как промисифицированные вызовы через MessagePort.
   */
  function buildClientScript() {
    return `
<script>
(function(){
  var port = null, seq = 0, pending = {};
  window.addEventListener('message', function(e){
    if (e.data && e.data.__rva === 'init' && e.ports && e.ports[0]) {
      port = e.ports[0];
      port.onmessage = function(ev){
        var d = ev.data, cb = pending[d.id];
        if (!cb) return;
        delete pending[d.id];
        if (d.error) cb.reject(Object.assign(new Error(d.message||d.error), { code: d.error }));
        else cb.resolve(d.result);
      };
      window.dispatchEvent(new CustomEvent('rva-ready'));
    }
  });
  function call(action, args){
    return new Promise(function(resolve, reject){
      if (!port) return reject(new Error('Мостик RVA ещё не готов — подождите событие rva-ready.'));
      var id = ++seq;
      pending[id] = { resolve: resolve, reject: reject };
      port.postMessage({ id: id, action: action, args: args || {} });
    });
  }
  window.RVA = {
    time: { now: function(){ return call('time.now'); } },
    fs: {
      list: function(path){ return call('fs.list', { path: path }); },
      read: function(path){ return call('fs.read', { path: path }); },
      write: function(path, content){ return call('fs.write', { path: path, content: content }); }
    },
    storage: {
      get: function(key){ return call('storage.get', { key: key }); },
      set: function(key, value){ return call('storage.set', { key: key, value: value }); }
    },
    clipboard: {
      read: function(){ return call('clipboard.read'); },
      write: function(text){ return call('clipboard.write', { text: text }); }
    },
    notify: function(text){ return call('notify.show', { text: text }); },
    device: { info: function(){ return call('device.info'); } },
    apps: { list: function(){ return call('apps.list'); } },
    net: { fetch: function(url){ return call('net.fetch', { url: url }); } }
  };
})();
</script>`;
  }

  return { attach, buildClientScript };
})();
