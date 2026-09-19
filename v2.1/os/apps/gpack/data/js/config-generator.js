// ============================================================================
// config-generator.js
// Логика рабочей страницы gPST: выбор технологии → динамическая форма →
// генерация конфига → подсветка/копирование/скачивание → отправка в БД →
// подсказки ИИ-помощника (если включён).
//
// Чтобы добавить новую технологию, достаточно добавить запись в SCHEMAS —
// остальной код (форма, генерация, экспорт) отработает автоматически.
// ============================================================================

import { saveConfigRequest } from "./db-api.js";
import { initAiAssistant } from "./ai-assistant.js";

// --------------------------------------------------------------------------
// 1. Схемы технологий
// --------------------------------------------------------------------------

const SCHEMAS = {
  postgresql: {
    label: "PostgreSQL",
    icon: "icon-db",
    filename: "postgresql.conf",
    fields: [
      { key: "port", label: "Порт", type: "number", default: "5432" },
      { key: "max_connections", label: "Максимум соединений", type: "number", default: "100" },
      { key: "shared_buffers", label: "shared_buffers", type: "text", default: "256MB", hint: "Обычно 25% ОЗУ" },
      { key: "work_mem", label: "work_mem", type: "text", default: "4MB" },
      { key: "listen_addresses", label: "listen_addresses", type: "text", default: "*" },
      { key: "log_min_duration", label: "log_min_duration_statement (мс)", type: "number", default: "250" },
      { key: "ssl", label: "Включить SSL", type: "checkbox", default: false },
    ],
    generate(f) {
      return [
        "# postgresql.conf",
        "# Сгенерировано в gpack gPST",
        "",
        `listen_addresses = '${f.listen_addresses}'`,
        `port = ${f.port}`,
        `max_connections = ${f.max_connections}`,
        "",
        "# Память",
        `shared_buffers = '${f.shared_buffers}'`,
        `work_mem = '${f.work_mem}'`,
        "",
        "# Логирование",
        `log_min_duration_statement = ${f.log_min_duration}`,
        "",
        "# Безопасность",
        `ssl = ${f.ssl ? "on" : "off"}`,
      ].join("\n");
    },
  },

  redis: {
    label: "Redis",
    icon: "icon-layers",
    filename: "redis.conf",
    fields: [
      { key: "port", label: "Порт", type: "number", default: "6379" },
      { key: "bind", label: "bind", type: "text", default: "127.0.0.1" },
      { key: "maxmemory", label: "maxmemory", type: "text", default: "256mb" },
      {
        key: "maxmemory_policy",
        label: "maxmemory-policy",
        type: "select",
        default: "allkeys-lru",
        options: ["noeviction", "allkeys-lru", "volatile-lru", "allkeys-random", "volatile-ttl"],
      },
      { key: "requirepass", label: "Пароль (requirepass)", type: "password", default: "" },
      { key: "appendonly", label: "AOF-персистентность", type: "checkbox", default: true },
      { key: "timeout", label: "timeout (сек)", type: "number", default: "0" },
    ],
    generate(f) {
      const lines = [
        "# redis.conf",
        "# Сгенерировано в gpack gPST",
        "",
        `bind ${f.bind}`,
        `port ${f.port}`,
        `timeout ${f.timeout}`,
        "",
        `maxmemory ${f.maxmemory}`,
        `maxmemory-policy ${f.maxmemory_policy}`,
        "",
        `appendonly ${f.appendonly ? "yes" : "no"}`,
      ];
      if (f.requirepass) {
        lines.push("", `requirepass ${f.requirepass}`);
      }
      return lines.join("\n");
    },
  },

  nginx: {
    label: "Nginx",
    icon: "icon-server",
    filename: "nginx.conf",
    fields: [
      { key: "server_name", label: "server_name", type: "text", default: "example.com" },
      { key: "listen", label: "listen", type: "text", default: "80" },
      { key: "root", label: "root", type: "text", default: "/var/www/html" },
      { key: "proxy_pass", label: "proxy_pass (если reverse proxy)", type: "text", default: "" },
      { key: "client_max_body_size", label: "client_max_body_size", type: "text", default: "10M" },
      { key: "gzip", label: "Включить gzip", type: "checkbox", default: true },
      { key: "ssl", label: "Включить SSL (443)", type: "checkbox", default: false },
    ],
    generate(f) {
      const location = f.proxy_pass
        ? [
            "    location / {",
            `        proxy_pass ${f.proxy_pass};`,
            "        proxy_set_header Host $host;",
            "        proxy_set_header X-Real-IP $remote_addr;",
            "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
            "        proxy_set_header X-Forwarded-Proto $scheme;",
            "    }",
          ].join("\n")
        : [
            "    location / {",
            "        try_files $uri $uri/ =404;",
            "    }",
          ].join("\n");

      return [
        "# nginx.conf",
        "# Сгенерировано в gpack gPST",
        "",
        "server {",
        `    listen ${f.listen}${f.ssl ? " ssl" : ""};`,
        `    server_name ${f.server_name};`,
        `    root ${f.root};`,
        `    client_max_body_size ${f.client_max_body_size};`,
        f.gzip ? "    gzip on;" : "    gzip off;",
        "",
        location,
        "}",
      ].join("\n");
    },
  },

  docker: {
    label: "Docker",
    icon: "icon-box",
    filename: "docker-compose.yml",
    fields: [
      { key: "service_name", label: "Имя сервиса", type: "text", default: "app" },
      { key: "image", label: "Образ", type: "text", default: "node:20-alpine" },
      { key: "port_host", label: "Порт (хост)", type: "number", default: "3000" },
      { key: "port_container", label: "Порт (контейнер)", type: "number", default: "3000" },
      { key: "env_vars", label: "Переменные окружения (по одной на строку, KEY=VALUE)", type: "textarea", default: "NODE_ENV=production" },
      {
        key: "restart_policy",
        label: "Политика перезапуска",
        type: "select",
        default: "unless-stopped",
        options: ["no", "always", "on-failure", "unless-stopped"],
      },
      { key: "volume", label: "Volume (host:container)", type: "text", default: "./data:/app/data" },
    ],
    generate(f) {
      const envLines = f.env_vars
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `      - ${l}`)
        .join("\n");

      return [
        "# docker-compose.yml",
        "# Сгенерировано в gpack gPST",
        "",
        "version: \"3.9\"",
        "services:",
        `  ${f.service_name}:`,
        `    image: ${f.image}`,
        "    restart: " + f.restart_policy,
        "    ports:",
        `      - "${f.port_host}:${f.port_container}"`,
        "    environment:",
        envLines || "      []",
        "    volumes:",
        `      - "${f.volume}"`,
      ].join("\n");
    },
  },

  yaml: {
    label: "YAML",
    icon: "icon-code",
    filename: "config.yml",
    fields: [
      { key: "app_name", label: "Имя приложения", type: "text", default: "gpack-service" },
      { key: "environment", label: "Окружение", type: "select", default: "production", options: ["development", "staging", "production"] },
      { key: "port", label: "Порт", type: "number", default: "8080" },
      { key: "debug", label: "Debug-режим", type: "checkbox", default: false },
      { key: "extra_keys", label: "Доп. пары ключ: значение (по одной на строку)", type: "textarea", default: "log_level: info\nregion: eu-central" },
    ],
    generate(f) {
      const extra = f.extra_keys
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join("\n");

      return [
        "# config.yml",
        "# Сгенерировано в gpack gPST",
        "",
        `app_name: ${f.app_name}`,
        `environment: ${f.environment}`,
        `port: ${f.port}`,
        `debug: ${f.debug ? "true" : "false"}`,
        extra,
      ]
        .filter(Boolean)
        .join("\n");
    },
  },

  json: {
    label: "JSON",
    icon: "icon-braces",
    filename: "config.json",
    fields: [
      { key: "app_name", label: "Имя приложения", type: "text", default: "gpack-service" },
      { key: "version", label: "Версия", type: "text", default: "1.0.0" },
      { key: "port", label: "Порт", type: "number", default: "8080" },
      { key: "environment", label: "Окружение", type: "select", default: "production", options: ["development", "staging", "production"] },
      { key: "debug", label: "Debug-режим", type: "checkbox", default: false },
    ],
    generate(f) {
      const obj = {
        app_name: f.app_name,
        version: f.version,
        port: Number(f.port),
        environment: f.environment,
        debug: Boolean(f.debug),
      };
      return JSON.stringify(obj, null, 2);
    },
  },
};

