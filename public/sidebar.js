(function () {
  'use strict';
  var frame = document.querySelector('.win');
  var toggle = document.getElementById('sidebarToggle');
  if (!frame || !toggle) return;
  var key = 'aa.sidebar.collapsed';
  var collapsed = window.matchMedia('(max-width:900px)').matches;
  try {
    var saved = localStorage.getItem(key);
    if (saved !== null) collapsed = saved === 'true';
  } catch (_) { /* Storage may be disabled; toggling still works. */ }
  document.querySelectorAll('#mainSections .sec[data-view]').forEach(function (item) {
    var label = item.querySelector('span').textContent.trim();
    if (!item.title) item.title = label;
    item.setAttribute('aria-label', label);
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    item.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        item.click();
      }
    });
  });
  function render() {
    frame.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
    var label = collapsed ? 'Развернуть' : 'Свернуть';
    toggle.querySelector('span').textContent = label;
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', label + ' боковую панель');
    toggle.title = label + ' боковую панель';
  }
  toggle.addEventListener('click', function () {
    collapsed = !collapsed;
    render();
    try { localStorage.setItem(key, String(collapsed)); } catch (_) {}
  });
  render();
})();
