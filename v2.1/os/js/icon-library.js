/**
 * RID3 Icon Library — Полная векторная библиотека иконок (>1000 иконок).
 *
 * Каждая иконка — самостоятельный <svg> (viewBox 0 0 24 24, stroke currentColor).
 * Поддерживает методы:
 *  - RID3IconLibrary.get('name')         => возвращает SVG строку или фолбэк 'app'
 *  - RID3IconLibrary.has('name')         => boolean
 *  - RID3IconLibrary.list()              => [{ key, label, svg }, ...]
 *  - RID3IconLibrary.search('query')     => [{ key, label, svg }, ...]
 *  - RID3IconLibrary.render('name', {})  => SVG с кастомными атрибутами
 *  - RID3IconLibrary.KEYS                => массив всех доступных ключей
 *  - RID3IconLibrary.COUNT               => общее количество иконок (1000+)
 */
const RID3IconLibrary = (() => {
  const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const svg = (label, body) => `<svg viewBox="0 0 24 24" ${S} role="img" aria-label="${label}">${body}</svg>`;

  const ICONS = {};

  // 1. Базовые векторные иконки (Core Hand-crafted System & UI Icons)
  const coreIcons = {
    // Система и макеты
    'app': svg('Приложение', '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
    'settings': svg('Настройки', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.03 4.2l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.29 1.04 1.56h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.27.64.88 1.04 1.56 1.04H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>'),
    'sliders': svg('Фильтры', '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'),
    'calculator': svg('Калькулятор', '<rect x="5" y="3" width="14" height="18" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><circle cx="8" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="16" r=".9" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r=".9" fill="currentColor" stroke="none"/>'),
    'browser': svg('Браузер', '<circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9s1.3-6.4 3.8-9Z"/>'),
    'terminal': svg('Терминал', '<rect x="3" y="4" width="18" height="16" rx="2"/><polyline points="7 9 11 12.5 7 16"/><line x1="12" y1="16" x2="17" y2="16"/>'),
    'code': svg('Код', '<polyline points="9 8 4 12 9 16"/><polyline points="15 8 20 12 15 16"/><line x1="13.5" y1="5" x2="10.5" y2="19"/>'),
    'database': svg('База данных', '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>'),
    'server': svg('Сервер', '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>'),
    'cpu': svg('Процессор', '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>'),
    'cloud': svg('Облако', '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>'),
    'cloud-rain': svg('Облако с дождем', '<path d="M16 13a5 5 0 0 0-9-3 6 6 0 0 0-5.6 7h15.6a4.5 4.5 0 0 0-1-4z"/><line x1="8" y1="15" x2="8" y2="21"/><line x1="12" y1="17" x2="12" y2="23"/><line x1="16" y1="15" x2="16" y2="21"/>'),
    'cloud-lightning': svg('Облако с молнией', '<path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 15 17 11 23"/>'),
    'sun': svg('Солнце', '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'),
    'moon': svg('Луна', '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),

    // Связь и Почта
    'mail': svg('Почта', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>'),
    'chat': svg('Чат', '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    'message-circle': svg('Сообщение', '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'),
    'phone': svg('Телефон', '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),
    'phone-call': svg('Входящий звонок', '<path d="M150 0"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M18 2a4 4 0 0 1 4 4"/><path d="M15 2a7 7 0 0 1 7 7"/>'),
    'mic': svg('Микрофон', '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>'),
    'mic-off': svg('Микрофон выкл', '<line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>'),
    'bell': svg('Уведомление', '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
    'bell-off': svg('Без звука', '<path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/>'),

    // Медиа и Музыка
    'camera': svg('Камера', '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/>'),
    'video': svg('Видео', '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>'),
    'music': svg('Музыка', '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    'film': svg('Фильм', '<rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>'),
    'headphones': svg('Наушники', '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>'),
    'speaker': svg('Динамик', '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="14" r="4"/><line x1="12" y1="6" x2="12.01" y2="6"/>'),
    'play': svg('Воспроизведение', '<polygon points="5 3 19 12 5 21 5 3"/>'),
    'pause': svg('Пауза', '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'),
    'square': svg('Стоп', '<rect x="3" y="3" width="18" height="18" rx="2"/>'),
    'circle': svg('Круг', '<circle cx="12" cy="12" r="10"/>'),

    // Элементы управления и действия
    'search': svg('Поиск', '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
    'zoom-in': svg('Увеличить', '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>'),
    'zoom-out': svg('Уменьшить', '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>'),
    'edit': svg('Редактировать', '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'),
    'trash': svg('Корзина', '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    'copy': svg('Копировать', '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    'download': svg('Скачать', '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    'upload': svg('Загрузить', '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    'share': svg('Поделиться', '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>'),
    'link': svg('Ссылка', '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    'unlink': svg('Разрыв ссылки', '<path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71"/><line x1="8" y1="2" x2="22" y2="16"/>'),
    'lock': svg('Замок', '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    'unlock': svg('Открытый замок', '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'),
    'key': svg('Ключ', '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>'),

    // Пользователи и Профиль
    'user': svg('Пользователь', '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    'users': svg('Группа пользователей', '<path d="M17 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M1 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/>'),
    'user-check': svg('Проверенный пользователь', '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>'),
    'user-x': svg('Заблокированный пользователь', '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="22" y2="12"/><line x1="22" y1="8" x2="18" y2="12"/>'),
    'heart': svg('Сердце', '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'),
    'star': svg('Звезда', '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
    'smile': svg('Улыбка', '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>'),
    'frown': svg('Грусть', '<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>'),

    // Коммерция, Магазин и Финансы
    'shopping-cart': svg('Корзина покупок', '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
    'shopping-bag': svg('Сумка для покупок', '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
    'credit-card': svg('Банковская карта', '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
    'dollar-sign': svg('Доллар', '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    'euro-sign': svg('Евро', '<path d="M19 6a7.7 7.7 0 0 0-11 0 8 8 0 0 0 0 12 7.7 7.7 0 0 0 11 0"/><line x1="4" y1="10" x2="14" y2="10"/><line x1="4" y1="14" x2="14" y2="14"/>'),
    'gift': svg('Подарок', '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>'),

    // Инструменты и Офис
    'briefcase': svg('Портфель', '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
    'paperclip': svg('Скрепка', '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'),
    'printer': svg('Принтер', '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    'anchor': svg('Якорь', '<circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>'),
    'compass': svg('Компас', '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>'),
    'map': svg('Карта', '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>'),
    'map-pin': svg('Метка карты', '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
    'globe': svg('Глобус', '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
    'shield': svg('Щит', '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),

    // Девайсы и железо
    'monitor': svg('Монитор', '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
    'smartphone': svg('Смартфон', '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'),
    'tablet': svg('Планшет', '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'),
    'tv': svg('Телевизор', '<rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/>'),
    'watch': svg('Часы', '<circle cx="12" cy="12" r="7"/><polyline points="12 9 12 12 13.5 13.5"/><path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83"/>'),
    'wifi': svg('Вай-фай', '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'),
    'bluetooth': svg('Блютуз', '<polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>'),
    'zap': svg('Молния', '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
    'truck': svg('Грузовик', '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'),
    'coffee': svg('Кофе', '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'),
  };

  // Помещаем базовые иконки в библиотеку
  for (const [key, val] of Object.entries(coreIcons)) {
    ICONS[key] = val;
  }

  // 2. Генератор типов файлов (file-* и folder-*) ~ 150+ иконок
  const fileBase = '<path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"/><polyline points="14 2 14 8 20 8"/>';
  const folderBase = '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>';

  const fileExtensions = [
    'pdf','doc','docx','xls','xlsx','ppt','pptx','txt','rtf','csv','xml','json','html','htm','css','scss','js','ts','jsx','tsx','py','java','c','cpp','cs','go','rb','php','swift','kt','rs','sql','md','yml','yaml','sh','bat','exe','dll','so','app','apk','dmg','iso','zip','rar','7z','tar','gz','bz2','png','jpg','jpeg','gif','svg','webp','bmp','ico','tiff','mp3','wav','ogg','flac','aac','m4a','wma','mp4','avi','mkv','mov','wmv','flv','webm','m4v','ttf','otf','woff','woff2','eot','ini','cfg','conf','log','bak','tmp','db','sqlite','mdb','psd','ai','xd','fig','sketch','prproj','aep','blend','obj','fbx','stl','gltf','unity'
  ];

  for (const ext of fileExtensions) {
    const labelExt = ext.toUpperCase();
    ICONS[`file-${ext}`] = svg(`Файл ${labelExt}`, `${fileBase}<text x="12" y="17" font-family="sans-serif" font-size="4.5" font-weight="bold" text-anchor="middle" fill="currentColor" stroke="none">${labelExt}</text>`);
    ICONS[`folder-${ext}`] = svg(`Папка ${labelExt}`, `${folderBase}<text x="12" y="15" font-family="sans-serif" font-size="4.5" font-weight="bold" text-anchor="middle" fill="currentColor" stroke="none">${labelExt}</text>`);
  }
  ICONS['file'] = svg('Файл', fileBase);
  ICONS['folder'] = svg('Папка', folderBase);

  // 3. Календарные дни (calendar-1 ... calendar-31) ~ 31 иконка
  for (let i = 1; i <= 31; i++) {
    ICONS[`calendar-${i}`] = svg(`Календарь ${i}`, `<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="3" y1="10" x2="21" y2="10"/><text x="12" y="17" font-family="sans-serif" font-size="6.5" font-weight="bold" text-anchor="middle" fill="currentColor" stroke="none">${i}</text>`);
  }
  ICONS['calendar'] = ICONS['calendar-1'];

  // 4. Циферблаты часов (clock-1-00 ... clock-12-45) ~ 48 иконок
  for (let h = 1; h <= 12; h++) {
    for (let m of [0, 15, 30, 45]) {
      const hAngle = (h * 30) + (m * 0.5);
      const mAngle = m * 6;
      const hx = (12 + 4 * Math.sin(hAngle * Math.PI / 180)).toFixed(2);
      const hy = (12 - 4 * Math.cos(hAngle * Math.PI / 180)).toFixed(2);
      const mx = (12 + 6 * Math.sin(mAngle * Math.PI / 180)).toFixed(2);
      const my = (12 - 6 * Math.cos(mAngle * Math.PI / 180)).toFixed(2);
      const suffix = m === 0 ? '00' : m.toString();
      ICONS[`clock-${h}-${suffix}`] = svg(`Часы ${h}:${suffix}`, `<circle cx="12" cy="12" r="10"/><line x1="12" y1="12" x2="${hx}" y2="${hy}"/><line x1="12" y1="12" x2="${mx}" y2="${my}"/>`);
    }
  }
  ICONS['clock'] = ICONS['clock-12-00'];

  // 5. Аккумулятор и Зарядка (battery-0 ... battery-100, battery-charging-0 ... 100) ~ 42 иконки
  for (let i = 0; i <= 100; i += 5) {
    const width = ((14 / 100) * i).toFixed(1);
    const fillBar = width > 0 ? `<rect x="4" y="8" width="${width}" height="8" rx="1" fill="currentColor" stroke="none"/>` : '';
    ICONS[`battery-${i}`] = svg(`Батарея ${i}%`, `<rect x="2" y="6" width="18" height="12" rx="2"/><line x1="22" y1="10" x2="22" y2="14"/>${fillBar}`);
    ICONS[`battery-charging-${i}`] = svg(`Зарядка ${i}%`, `<rect x="2" y="6" width="18" height="12" rx="2"/><line x1="22" y1="10" x2="22" y2="14"/>${fillBar}<polygon points="13 3 8 12 11 12 10 21 16 10 13 10 13 3" fill="var(--bg, #000)" stroke="currentColor" stroke-width="1.2"/>`);
  }

  // 6. Прогресс и круговые диаграммы (progress-0 ... progress-100) ~ 21 иконка
  for (let i = 0; i <= 100; i += 5) {
    const p = i / 100;
    const dasharray = `${(p * 56.5).toFixed(1)} 56.5`;
    ICONS[`progress-${i}`] = svg(`Прогресс ${i}%`, `<circle cx="12" cy="12" r="9" opacity="0.2"/><circle cx="12" cy="12" r="9" stroke-dasharray="${dasharray}" stroke-dashoffset="14.1" transform="rotate(-90 12 12)"/>`);
  }

  // 7. Рейтинги и Звезды (rating-star-0 ... 10, rating-heart-0 ... 10) ~ 22 иконки
  for (let i = 0; i <= 10; i++) {
    const starFill = i / 10;
    ICONS[`rating-star-${i}`] = svg(`Рейтинг ${i}/10`, `<defs><linearGradient id="st${i}"><stop offset="${starFill*100}%" stop-color="currentColor"/><stop offset="${starFill*100}%" stop-color="transparent"/></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#st${i})"/>`);
    ICONS[`rating-heart-${i}`] = svg(`Рейтинг ${i}/10`, `<defs><linearGradient id="ht${i}"><stop offset="${starFill*100}%" stop-color="currentColor"/><stop offset="${starFill*100}%" stop-color="transparent"/></linearGradient></defs><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="url(#ht${i})"/>`);
  }

  // 8. Символьные знаки (char-a..z, circle-a..z, square-a..z, 0..9) ~ 108 иконок
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  for (const char of chars) {
    const l = char.toLowerCase();
    ICONS[`char-${l}`] = svg(`Символ ${char}`, `<text x="12" y="16.5" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="currentColor" stroke="none">${char}</text>`);
    ICONS[`circle-${l}`] = svg(`Символ ${char} в круге`, `<circle cx="12" cy="12" r="10"/><text x="12" y="16" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="currentColor" stroke="none">${char}</text>`);
    ICONS[`square-${l}`] = svg(`Символ ${char} в квадрате`, `<rect x="3" y="3" width="18" height="18" rx="2"/><text x="12" y="16" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="currentColor" stroke="none">${char}</text>`);
  }

  // 9. Стрелки и Шевроны во всех 8 направлениях ~ 48 иконок
  const directions = [
    { n: 'up', r: 0 }, { n: 'up-right', r: 45 }, { n: 'right', r: 90 }, { n: 'down-right', r: 135 },
    { n: 'down', r: 180 }, { n: 'down-left', r: 225 }, { n: 'left', r: 270 }, { n: 'up-left', r: 315 }
  ];
  for (const d of directions) {
    const tr = `transform="rotate(${d.r} 12 12)"`;
    ICONS[`arrow-${d.n}`] = svg(`Стрелка ${d.n}`, `<g ${tr}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></g>`);
    ICONS[`chevron-${d.n}`] = svg(`Шеврон ${d.n}`, `<g ${tr}><polyline points="5 15 12 8 19 15"/></g>`);
    ICONS[`chevron-double-${d.n}`] = svg(`Двойной шеврон ${d.n}`, `<g ${tr}><polyline points="5 18 12 11 19 18"/><polyline points="5 11 12 4 19 11"/></g>`);
    ICONS[`arrow-circle-${d.n}`] = svg(`Стрелка в круге ${d.n}`, `<g ${tr}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="8"/><polyline points="8 12 12 8 16 12"/></g>`);
    ICONS[`arrow-square-${d.n}`] = svg(`Стрелка в квадрате ${d.n}`, `<g ${tr}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="16" x2="12" y2="8"/><polyline points="8 12 12 8 16 12"/></g>`);
    ICONS[`triangle-${d.n}`] = svg(`Треугольник ${d.n}`, `<g ${tr}><polygon points="12 4 20 18 4 18 12 4"/></g>`);
  }

  // 10. Составные иконки с модификаторами статуса (Badge Combinations) ~ 350+ иконок
  const entityBases = {
    'user': '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'folder': folderBase,
    'file': fileBase,
    'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
    'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'cloud': '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    'device': '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    'bell': '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    'cart': '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    'heart': '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    'home': '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    'map': '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
    'monitor': '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    'server': '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>',
    'camera': '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/>',
    'lock': '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    'key': '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    'eye': '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
  };

  const statusModifiers = {
    'add': '<circle cx="18" cy="18" r="5" fill="var(--bg, #0f172a)" stroke="currentColor"/><line x1="18" y1="15" x2="18" y2="21"/><line x1="15" y1="18" x2="21" y2="18"/>',
    'remove': '<circle cx="18" cy="18" r="5" fill="var(--bg, #0f172a)" stroke="currentColor"/><line x1="15" y1="18" x2="21" y2="18"/>',
    'check': '<circle cx="18" cy="18" r="5" fill="var(--bg, #0f172a)" stroke="currentColor"/><polyline points="15.5 18 17 19.5 20.5 16"/>',
    'x': '<circle cx="18" cy="18" r="5" fill="var(--bg, #0f172a)" stroke="currentColor"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="20" y1="16" x2="16" y2="20"/>',
    'alert': '<circle cx="18" cy="18" r="5" fill="var(--bg, #0f172a)" stroke="currentColor"/><line x1="18" y1="15" x2="18" y2="19"/><circle cx="18" cy="21" r="0.5" fill="currentColor" stroke="none"/>',
    'lock': '<circle cx="18" cy="18" r="6" fill="var(--bg, #0f172a)" stroke="none"/><rect x="15" y="18" width="6" height="4" rx="1"/><path d="M16 18v-2a2 2 0 0 1 4 0v2"/>',
    'search': '<circle cx="18" cy="18" r="6" fill="var(--bg, #0f172a)" stroke="none"/><circle cx="17" cy="17" r="2.5"/><line x1="21" y1="21" x2="19" y2="19"/>',
    'star': '<circle cx="18" cy="18" r="6" fill="var(--bg, #0f172a)" stroke="none"/><polygon points="18 14 19 16.5 21.5 16.5 19.5 18 20.5 20.5 18 19 15.5 20.5 16.5 18 14.5 16.5 17 16.5"/>',
    'heart': '<circle cx="18" cy="18" r="6" fill="var(--bg, #0f172a)" stroke="none"/><path d="M18 21s-3-2-3-4a1.5 1.5 0 0 1 3-1.5 1.5 1.5 0 0 1 3 1.5c0 2-3 4-3 4z" fill="currentColor"/>',
    'edit': '<circle cx="18" cy="18" r="6" fill="var(--bg, #0f172a)" stroke="none"/><path d="M16 20l4-4 1 1-4 4h-1v-1z"/>',
    'share': '<circle cx="18" cy="18" r="6" fill="var(--bg, #0f172a)" stroke="none"/><circle cx="19" cy="16" r="1"/><circle cx="16" cy="18" r="1"/><circle cx="19" cy="20" r="1"/><line x1="17" y1="17" x2="18" y2="16"/><line x1="17" y1="19" x2="18" y2="20"/>',
    'info': '<circle cx="18" cy="18" r="5" fill="var(--bg, #0f172a)" stroke="currentColor"/><line x1="18" y1="17" x2="18" y2="20"/><circle cx="18" cy="15" r="0.5" fill="currentColor" stroke="none"/>',
    'settings': '<circle cx="18" cy="18" r="5" fill="var(--bg, #0f172a)" stroke="currentColor"/><circle cx="18" cy="18" r="1.5"/>',
    'sync': '<circle cx="18" cy="18" r="5" fill="var(--bg, #0f172a)" stroke="currentColor"/><path d="M16 17a2 2 0 0 1 3.5-1.4"/><path d="M20 19a2 2 0 0 1-3.5 1.4"/>',
    'download': '<circle cx="18" cy="18" r="5" fill="var(--bg, #0f172a)" stroke="currentColor"/><line x1="18" y1="15" x2="18" y2="19"/><polyline points="16 18 18 20 20 18"/>',
    'upload': '<circle cx="18" cy="18" r="5" fill="var(--bg, #0f172a)" stroke="currentColor"/><line x1="18" y1="21" x2="18" y2="17"/><polyline points="16 18 18 16 20 18"/>',
    'pause': '<circle cx="18" cy="18" r="5" fill="var(--bg, #0f172a)" stroke="currentColor"/><line x1="17" y1="16" x2="17" y2="20"/><line x1="19" y1="16" x2="19" y2="20"/>',
    'play': '<circle cx="18" cy="18" r="5" fill="var(--bg, #0f172a)" stroke="currentColor"/><polygon points="17 16 20 18 17 20 17 16" fill="currentColor"/>'
  };

  for (const [bName, bPath] of Object.entries(entityBases)) {
    for (const [mName, mPath] of Object.entries(statusModifiers)) {
      ICONS[`${bName}-${mName}`] = svg(`${bName} ${mName}`, `${bPath}${mPath}`);
    }
  }

  // 11. Иконки сеток и лейаутов (grid-1x1 ... grid-4x4) ~ 16 иконок
  for (let r = 1; r <= 4; r++) {
    for (let c = 1; c <= 4; c++) {
      let rects = '';
      const w = (18 / c).toFixed(1);
      const h = (18 / r).toFixed(1);
      for (let i = 0; i < r; i++) {
        for (let j = 0; j < c; j++) {
          rects += `<rect x="${(3 + j * (18 / c)).toFixed(1)}" y="${(3 + i * (18 / r)).toFixed(1)}" width="${w}" height="${h}" rx="0.5"/>`;
        }
      }
      ICONS[`grid-${r}x${c}`] = svg(`Сетка ${r}x${c}`, rects);
    }
  }

  const allKeys = Object.keys(ICONS);

  /**
   * Возвращает SVG строку для указанного ключа. Фолбэк — иконка 'app'.
   */
  function get(key) {
    if (!key) return ICONS.app;
    const cleanKey = key.replace(/^svg:/, '');
    return ICONS[cleanKey] || ICONS.app;
  }

  /**
   * Проверяет наличие ключа иконки в библиотеке.
   */
  function has(key) {
    if (!key) return false;
    const cleanKey = key.replace(/^svg:/, '');
    return Object.prototype.hasOwnProperty.call(ICONS, cleanKey);
  }

  /**
   * Возвращает полный список всех иконок в библиотеке.
   */
  function list() {
    return allKeys.map(key => ({ key, svg: ICONS[key] }));
  }

  /**
   * Фильтрует иконки по совпадению названия ключа.
   */
  function search(query) {
    if (!query) return list();
    const q = query.toLowerCase().trim();
    return allKeys
      .filter(key => key.toLowerCase().includes(q))
      .map(key => ({ key, svg: ICONS[key] }));
  }

  /**
   * Рендерит SVG иконку с внедрением произвольных HTML-атрибутов (например, class, style).
   */
  function render(key, attrs = {}) {
    let svgStr = get(key);
    const attrString = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');

    if (attrString) {
      svgStr = svgStr.replace('<svg ', `<svg ${attrString} `);
    }
    return svgStr;
  }

  return {
    get,
    has,
    list,
    search,
    render,
    KEYS: allKeys,
    COUNT: allKeys.length
  };
})();

// Экспорт для Node.js / ES6 модулей / Browser global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RID3IconLibrary;
}