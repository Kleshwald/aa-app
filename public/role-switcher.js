/* Демонстрационное переключение ролей: меняет доступные разделы прототипа, не права 1С. */
var PROTOTYPE_ROLES = {
  admin: { title: 'Администратор', initials: 'АД', description: 'Все разделы' },
  curator: { title: 'Куратор', initials: 'КУ', description: 'Без панели оператора и настроек' },
  agent: { title: 'Агент', initials: 'АГ', description: 'Без профиля и служебных разделов' }
};
var prototypeRole = 'admin';

function prototypeRoleCanAccess(view) {
  if (view === 'support' || view === 'support2' || view === 'settings') return prototypeRole === 'admin';
  if (view === 'analytics') return prototypeRole !== 'agent';
  if (view === 'profile') return prototypeRole !== 'agent';
  return true;
}

function screenAnalytics() {
  return '<div class="screen active role-analytics"><div class="ptitle">Аналитика</div>' + analyticsReport() + '</div>';
}

var PROTOTYPE_SETTINGS_GROUPS = [
  { title: 'Основные', items: ['Best2Pay', 'Ренессанс', 'Ингосстрах', 'Сбербанк', 'Югория', 'Настройки', 'Ипотека', 'Зетта', 'Согласие', 'Росгосстрах', 'Энергогарант'] },
  { title: 'Технические формы', items: ['Договоры страхования ОСАГО', 'Договоры страхования ДВС', 'Договор страхования НС', 'Заявки в службу поддержки', 'Агенты', 'Кураторы', 'Контрагенты', 'Пользователи', 'Страховые продукты', 'Рабочее место е-Гарант', 'Правила расшифровки кодов ошибок', 'Классификатор ошибок', 'Открыть виды спорта'] },
  { title: 'Аналитика', items: ['Журнал договоров', 'Структура агентской сети', 'Текущее КВ агентов', 'История статусов', 'Отказы по сегментации территорий', 'История изменений', 'Логи обмена', 'Ошибки обмена', 'Журнал регистрации', 'Сведения о котировках', 'Результаты проверки по сегментации', 'Результаты поиска по гос. номеру', 'Простые электронные подписи', 'Реестр по продуктам', 'Состояние системы', 'Жизнь счета'] },
  { title: 'Сервис', items: ['Произвольные алгоритмы', 'Создать новую марку или модель', 'Популярные марки ТС', 'Мэппинг марок / моделей', 'Модификации ТС', 'Фотографии автомобилей', 'Передача портфеля', 'Способы оплаты', 'Сертификаты страховых программ', 'Загрузка данных для отчета «Присутствие в регионах»', 'Дополнительные отчеты и обработки', 'Группы доступа', 'Профили доступа', 'Черный список ТС', 'Черный список контрагентов', 'Печать простых электронных подписей', 'Информация об обмене со страховыми компаниями', 'Коэффициенты страховых компаний', 'Чеки об оплате', 'Форма загрузки OData', 'Консоль администрирования'] },
  { title: 'Настройки', items: ['Профили настроек агентов', 'Профили сегментации', 'Настройки сегментации', 'Новости', 'Категории мотивации', 'Системы мотивации агентов', 'Настройки дооформления ДВС', 'Настройки тарифов НС'] },
  { title: 'Профили', items: ['Настройка профилей', 'Алгоритмы', 'Территории', 'Группы страховых продуктов', 'Настройки вывода на экран', 'Бизнес-правила', 'Страховые продукты', 'Эмитенты продуктов'] },
  { title: 'Инструменты', items: ['Монитор сертификатов', 'Группы тестирования функционала', 'Демо', 'Демо 2'] },
  { title: 'Инструменты поддержки', items: ['Загрузка полиса по ПФ'] }
];

