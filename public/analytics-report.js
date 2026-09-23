/* Визуальная модель отчёта для стратсессии. Значения ниже — демонстрационные. */
var ANALYTICS_ROWS = [
  ['Иркутская область', '—', '633 032', '89 730', '1 319', '84%', 135, 132, 131, '63%', '89%', 116, 70, '53%'],
  ['Красноярский край', '—', '261 882', '30 640', '1 481', '54%', 71, 68, 63, '56%', '81%', 54, 35, '56%'],
  ['Приморский край', '—', '236 231', '15 490', '673', '79%', 70, 63, 46, '63%', '70%', 42, 29, '63%'],
  ['Новосибирская область', '—', '156 172', '10 150', '550', '38%', 64, 58, 51, '58%', '81%', 47, 16, '31%'],
  ['Амурская область', '—', '156 045', '18 870', '1 169', '74%', 43, 43, 41, '67%', '67%', 29, 19, '49%'],
  ['Республика Бурятия', '—', '146 786', '21 280', '783', '89%', 47, 46, 44, '68%', '89%', 41, 27, '61%'],
  ['Челябинская область', '—', '105 280', '6 980', '1 396', '42%', 32, 29, 20, '59%', '69%', 20, 12, '60%'],
  ['Забайкальский край', '—', '100 032', '18 050', '873', '79%', 30, 30, 29, '57%', '87%', 26, 19, '66%'],
  ['Республика Башкортостан', '—', '86 883', '3 500', '1 000', '6%', 71, 65, 55, '58%', '62%', 39, 16, '29%'],
  ['Хабаровский край', '—', '72 240', '13 270', '1 474', '90%', 14, 14, 14, '100%', '93%', 13, 10, '71%'],
  ['Алтайский край', '—', '57 961', '2 690', '1 345', '22%', 24, 24, 22, '54%', '63%', 15, 9, '41%'],
  ['Республика Хакасия', '—', '37 816', '7 800', '1 060', '100%', 15, 13, 13, '53%', '85%', 11, 5, '38%']
];

function analyticsPolyline(values, max) {
  return values.map(function (value, index) {
    return (50 + index * 56) + ',' + (178 - value / max * 151);
  }).join(' ');
}

function analyticsChart() {
  var green = [4, 8, 34, 160, 275, 210, 382, 168, 129, 111, 96, 72, 22, 40, 31, 36];
  var orange = [2, 4, 3, 25, 41, 31, 47, 33, 23, 16, 14, 8, 4, 5, 4, 6];
  var grid = [0, 100, 200, 300, 400].map(function (n) {
    var y = 178 - n / 400 * 151;
    return '<line x1="50" y1="' + y + '" x2="890" y2="' + y + '"/>' +
      '<text x="43" y="' + (y + 4) + '" text-anchor="end">' + (n ? n + ' 000' : '0') + '</text>';
  }).join('');
  var hours = Array.from({ length: 16 }, function (_, i) {
    return '<text x="' + (50 + i * 56) + '" y="201" text-anchor="middle">' + String(i + 1).padStart(2, '0') + ':00</text>';
  }).join('');
  return '<svg class="analytics-chart" viewBox="0 0 920 215" role="img" aria-label="Динамика: зелёная линия — общая сумма, оранжевая — доля">' +
    '<g class="analytics-chart__grid">' + grid + hours + '</g>' +
    '<polyline class="analytics-chart__line analytics-chart__line--total" points="' + analyticsPolyline(green, 400) + '"/>' +
    '<polyline class="analytics-chart__line analytics-chart__line--share" points="' + analyticsPolyline(orange, 400) + '"/>' +
    '</svg>';
}

function analyticsReport() {
  var headers = ['Наименование', 'ИКП', 'Итого', 'Доля', 'Чек доли', 'УП', 'Котировки', 'Отправлено', 'Одобрено', 'Доля хороших', 'Одобрение', 'На экране', 'Оформлено', 'Конверсия'];
  var thead = headers.map(function (label) { return '<th scope="col">' + label + '</th>'; }).join('');
  var rows = ANALYTICS_ROWS.map(function (row, i) {
    return '<tr' + (i === 0 ? ' class="analytics-table__selected"' : '') + '>' +
      row.map(function (cell, j) { return '<td>' + (j === 0 ? '<span class="analytics-table__expand">⊕</span>' : '') + cell + '</td>'; }).join('') + '</tr>';
  }).join('');
  var totals = ['Итого', '—', '2 140 550', '246 750', '1 102', '66%', 709, 673, 592, '61%', '75%', 501, 284, '48%'];
  return '<div class="analytics-report">' +
    '<div class="analytics-report__top"><div class="analytics-report__chart-card">' +
    '<div class="analytics-report__card-head"><h2>Динамика показателей</h2><span>23 сентября 2026</span></div>' +
    analyticsChart() +
    '<div class="analytics-report__legend"><span><i class="analytics-report__legend-total"></i>Итого</span><span><i class="analytics-report__legend-share"></i>Доля</span></div></div>' +
    '<div class="analytics-report__filters"><div class="analytics-report__filters-title">Параметры отчёта</div>' +
    '<div class="analytics-report__field"><small>Отчёт</small><span>Отчёт для АА</span></div>' +
    '<div class="analytics-report__field"><small>Период</small><span>23.09.2026 — 23.09.2026</span></div>' +
    '<div class="analytics-report__field"><small>Агенты</small><span>Все агенты / субагенты</span></div>' +
    '<div class="analytics-report__field"><small>Показатель</small><span>Итого</span></div>' +
    '<div class="analytics-report__field"><small>Группировка</small><span>Территории — агенты</span></div>' +
    '<div class="analytics-report__filters-note">Параметры показаны для примера</div>' +
    '</div></div>' +
    '<div class="analytics-report__table-head"><div><h2>Показатели по территориям</h2><span>Демонстрационные данные · ' + ANALYTICS_ROWS.length + ' территорий</span></div></div>' +
    '<div class="analytics-report__table-scroll"><table class="analytics-table"><thead><tr>' + thead + '</tr></thead><tbody>' + rows + '</tbody><tfoot><tr>' +
    totals.map(function (cell) { return '<td>' + cell + '</td>'; }).join('') + '</tr></tfoot></table></div></div>';
}
