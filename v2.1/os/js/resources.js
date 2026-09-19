/**
 * RID3 Resources — простая симуляция ограниченной оперативной памяти системы.
 * Каждое установленное .rva-приложение объявляет resources.memory (МБ).
 * Системные приложения (Файлы, Настройки, IDE) в бюджет не считаются — это
 * встроенные компоненты ОС, а не пользовательские программы.
 *
 * Общий объём памяти настраивается в Настройки → Производительность.
 */
const RID3Resources = (() => {
  const KEY = 'rid3_perf_v1';
  const DEFAULTS = { totalMemoryMB: 1024 };

  let state = { ...DEFAULTS };
  let usage = {}; // winId -> { appId, memory }

  function load() {
    try { state = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch (e) { state = { ...DEFAULTS }; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  function getTotal() { return state.totalMemoryMB; }
  function setTotal(mb) { state.totalMemoryMB = Math.max(128, Number(mb) || DEFAULTS.totalMemoryMB); save(); }

  function getUsed() {
    return Object.values(usage).reduce((sum, u) => sum + u.memory, 0);
  }

  function getFree() { return Math.max(0, getTotal() - getUsed()); }

  /** Проверяет, поместится ли приложение с заданным требованием памяти. */
  function canFit(memoryMB) {
    return getUsed() + memoryMB <= getTotal();
  }

  /** Резервирует память за окном (вызывается при успешном запуске). */
  function reserve(winId, appId, memoryMB) {
    usage[winId] = { appId, memory: memoryMB };
  }

  /** Освобождает память (вызывается при закрытии окна приложения). */
  function release(winId) {
    delete usage[winId];
  }

  function runningApps() {
    return Object.values(usage);
  }

  load();
  return { getTotal, setTotal, getUsed, getFree, canFit, reserve, release, runningApps };
})();