function screenSettings() {
  var groups = PROTOTYPE_SETTINGS_GROUPS.map(function (group) {
    return '<section class="admin-card"><h2>' + group.title + '</h2><div class="admin-card__items">' +
      group.items.map(function (item) { return '<span class="admin-card__item">' + item + '</span>'; }).join('') +
      '</div></section>';
  }).join('');
  return '<div class="screen active admin-screen"><div class="ptitle">Настройки</div>' +
    '<p class="admin-screen__intro">Панель администрирования</p>' +
    '<div class="admin-screen__grid">' + groups +
    '<section class="admin-card admin-card--wide"><h2>Операции</h2><div class="admin-ops">' +
    '<div><span>Договор страхования</span><strong>Сохранить логи</strong></div>' +
    '<div><span>Договор</span><strong>Удалить договор</strong></div>' +
    '<div><span>Договор страхования (фотографии)</span><strong>Просмотр фотографий</strong></div>' +
    '</div><div class="admin-ops__foot">Текст уведомления на форме договора ОСАГО</div></section>' +
    '</div></div>';
}

(function () {
  'use strict';
  var frame = document.getElementById('win');
  var trigger = document.getElementById('roleSwitcherButton');
  var menu = document.getElementById('roleSwitcherMenu');
  var initials = document.getElementById('roleSwitcherInitials');
  if (!frame || !trigger || !menu || !initials) return;
  try {
    var saved = localStorage.getItem('aa.prototype.role');
    if (Object.prototype.hasOwnProperty.call(PROTOTYPE_ROLES, saved)) prototypeRole = saved;
  } catch (_) { /* Переключатель работает и без localStorage. */ }

  function closeMenu() {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }
  function updateMenu() {
    menu.innerHTML = '<div class="role-switcher__heading">Пользователь прототипа</div>' +
      Object.keys(PROTOTYPE_ROLES).map(function (key) {
        var role = PROTOTYPE_ROLES[key];
        return '<button type="button" role="menuitemradio" aria-checked="' + (key === prototypeRole) +
          '" class="role-switcher__option' + (key === prototypeRole ? ' role-switcher__option--active' : '') +
          '" data-role="' + key + '"><span class="role-switcher__avatar">' + role.initials +
          '</span><span><strong>' + role.title + '</strong><small>' + role.description +
          '</small></span><span class="role-switcher__check" aria-hidden="true">' + (key === prototypeRole ? '✓' : '') + '</span></button>';
      }).join('') +
      (prototypeRoleCanAccess('profile') ? '<div class="role-switcher__footer"><button type="button" id="roleProfileButton">Открыть профиль</button></div>' : '');
  }
  function applyRole() {
    frame.dataset.role = prototypeRole;
    initials.textContent = PROTOTYPE_ROLES[prototypeRole].initials;
    trigger.title = 'Сменить пользователя — ' + PROTOTYPE_ROLES[prototypeRole].title;
    trigger.setAttribute('aria-label', trigger.title);
    document.querySelectorAll('#mainSections .sec[data-view]').forEach(function (item) {
      item.hidden = !prototypeRoleCanAccess(item.dataset.view);
    });
    var current = document.querySelector('#mainSections .sec--active[data-view]');
    if (current && !prototypeRoleCanAccess(current.dataset.view)) go('clients');
    updateMenu();
  }
  trigger.addEventListener('click', function (event) {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    trigger.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) menu.querySelector('[aria-checked="true"]').focus();
  });
  menu.addEventListener('click', function (event) {
    var option = event.target.closest('[data-role]');
    if (option) {
      prototypeRole = option.dataset.role;
      try { localStorage.setItem('aa.prototype.role', prototypeRole); } catch (_) {}
      applyRole();
      closeMenu();
      trigger.focus();
    } else if (event.target.id === 'roleProfileButton') {
      closeMenu();
      go('profile');
    }
  });
  document.addEventListener('click', function (event) {
    if (!menu.hidden && !menu.contains(event.target) && !trigger.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !menu.hidden) { closeMenu(); trigger.focus(); }
  });
  applyRole();
})();