// --------------------------------------------------------------------------
// 2. DOM-ссылки
// --------------------------------------------------------------------------

const els = {
  techGrid: document.getElementById("techGrid"),
  form: document.getElementById("dynamicForm"),
  formEmpty: document.getElementById("formEmpty"),
  generateBtn: document.getElementById("generateBtn"),
  editorTabLabel: document.getElementById("editorTabLabel"),
  editorLines: document.getElementById("editorLines"),
  editorCode: document.getElementById("editorCode"),
  editorPlaceholder: document.getElementById("editorPlaceholder"),
  editorStatus: document.getElementById("editorStatus"),
  copyBtn: document.getElementById("copyBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  badgeAnim: document.getElementById("badgeAnim"),
  toast: document.getElementById("toast"),
  toastText: document.getElementById("toastText"),
  syncList: document.getElementById("syncList"),
  aiPanel: document.getElementById("aiPanel"),
  aiList: document.getElementById("aiList"),
  aiStatus: document.getElementById("aiStatus"),
};

let currentTech = null;
let currentConfigText = "";

// --------------------------------------------------------------------------
// 3. Рендер сетки технологий
// --------------------------------------------------------------------------

function renderTechGrid() {
  els.techGrid.innerHTML = "";
  Object.entries(SCHEMAS).forEach(([id, schema], index) => {
    const wrap = document.createElement("div");
    wrap.className = "tech-option";
    wrap.innerHTML = `
      <input type="radio" name="technology" id="tech-${id}" value="${id}" ${index === 0 ? "checked" : ""} />
      <label for="tech-${id}">
        <svg class="icon"><use href="#${schema.icon}"></use></svg>
        <span>${schema.label}</span>
      </label>
    `;
    els.techGrid.appendChild(wrap);
  });

  els.techGrid.querySelectorAll('input[name="technology"]').forEach((input) => {
    input.addEventListener("change", (e) => selectTechnology(e.target.value));
  });
}

// --------------------------------------------------------------------------
// 4. Рендер динамической формы
// --------------------------------------------------------------------------

function renderField(field) {
  const wrap = document.createElement("div");

  if (field.type === "checkbox") {
    wrap.className = "field field--checkbox";
    wrap.innerHTML = `
      <input type="checkbox" id="f-${field.key}" name="${field.key}" ${field.default ? "checked" : ""} />
      <label for="f-${field.key}">${field.label}</label>
    `;
    return wrap;
  }

  wrap.className = "field";
  const labelHtml = `<label for="f-${field.key}">${field.label}</label>`;
  const hintHtml = field.hint ? `<p class="field__hint">${field.hint}</p>` : "";

  if (field.type === "select") {
    const options = field.options
      .map((opt) => `<option value="${opt}" ${opt === field.default ? "selected" : ""}>${opt}</option>`)
      .join("");
    wrap.innerHTML = `${labelHtml}<select id="f-${field.key}" name="${field.key}">${options}</select>${hintHtml}`;
  } else if (field.type === "textarea") {
    wrap.innerHTML = `${labelHtml}<textarea id="f-${field.key}" name="${field.key}">${field.default || ""}</textarea>${hintHtml}`;
  } else {
    const type = field.type || "text";
    wrap.innerHTML = `${labelHtml}<input type="${type}" id="f-${field.key}" name="${field.key}" value="${field.default ?? ""}" />${hintHtml}`;
  }

  return wrap;
}

function renderForm(techId) {
  const schema = SCHEMAS[techId];
  els.form.innerHTML = "";
  els.formEmpty.hidden = true;

  schema.fields.forEach((field) => {
    els.form.appendChild(renderField(field));
  });
}

function collectFieldValues(techId) {
  const schema = SCHEMAS[techId];
  const values = {};
  schema.fields.forEach((field) => {
    const el = document.getElementById(`f-${field.key}`);
    if (!el) return;
    values[field.key] = field.type === "checkbox" ? el.checked : el.value;
  });
  return values;
}

function applyAiValue(fieldKey, value) {
  const el = document.getElementById(`f-${fieldKey}`);
  if (!el) return;
  if (el.type === "checkbox") {
    el.checked = value === "true" || value === true;
  } else {
    el.value = value;
  }
  el.style.borderColor = "var(--cyan)";
  window.setTimeout(() => {
    el.style.borderColor = "";
  }, 900);
}

// --------------------------------------------------------------------------
// 5. Подсветка синтаксиса (лёгкая, без внешних зависимостей)
// --------------------------------------------------------------------------

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function highlight(text, techId) {
  const escaped = escapeHtml(text);
  const lines = escaped.split("\n");

  return lines
    .map((line) => {
      if (/^\s*#/.test(line)) {
        return `<span class="tok-com">${line}</span>`;
      }
      if (techId === "json") {
        return line
          .replace(/"(.*?)"(\s*:)/g, '<span class="tok-key">"$1"</span>$2')
          .replace(/:\s*"(.*?)"/g, ': <span class="tok-str">"$1"</span>')
          .replace(/([{}\[\],])/g, '<span class="tok-punc">$1</span>');
      }
      // yaml / conf-подобные форматы: "key: value" или "key value" или "key = value"
      const kv = line.match(/^(\s*[\w.\-]+)(\s*[:=]\s*)(.*)$/);
      if (kv) {
        const [, key, sep, value] = kv;
        return `<span class="tok-key">${key}</span>${sep}<span class="tok-str">${value}</span>`;
      }
      return line;
    })
    .join("\n");
}

function renderLineNumbers(text) {
  const count = text.split("\n").length;
  return Array.from({ length: count }, (_, i) => i + 1).join("\n");
}

// --------------------------------------------------------------------------
// 6. Основной поток: выбор технологии → генерация → экспорт → БД
// --------------------------------------------------------------------------

let ai = null;

function selectTechnology(techId) {
  currentTech = techId;
  renderForm(techId);
  resetEditor();
  if (ai) ai.setTechnology(techId);
}

function resetEditor() {
  currentConfigText = "";
  els.editorCode.hidden = true;
  els.editorLines.hidden = true;
  els.editorPlaceholder.hidden = false;
  els.editorTabLabel.textContent = SCHEMAS[currentTech]?.filename || "config";
  els.editorStatus.classList.remove("is-saved");
  els.editorStatus.querySelector(".status-text").textContent = "Ожидание генерации";
  els.copyBtn.disabled = true;
  els.downloadBtn.disabled = true;
}

async function handleGenerate() {
  if (!currentTech) return;
  const schema = SCHEMAS[currentTech];
  const values = collectFieldValues(currentTech);
  const text = schema.generate(values);

  currentConfigText = text;
  els.editorTabLabel.textContent = schema.filename;
  els.editorPlaceholder.hidden = true;
  els.editorLines.hidden = false;
  els.editorCode.hidden = false;
  els.editorLines.textContent = renderLineNumbers(text);
  els.editorCode.innerHTML = highlight(text, currentTech);
  els.copyBtn.disabled = false;
  els.downloadBtn.disabled = false;
  els.editorStatus.querySelector(".status-text").textContent = "Сгенерировано локально";
  els.editorStatus.classList.remove("is-saved");

  playBadge();

  // Отправка запроса пользователя и итогового конфига в БД (заглушка API).
  const result = await saveConfigRequest({
    technology: currentTech,
    fields: values,
    generatedConfig: text,
    filename: schema.filename,
  });

  logSync(result, schema.label);

  if (result.ok) {
    els.editorStatus.classList.add("is-saved");
    els.editorStatus.querySelector(".status-text").textContent = "Сохранено в БД";
  }
}

function playBadge() {
  els.badgeAnim.classList.add("is-visible");
  const video = els.badgeAnim.querySelector("video");
  if (video) {
    video.currentTime = 0;
    video.play().catch(() => {});
  }
  window.setTimeout(() => {
    els.badgeAnim.classList.remove("is-visible");
  }, 2200);
}

function logSync(result, techLabel) {
  const empty = els.syncList.querySelector(".sync-log__empty");
  if (empty) empty.remove();

  const item = document.createElement("li");
  const time = new Date().toLocaleTimeString("ru-RU");
  const iconId = result.ok ? "icon-check" : "icon-info";
  item.innerHTML = `
    <svg class="icon"><use href="#${iconId}"></use></svg>
    <span>${time} — ${techLabel}: ${result.ok ? `запрос и конфиг записаны в БД (id: ${result.id})` : "запись в БД отложена (схема ещё не подключена)"}</span>
  `;
  els.syncList.prepend(item);
}

async function handleCopy() {
  if (!currentConfigText) return;
  try {
    await navigator.clipboard.writeText(currentConfigText);
    showToast("Конфиг скопирован в буфер обмена");
  } catch (err) {
    showToast("Не удалось скопировать: " + err.message);
  }
}

function handleDownload() {
  if (!currentConfigText || !currentTech) return;
  const schema = SCHEMAS[currentTech];
  const blob = new Blob([currentConfigText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = schema.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Файл ${schema.filename} скачан`);
}

let toastTimer = null;
function showToast(message) {
  els.toastText.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 3200);
}

// --------------------------------------------------------------------------
// 7. Инициализация
// --------------------------------------------------------------------------

function init() {
  renderTechGrid();

  ai = initAiAssistant({
    panelEl: els.aiPanel,
    listEl: els.aiList,
    statusEl: els.aiStatus,
    onApply: applyAiValue,
  });

  const firstTech = Object.keys(SCHEMAS)[0];
  selectTechnology(firstTech);

  els.generateBtn.addEventListener("click", handleGenerate);
  els.copyBtn.addEventListener("click", handleCopy);
  els.downloadBtn.addEventListener("click", handleDownload);
}

document.addEventListener("DOMContentLoaded", init);
