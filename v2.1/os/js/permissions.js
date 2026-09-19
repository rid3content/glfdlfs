/**
 * RID3 Permissions — реестр прав доступа, которые может запросить .rva-приложение.
 * Используется в IDE (чекбоксы), в диалоге установки и в мостике RID3Bridge для
 * проверки, что приложению разрешён тот или иной вызов системного API.
 */
const RID3Permissions = (() => {

  const ALL = [
    { id: 'time', icon: '🕒', name: 'Дата и время', desc: 'Текущее системное время, дата и часовой пояс.' },
    { id: 'filesystem', icon: '🗂', name: 'Файловая система', desc: 'Чтение и запись в общие «Файлы» пользователя.' },
    { id: 'storage', icon: '💾', name: 'Личное хранилище', desc: 'Сохранение собственных данных приложения между запусками.' },
    { id: 'clipboard', icon: '📋', name: 'Буфер обмена', desc: 'Чтение и запись текста в системный буфер обмена.' },
    { id: 'notifications', icon: '🔔', name: 'Уведомления', desc: 'Показ системных всплывающих уведомлений.' },
    { id: 'device_info', icon: '📟', name: 'Информация об устройстве', desc: 'Версия ОС, тема оформления, размер экрана.' },
    { id: 'apps_list', icon: '🧩', name: 'Список приложений', desc: 'Просмотр списка установленных на устройстве приложений.' },
    { id: 'network', icon: '🌐', name: 'Сеть', desc: 'Обращение к интернету через fetch (если поддерживается браузером).' },
  ];

  const BY_ID = Object.fromEntries(ALL.map(p => [p.id, p]));

  function get(id) { return BY_ID[id] || { id, icon: '❔', name: id, desc: 'Неизвестное право.' }; }

  function labelList(ids) {
    if (!ids || !ids.length) return 'без особых прав';
    return ids.map(id => get(id).name).join(', ');
  }

  return { ALL, get, labelList };
})();
