// ============================================================================
// ai-assistant.js
// При загрузке приложения проверяет флаг ai_enabled в БД. Если включён —
// показывает блок ИИ-помощника, который предлагает автозаполнение сложных
// полей конфига. Пока реальная "накопленная база" не подключена, подсказки
// строятся локальными эвристиками (best practices по каждой технологии) —
// после подключения схемы getAiKnowledgeBase() начнёт возвращать реальные
// данные, и эвристики можно будет заменить.
// ============================================================================

import { getAiEnabledFlag, getAiKnowledgeBase } from "./db-api.js";

const HEURISTICS = {
  postgresql: [
    { field: "max_connections", value: "200", text: "Для сервера среднего размера обычно достаточно 200 соединений." },
    { field: "shared_buffers", value: "512MB", text: "Рекомендуется около 25% доступной оперативной памяти." },
    { field: "work_mem", value: "16MB", text: "Безопасное значение, не приводящее к перерасходу памяти при параллельных запросах." },
  ],
  redis: [
    { field: "maxmemory", value: "512mb", text: "Разумный лимит для инстанса, используемого как кэш." },
    { field: "maxmemory_policy", value: "allkeys-lru", text: "Оптимальная политика вытеснения для кэширующего сценария." },
    { field: "timeout", value: "300", text: "Закрывать неактивные соединения через 5 минут." },
  ],
  nginx: [
    { field: "worker_connections", value: "1024", text: "Стандартное значение для большинства production-серверов." },
    { field: "client_max_body_size", value: "20M", text: "Покрывает загрузку файлов средним пользователем без риска перегрузки." },
    { field: "gzip", value: "on", text: "Сжатие снижает объём трафика для текстовых ответов." },
  ],
  docker: [
    { field: "restart_policy", value: "unless-stopped", text: "Контейнер переживёт перезагрузку хоста, но не будет мешать ручной остановке." },
    { field: "memory_limit", value: "512m", text: "Безопасный лимит для типового сервиса без утечек памяти." },
  ],
  yaml: [
    { field: "indent", value: "2", text: "2 пробела — общепринятый стандарт для YAML." },
  ],
  json: [
    { field: "indent", value: "2", text: "2 пробела читаемы и совместимы с большинством линтеров." },
  ],
};

/**
 * Инициализирует блок ИИ-помощника.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.panelEl       контейнер блока ИИ-помощника
 * @param {HTMLElement} opts.listEl        контейнер для списка подсказок
 * @param {HTMLElement} opts.statusEl      индикатор статуса ("активен")
 * @param {Function} opts.onApply          вызывается при клике "Применить": (fieldName, value) => void
 * @returns {{ setTechnology: (tech: string) => Promise<void>, isEnabled: () => boolean }}
 */
export function initAiAssistant({ panelEl, listEl, statusEl, onApply }) {
  let enabled = false;

  const checkFlag = async () => {
    enabled = await getAiEnabledFlag();
    panelEl.hidden = !enabled;
    if (statusEl) {
      statusEl.textContent = enabled ? "Активен" : "Отключён";
    }
    return enabled;
  };

  const renderSuggestions = (technology) => {
    listEl.innerHTML = "";
    const heuristics = HEURISTICS[technology] || [];

    if (!heuristics.length) {
      listEl.innerHTML = '<p class="ai-panel__desc">Для этой технологии пока нет накопленных подсказок.</p>';
      return;
    }

    heuristics.forEach((item) => {
      const row = document.createElement("div");
      row.className = "ai-suggestion";
      row.innerHTML = `
        <div class="ai-suggestion__text">
          <span class="ai-suggestion__field">${item.field} → ${item.value}</span>
          ${item.text}
        </div>
        <button type="button" class="ai-suggestion__apply">Применить</button>
      `;
      row.querySelector(".ai-suggestion__apply").addEventListener("click", () => {
        onApply(item.field, item.value);
      });
      listEl.appendChild(row);
    });
  };

  const setTechnology = async (technology) => {
    if (!enabled) return;
    // Пытаемся получить реальную накопленную базу, иначе — локальные эвристики.
    const knowledgeBase = await getAiKnowledgeBase(technology);
    if (knowledgeBase) {
      // TODO: когда схема будет готова, здесь нужно преобразовать
      // knowledgeBase в тот же формат, что и HEURISTICS, и отрисовать.
      renderSuggestions(technology);
    } else {
      renderSuggestions(technology);
    }
  };

  checkFlag();

  return {
    setTechnology,
    isEnabled: () => enabled,
  };
}
