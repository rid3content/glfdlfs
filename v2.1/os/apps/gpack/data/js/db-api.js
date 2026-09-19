// ============================================================================
// db-api.js
// Заглушки записи/чтения в БД (Firestore). Реальную схему коллекций
// подключит заказчик — здесь используются условные, понятные названия
// коллекций/полей, которые легко переименовать под финальную схему:
//
//   collection "config_requests"
//     { technology, fields, generatedConfig, filename, createdAt }
//
//   collection "settings", doc "ai"
//     { ai_enabled: boolean }
//
// Все функции работают "оптимистично": если Firestore недоступен или схема
// ещё не создана, приложение не падает — просто пишет предупреждение в
// консоль и продолжает работать локально.
// ============================================================================

import { db, collection, addDoc, doc, getDoc, serverTimestamp } from "./firebase-init.js";

const REQUESTS_COLLECTION = "config_requests";
const SETTINGS_COLLECTION = "settings";
const AI_FLAG_DOC = "ai";

/**
 * Отправляет в БД сам запрос пользователя и итоговый сгенерированный конфиг.
 * Используется в будущем как обучающий датасет для ИИ-скрипта автозаполнения.
 *
 * @param {Object} payload
 * @param {string} payload.technology   выбранная технология (postgresql, nginx, ...)
 * @param {Object} payload.fields       значения полей формы, которые ввёл пользователь
 * @param {string} payload.generatedConfig  итоговый текст конфига
 * @param {string} payload.filename     имя файла с расширением
 * @returns {Promise<{ok: boolean, id?: string, error?: string}>}
 */
export async function saveConfigRequest(payload) {
  try {
    const ref = await addDoc(collection(db, REQUESTS_COLLECTION), {
      technology: payload.technology,
      fields: payload.fields,
      generatedConfig: payload.generatedConfig,
      filename: payload.filename,
      createdAt: serverTimestamp(),
      source: "gpack-gpst-web",
    });
    return { ok: true, id: ref.id };
  } catch (err) {
    // Схема ещё не подключена / нет доступа — не блокируем пользователя.
    console.warn("[gpack][db-api] Не удалось записать в БД (это ожидаемо, пока схема не подключена):", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Читает флаг ai_enabled из настроек. Если документ/коллекция ещё не
 * созданы в БД, по умолчанию считаем ИИ-блок выключенным.
 *
 * @returns {Promise<boolean>}
 */
export async function getAiEnabledFlag() {
  try {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, AI_FLAG_DOC));
    if (snap.exists()) {
      const data = snap.data();
      return Boolean(data.ai_enabled);
    }
    return false;
  } catch (err) {
    console.warn("[gpack][db-api] Не удалось прочитать флаг ai_enabled (это ожидаемо, пока схема не подключена):", err.message);
    return false;
  }
}

/**
 * Заглушка получения "накопленной базы" для подсказок ИИ-помощника —
 * например, самых частых значений полей по каждой технологии. Пока схема
 * не подключена, возвращает null, и ai-assistant.js использует локальные
 * эвристики.
 *
 * @param {string} technology
 * @returns {Promise<Object|null>}
 */
export async function getAiKnowledgeBase(technology) {
  try {
    // TODO: заменить на реальный запрос, например агрегирующую коллекцию
    // "ai_knowledge_base/{technology}", которую заказчик наполнит позже.
    void technology;
    return null;
  } catch (err) {
    console.warn("[gpack][db-api] Не удалось получить базу для ИИ:", err.message);
    return null;
  }
}
