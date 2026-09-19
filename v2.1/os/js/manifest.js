/**
 * RID3 Manifest (.rva) — формат конфигурации приложений (не JSON).
 *
 * Пример .rva файла:
 *
 *   # RVA App Config v2
 *   app: RID3 Notes
 *   version: 1.0
 *   icon: 📝
 *   type: html
 *   entry: index.html
 *   files: index.html, style.css
 *   window.width: 480
 *   window.height: 380
 *   window.resizable: true
 *   permissions: time, filesystem, storage
 *   resources.memory: 96
 *
 * Правила:
 *  - строка "ключ: значение"
 *  - строки, начинающиеся с # — комментарии, пропускаются
 *  - пустые строки пропускаются
 *  - ключи с точкой (window.width) образуют вложенный объект
 *  - "files" — список имён файлов через запятую, все должны лежать
 *    рядом с .rva (то есть быть выбраны вместе с ним при установке)
 *  - "permissions" — список идентификаторов прав через запятую (см. RID3Permissions)
 *  - "resources.memory" — заявленный объём ОЗУ в МБ, нужный приложению для запуска
 */
const RID3Manifest = (() => {

  const EXT = '.rva';
  const REQUIRED_KEYS = ['app', 'entry', 'type', 'files'];
  const ALLOWED_TYPES = ['html', 'php'];
  const DEFAULT_MEMORY = 64;

  function parse(text) {
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, error: `Файл ${EXT} пуст или повреждён.` };
    }
    const data = {};
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;

      const sep = line.indexOf(':');
      if (sep === -1) {
        return { ok: false, error: `Строка ${i + 1} не в формате "ключ: значение" → "${line}"` };
      }
      const key = line.slice(0, sep).trim();
      let value = line.slice(sep + 1).trim();
      if (!key) {
        return { ok: false, error: `Пустой ключ на строке ${i + 1}.` };
      }

      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^-?\d+(\.\d+)?$/.test(value)) value = Number(value);

      if (key.includes('.')) {
        const [group, sub] = key.split('.');
        data[group] = data[group] && typeof data[group] === 'object' ? data[group] : {};
        data[group][sub] = value;
      } else {
        data[key] = value;
      }
    }

    if (typeof data.files === 'string') {
      data.files = data.files.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof data.permissions === 'string') {
      data.permissions = data.permissions.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(data.permissions)) data.permissions = [];

    return { ok: true, data };
  }

  function validate(data) {
    const missing = REQUIRED_KEYS.filter(k => !(k in data));
    if (missing.length) {
      return { ok: false, error: `В ${EXT} отсутствуют обязательные поля: ${missing.join(', ')}.` };
    }
    if (!ALLOWED_TYPES.includes(data.type)) {
      return { ok: false, error: `Недопустимый тип приложения "${data.type}". Разрешено: ${ALLOWED_TYPES.join(', ')}.` };
    }
    if (!Array.isArray(data.files) || data.files.length === 0) {
      return { ok: false, error: 'Поле "files" должно содержать хотя бы один файл.' };
    }
    if (!data.files.includes(data.entry)) {
      return { ok: false, error: `Поле "entry" (${data.entry}) должно быть указано и в списке "files".` };
    }
    if (data.permissions && data.permissions.length) {
      const known = RID3Permissions.ALL.map(p => p.id);
      const unknown = data.permissions.filter(p => !known.includes(p));
      if (unknown.length) {
        return { ok: false, error: `Неизвестные права доступа в манифесте: ${unknown.join(', ')}.` };
      }
    }
    const mem = data.resources && data.resources.memory;
    if (mem !== undefined && (typeof mem !== 'number' || mem <= 0)) {
      return { ok: false, error: 'Поле "resources.memory" должно быть положительным числом (МБ).' };
    }
    return { ok: true };
  }

  function getMemory(data) {
    return (data.resources && Number(data.resources.memory)) || DEFAULT_MEMORY;
  }

  function serialize(data) {
    const lines = ['# RVA App Config v2'];
    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const [sub, subVal] of Object.entries(val)) {
          lines.push(`${key}.${sub}: ${subVal}`);
        }
      } else if (Array.isArray(val)) {
        lines.push(`${key}: ${val.join(', ')}`);
      } else {
        lines.push(`${key}: ${val}`);
      }
    }
    return lines.join('\n') + '\n';
  }

  return { parse, validate, serialize, getMemory, EXT, REQUIRED_KEYS, ALLOWED_TYPES, DEFAULT_MEMORY };
})();
