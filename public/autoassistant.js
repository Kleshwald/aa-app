/* Local clickable AP prototype. No payments or documents leave this browser.
   Confirmed workflow: quote → service payment → AP documents → operator →
   OSAGO payment confirmed by operator → policy + application → issued contract. */
var autoIdx = 14;
var apQuoteSnapshot = null;
var apQuoteDraftIdx = null;
var apFileSequence = 0;
var apFiles = Object.create(null);

function apServiceDocument(c) {
  if (!c.autoServicePaid) return null;
  if (!c.apServiceDocument) {
    var file = new File(['Сервис Автопомощник\nДЕМОНСТРАЦИОННЫЙ ДОКУМЕНТ — не является договором.\nСтрахователь: ' + c.n + '\nСтоимость: ' + apRub(c.autoServicePrice) + '\nСервис оплачен отдельно от ОСАГО.'], 'Автопомощник — демо.txt', {type:'text/plain;charset=utf-8'});
    var key = 'ap-file-' + (++apFileSequence); apFiles[key] = file;
    c.apServiceDocument = {key:key,name:file.name,categoryLabel:'Документ сервиса Автопомощник (демо)'};
  }
  return c.apServiceDocument;
}
function apServiceDocumentHTML(c) {
  var file = apServiceDocument(c);
  return file ? '<section class="card"><h3>Документ сервиса АП</h3>' + apAttachments([file]) + '</section>' : '';
}
function apAddDriver(button) {
  var section = button.closest('.osec'), row = section.querySelector('.orow').cloneNode(true);
  row.querySelectorAll('input').forEach(function(input) { input.value = ''; });
  section.insertBefore(row,button.closest('.oactions'));
}
function apDriverMode(button, unlimited) {
  button.parentElement.querySelectorAll('button').forEach(function(b) { b.classList.toggle('pill--active',b===button); });
  button.closest('.osec').querySelectorAll('.orow,.oactions').forEach(function(el) { el.hidden=unlimited; });
}
function apMoney(value) {
  return Number(String(value == null ? '' : value).replace(/\s/g, '').replace(',', '.'));
}
function apRub(value) { return apMoney(value).toLocaleString('ru-RU', {maximumFractionDigits: 2}) + ' ₽'; }
function apCase(idx) { return procForPolicy(idx).find(function(it) { return it.kind === 'deal'; }); }
function apDraft(c) { return c.apDraft || (c.apDraft = {files: {}, comment: '', error: ''}); }
function apDocs(c) {
  var docs = [
    {id: 'passport-main', group: 'Паспорт страхователя', title: 'Основной разворот'},
    {id: 'passport-address', group: 'Паспорт страхователя', title: 'Регистрация'},
    {id: 'vehicle-front', group: 'Документы автомобиля', title: 'СТС / ПТС — лицевая сторона'},
    {id: 'vehicle-back', group: 'Документы автомобиля', title: 'СТС / ПТС — оборотная сторона'},
    {id: 'sale', group: 'Документы автомобиля', title: 'Договор купли-продажи', optional: true}
  ];
  if (!c.unlimitedDrivers) (c.drivers || [{fullName: c.n}]).forEach(function(driver, i) {
    ['front', 'back'].forEach(function(side) {
      docs.push({id: 'driver-' + i + '-' + side, group: 'Водитель ' + (i + 1) + ' · ' + driver.fullName,
        title: 'ВУ — ' + (side === 'front' ? 'лицевая' : 'оборотная') + ' сторона'});
    });
  });
  return docs;
}
function apKeepFile(file) {
  if (!file || !/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) return null;
  var id = 'ap-file-' + (++apFileSequence);
  apFiles[id] = file;
  return {key: id, name: file.name};
}
function apDownload(key) {
  var file = apFiles[key];
  if (!file) { toast('Файл недоступен в этой сессии прототипа.'); return false; }
  var url = URL.createObjectURL(file), link = document.createElement('a');
  link.href = url; link.download = file.name; link.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  return true;
}
function apFileLink(file) {
  return file && file.key ? '<button class="ap-file-link" onclick="apDownload(\'' + file.key + '\')">' + procEscape(file.name) + '</button>' : procEscape(file && file.name || 'Файл не приложен');
}
function openAutoassistant(idx) {
  var c = CLIENTS[idx];
  if (!c || contractProduct(c) !== 'osago' || !c.autoassistant || c.st === 'cancelled') return false;
  autoIdx = idx; apDraft(c); render('autow');
  document.getElementById('activeTab').innerHTML = 'Автопомощник <span class="tab__x">×</span>';
  return true;
}
function apCaptureQuote() {
  var root = document.getElementById('osagoScreen'); if (!root) return;
  function section(name) { return Array.from(root.querySelectorAll('.osec')).find(function(s) { return (s.querySelector('.osec__title') || {}).textContent?.startsWith(name); }); }
  function value(s, label) {
    var field = s && Array.from(s.querySelectorAll('.of')).find(function(f) { return (f.querySelector('label') || {}).textContent === label; });
    var input = field && field.querySelector('input,select'); return input ? input.value : '';
  }
  function fullName(s) { return ['Фамилия', 'Имя', 'Отчество'].map(function(l) { return value(s, l); }).filter(Boolean).join(' '); }
  var owner = section('Собственник');
  var holder = section('Страхователь'), vehicle = section('Транспорт'), params = section('Параметры'), drivers = section('Водители');
  if (!vehicle) vehicle = root.querySelector('.osec');
  apQuoteSnapshot = {n: fullName(holder), o: [value(vehicle, 'Марка'), value(vehicle, 'Модель')].filter(Boolean).join(' '),
    sub: value(vehicle, 'Гос.знак'), startDate: value(params, 'Дата начала'), endDate: value(params, 'Дата окончания'),
    owner: owner && owner.querySelector('input[type="checkbox"]')?.checked ? fullName(holder) : fullName(owner), address: value(holder, 'Адрес регистрации'), category: value(vehicle, 'Категория'),
    year: value(vehicle, 'Год выпуска'), purpose: value(params, 'Цель использования'),
    drivers: drivers ? Array.from(drivers.querySelectorAll('.orow')).filter(function(row) { return Array.from(row.querySelectorAll('label')).some(function(label) { return label.textContent === 'Фамилия'; }); }).map(function(row) { return {fullName:fullName(row), experienceSince:value(row,'Стаж с')}; }) : [], unlimitedDrivers: !!(drivers && drivers.querySelector('.osec__head .pill--active')?.textContent === 'Без ограничений')};
  apQuoteDraftIdx = null;
  // Release form keeps licence/experience in a second row; use stable field IDs.
  if (drivers && drivers.querySelectorAll) {
    var names = Array.from(drivers.querySelectorAll('input[id]')).filter(function(input) { return /^oD\d*Ln$/.test(input.id); });
    if (names.length) apQuoteSnapshot.drivers = names.map(function(input) {
      var prefix = input.id.slice(0,-2);
      function field(suffix) { return document.getElementById(prefix+suffix)?.value || ''; }
      return {fullName:[input.value,field('Fn'),field('Mn')].filter(Boolean).join(' '),
        birthDate:field('Bd'), experienceSince:field('Exp'), licenseNumber:[field('LicS'),field('LicN')].filter(Boolean).join(' ')};
    });
  }
}
function apChooseQuote(index) {
  var q = QUOTES[index]; if (!q || q.svc !== 'autoassistant') return false;
  if (!apQuoteSnapshot || !apQuoteSnapshot.n) { toast('Сначала выполните расчёт ОСАГО.'); return false; }
  if (apQuoteDraftIdx === null) {
    var c = Object.assign({}, apQuoteSnapshot, {d: new Date().toLocaleDateString('ru-RU'), p: 'ОСАГО', num: 'Ещё не выпущен',
      sk: 'Перестраховочный пул', price: q.price, st: 'draft', sti: 'edit', stl: 'Черновик', autoassistant: true,
      autoServicePrice: apMoney(q.svcPrice), autoServicePaid: false, attn: true, attnAct: 'Оплатите сервис Автопомощник'});
    CLIENTS.push(c); apQuoteDraftIdx = CLIENTS.length - 1;
  }
  return openAutoassistant(apQuoteDraftIdx);
}
function apDemoServicePaid() {
  var c = CLIENTS[autoIdx]; if (!c || c.autoServicePaid || apCase(autoIdx)) return false;
  c.autoServicePaid = true; apServiceDocument(c); c.attnAct = 'Загрузите документы для Автопомощника';
  openAutoassistant(autoIdx); return true;
}
function autoAddFile(code, input) {
  var c = CLIENTS[autoIdx], draft = apDraft(c);
  if (apCase(autoIdx) || !apDocs(c).some(function(d) { return d.id === code; })) return false;
  var file = input && input.files && input.files[0]; if (!file) return false;
  var saved = apKeepFile(file);
  if (!saved) { draft.error = 'Выберите PDF, JPG, PNG или WEBP.'; openAutoassistant(autoIdx); return false; }
  if (draft.files[code]) delete apFiles[draft.files[code].key];
  draft.files[code] = saved; draft.error = ''; openAutoassistant(autoIdx); return true;
}
function autoRemoveFile(code) {
  var c = CLIENTS[autoIdx]; if (apCase(autoIdx)) return false;
  var draft = apDraft(c); if (draft.files[code]) delete apFiles[draft.files[code].key];
  delete draft.files[code]; openAutoassistant(autoIdx); return true;
}
function autoSubmit() {
  var c = CLIENTS[autoIdx], draft = apDraft(c);
  if (apCase(autoIdx)) return false;
  if (!c.autoServicePaid) { draft.error = 'Перед отправкой документов оплатите сервис Автопомощник.'; openAutoassistant(autoIdx); return false; }
  var missing = apDocs(c).filter(function(d) { return !d.optional && !draft.files[d.id]; });
  if (missing.length) { draft.error = 'Приложите обязательные документы. Осталось: ' + missing.length + '.'; openAutoassistant(autoIdx); return false; }
  var documents = apDocs(c).filter(function(d) { return draft.files[d.id]; }).map(function(d) {
    return Object.assign({}, draft.files[d.id], {category: d.id, categoryLabel: d.group + ' · ' + d.title, by: 'agent', at: 'сейчас'});
  });
  var id = procCreateCase(autoIdx, 'deal', {stay: true, type: 'Автопомощник', comment: draft.comment,
    what: 'Оформление ОСАГО через Автопомощник.', files: [],
    dealData: {serviceAmount: c.autoServicePrice, servicePaid: true, osagoPremium: apMoney(c.price), insurer: '',
      paymentLink: '', policySeries: '', policyNumber: '', policyFiles: [], paymentConfirmed: false}});
  if (!id) return false;
  var it = supFind(id); it.attachments = documents;
  c.st = 'wait'; c.stl = 'Оформляется'; c.attn = false;
  procSetStatus(id, 'docs_uploaded', 'agent', 'Документы для оформления ОСАГО загружены.');
  openAutoassistant(autoIdx); return true;
}
function apTrack(c, it) {
  var current = !c.autoServicePaid ? 0 : !it ? 1 : ['new','in_work','docs_uploaded','awaiting_docs','rejected'].includes(it.cstatus) ? 2 : it.cstatus === 'awaiting_payment' ? 3 : 4;
  return '<ol class="ap-track" aria-label="Этапы Автопомощника">' + ['Сервис АП', 'Документы', 'Проверка', 'Оплата ОСАГО', 'Полис'].map(function(title, i) {
    var done = i < current || (it && it.cstatus === 'done');
    return '<li class="' + (done ? 'is-done' : i === current ? 'is-current' : '') + '"' + (i === current ? ' aria-current="step"' : '') + '><span>' + (done ? '✓' : i + 1) + '</span>' + title + '</li>';
  }).join('') + '</ol>';
}
function apContext(c) {
  return '<div class="ap-context"><div><strong>' + procEscape(c.n) + '</strong><span>' + procEscape(c.o + ' · ' + c.sub) + '</span></div><span>ОСАГО · ' + procEscape(c.startDate || 'Дата не указана') + ' — ' + procEscape(c.endDate || 'Дата не указана') + '</span></div>';
}
function apCosts(c, it) {
  var d = it ? dealData(it) : {}, paid = !!d.paymentConfirmed;
  return '<section class="card ap-costs"><h3>Оплата</h3><div class="ap-cost"><span>Сервис «Автопомощник»</span><strong>' + apRub(c.autoServicePrice) + '</strong><span class="status-text ' + (c.autoServicePaid ? 'ok' : 'pay') + '">' + (c.autoServicePaid ? 'Оплачен отдельно' : 'К оплате сейчас') + '</span></div>'
    + '<div class="ap-cost"><span>Полис ОСАГО</span><strong>' + apRub(d.osagoPremium || c.price) + '</strong><span class="status-text ' + (paid ? 'ok' : 'wait') + '">' + (paid ? 'Оплата подтверждена оператором' : it && it.cstatus === 'awaiting_payment' ? 'Ожидает оплаты клиентом' : 'Оплата после проверки документов') + '</span></div>'
    + '<p class="card__lead">Оплата сервиса АП не является оплатой ОСАГО.</p></section>';
}
function apUploadHTML(c) {
  var draft = apDraft(c), docs = apDocs(c), required = docs.filter(function(d) { return !d.optional; }), complete = required.filter(function(d) { return draft.files[d.id]; }).length, group = '';
  var rows = docs.map(function(d) {
    var h = d.group !== group ? '<h4 class="ap-doc-group">' + procEscape(d.group) + '</h4>' : ''; group = d.group;
    var file = draft.files[d.id];
    return h + '<div class="ap-doc-row"><div><span>' + d.title + '</span>' + (d.optional ? '<span class="ap-muted">При наличии</span>' : '') + (file ? '<div class="ap-selected">' + apFileLink(file) + '</div>' : '') + '</div><div class="ap-actions"><label class="btn"><input type="file" class="ap-file-input" accept=".pdf,.jpg,.jpeg,.png,.webp" aria-label="' + procEscape(d.group + ' · ' + d.title) + '" onchange="autoAddFile(\'' + d.id + '\',this)">' + (file ? 'Заменить' : 'Прикрепить') + '</label>' + (file ? '<button class="ap-file-link" onclick="autoRemoveFile(\'' + d.id + '\')" aria-label="Удалить ' + procEscape(d.title) + '">Удалить</button>' : '') + '</div></div>';
  }).join('');
  return '<section class="card"><div class="ap-heading"><h3>Документы для оформления ОСАГО</h3><span>' + complete + ' из ' + required.length + '</span></div><p class="card__lead">Все данные на фотографиях должны быть читаемы. ВУ каждого водителя — с двух сторон. PDF, JPG, PNG или WEBP.</p>' + rows
    + '<label class="ap-field">Комментарий для оператора<textarea class="sup-ta" oninput="apDraft(CLIENTS[autoIdx]).comment=this.value" placeholder="Необязательно">' + procEscape(draft.comment) + '</textarea></label>'
    + (draft.error ? '<p class="proc-err" role="alert">' + procEscape(draft.error) + '</p>' : '')
    + '<div class="ap-submit"><span class="ap-muted">После отправки оператор проверит комплект.</span><button class="btn btn--primary" onclick="autoSubmit()">Отправить документы</button></div></section>';
}
function screenAutoassistant() {
  var c = CLIENTS[autoIdx], it = apCase(autoIdx), body;
  if (!c.autoServicePaid) body = '<section class="card"><h3>Сервис «Автопомощник»</h3><p class="card__lead">Прикрепите документы ниже. Перед отправкой комплекта нужно оплатить сервис отдельно от ОСАГО.</p><div class="ap-cost"><span>К оплате за сервис</span><strong>' + apRub(c.autoServicePrice) + '</strong></div><div class="ap-demo"><p>Демонстрация оплаты сервиса. Реального списания нет.</p><button class="btn" onclick="apDemoServicePaid()">Симулировать успешную оплату сервиса</button></div></section>' + apUploadHTML(c);
  else if (!it) body = apUploadHTML(c);
  else body = '<section class="card">' + apCaseCard(it, true) + '</section><section class="card"><h3>Отправленные документы</h3>' + apAttachments(it.attachments.filter(function(f) { return f.by === 'agent'; })) + (it.reasonComment ? '<div class="ap-note"><strong>Комментарий агента</strong><p>' + procEscape(it.reasonComment) + '</p></div>' : '') + '</section>';
  return '<div class="screen active ap-screen"><div class="breadcrumb"><a onclick="go(\'osago\')">ОСАГО</a> / Дополнительный продукт</div><div class="ap-title"><div><h1>Автопомощник</h1><p>Оформление ОСАГО через перестраховочный пул</p></div><button class="btn" onclick="openContract(' + autoIdx + ',false,true)">Данные договора</button></div>' + apContext(c) + apTrack(c,it) + '<div class="ap-layout"><main>' + body + '</main><aside>' + apCosts(c,it) + apServiceDocumentHTML(c) + '<section class="card"><h3>Что дальше</h3><p class="card__lead">Оператор пришлёт ссылку на оплату ОСАГО. Передайте её клиенту. После подтверждения платежа оператор приложит полис и заявление.</p></section></aside></div><div class="ap-demo-footer">Прототип · данные и файлы хранятся только до обновления страницы.' + (it ? ' <button class="ap-file-link" onclick="supOpen=\'' + it.id + '\';go(\'support\')">Перейти к оператору →</button>' : '') + '</div></div>';
}
function dealData(it) {
  if (!it.dealData) it.dealData = {serviceAmount: 0, servicePaid: false, osagoPremium: 0, insurer: '', paymentLink: '', policySeries: '', policyNumber: '', policyFiles: [], paymentConfirmed: false};
  return it.dealData;
}
function apSafeLink(value) { try { var url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch (_) { return ''; } }
function dealOpSet(id, key, value) {
  var it = supFind(id); if (!it || it.kind !== 'deal') return false;
  var keys = ['in_work','docs_uploaded','awaiting_payment'].includes(it.cstatus) ? ['insurer','osagoPremium','paymentLink'] : it.cstatus === 'paid' ? ['policySeries','policyNumber','insurer','osagoPremium'] : [];
  if (!keys.includes(key)) return false; dealData(it)[key] = value; return true;
}
function apTransitionAllowed(it, next, actor) {
  var from = it.cstatus, d = dealData(it);
  if (next === 'docs_uploaded') return actor === 'agent' && ['new','awaiting_docs'].includes(from);
  if (actor !== 'support') return false;
  if (next === 'paid') return from === 'awaiting_payment' && d.paymentConfirmed === true && !it.payStale;
  if (next === 'in_work') return ['new','docs_uploaded'].includes(from);
  if (next === 'awaiting_payment') return ['in_work','docs_uploaded','awaiting_payment'].includes(from) && d.servicePaid && !!d.insurer.trim() && apMoney(d.osagoPremium) > 0 && !!apSafeLink(d.paymentLink);
  if (next === 'done') return from === 'paid' && d.paymentConfirmed === true && !!d.finalized;
  return false;
}
function dealSendPayment(id) {
  var it = supFind(id); if (!it || it.kind !== 'deal') return false;
  var d = dealData(it), amount = apMoney(d.osagoPremium), url = apSafeLink(d.paymentLink);
  if (!d.insurer.trim() || !Number.isFinite(amount) || amount <= 0 || !url) { toast('Укажите страховую, положительную премию и корректную HTTPS-ссылку.'); return false; }
  if (!apTransitionAllowed(it, 'awaiting_payment', 'support')) return false;
  d.osagoPremium = amount; d.paymentLink = url; it.sk = d.insurer.trim(); it.payAmount = amount; it.payStale = false;
  CLIENTS[it.policyIdx].attn = true;
  procSetStatus(id, 'awaiting_payment', 'support', 'Ссылка на оплату ОСАГО: <a href="' + procEscape(url) + '" target="_blank" rel="noopener noreferrer">' + procEscape(url) + '</a>. К оплате ' + apRub(amount) + '.');
  supRerender(); return true;
}
function dealConfirmPayment(id) {
  var it = supFind(id); if (!it || it.kind !== 'deal' || it.cstatus !== 'awaiting_payment' || it.payStale) return false;
  var check = document.getElementById('ap-payment-checked');
  if (!check || !check.checked) { toast('Подтвердите, что вы проверили поступление оплаты ОСАГО.'); return false; }
  var d = dealData(it); d.paymentConfirmed = true; d.paymentConfirmedAt = new Date().toISOString();
  procSetStatus(id, 'paid', 'support', 'Оператор подтвердил оплату ОСАГО ' + apRub(d.osagoPremium) + '. Готовим полис.');
  CLIENTS[it.policyIdx].attn = false; supRerender(); return true;
}
function dealPolicyFile(id, type, input) {
  var it = supFind(id); if (!it || it.cstatus !== 'paid' || !['policy','application'].includes(type)) return false;
  var raw = input && input.files && input.files[0]; if (!raw) return false;
  var file = apKeepFile(raw); if (!file) { toast('Выберите PDF, JPG, PNG или WEBP.'); return false; }
  var d = dealData(it), old = d.policyFiles.find(function(f) { return f.type === type; }); if (old) delete apFiles[old.key];
  d.policyFiles = d.policyFiles.filter(function(f) { return f.type !== type; }).concat([Object.assign(file, {type: type})]);
  supRerender(); return true;
}
function dealFinalize(id) {
  var it = supFind(id); if (!it || it.kind !== 'deal' || it.cstatus !== 'paid') return false;
  var d = dealData(it), amount = apMoney(d.osagoPremium);
  if (!d.paymentConfirmed || !d.policySeries.trim() || !d.policyNumber.trim() || !d.insurer.trim() || !Number.isFinite(amount) || amount <= 0 || !['policy','application'].every(function(type) { return d.policyFiles.some(function(f) { return f.type === type && apFiles[f.key]; }); })) {
    toast('Укажите серию, номер, страховую и премию; приложите полис и заявление.'); return false;
  }
  var c = CLIENTS[it.policyIdx];
  c.num = d.policySeries.trim() + ' ' + d.policyNumber.trim(); c.sk = d.insurer.trim(); c.price = amount.toLocaleString('ru-RU', {maximumFractionDigits: 2});
  c.st = 'ok'; c.sti = 'check'; c.stl = 'Оформлен'; c.paymentConfirmed = true; c.attn = false; c.attnAct = '';
  c.dealDocs = d.policyFiles.slice(); it.num = c.num; it.sk = c.sk;
  it.attachments = it.attachments.concat(d.policyFiles.map(function(f) { return Object.assign({}, f, {by:'support', categoryLabel: f.type === 'policy' ? 'Полис ОСАГО' : 'Заявление на страхование'}); }));
  d.finalized = true; it.valueSeen = false;
  procSetStatus(id, 'done', 'support', 'Полис ОСАГО оформлен. Полис и заявление доступны в договоре.');
  supRerender(); return true;
}
function apPaymentHTML(it) {
  var d = dealData(it);
  if (it.payStale) return '<p class="prg-need">Запрошена новая ссылка. Оператор проверит её и пришлёт замену.</p>';
  return '<div class="ap-note"><strong>К оплате за ОСАГО: ' + apRub(d.osagoPremium) + '</strong><p>Передайте ссылку клиенту. Оплату подтвердит оператор.</p><a class="ap-url" href="' + procEscape(apSafeLink(d.paymentLink)) + '" target="_blank" rel="noopener noreferrer">' + procEscape(d.paymentLink) + '</a><div class="ap-actions"><button class="btn btn--primary" onclick="apCopyLink(\'' + it.id + '\')">Скопировать ссылку</button><button class="btn" onclick="procReqNewLink(\'' + it.id + '\')">Ссылка не работает</button></div></div>';
}
async function apCopyLink(id) {
  var it = supFind(id); if (!it || it.cstatus !== 'awaiting_payment' || it.payStale) return false;
  try { await navigator.clipboard.writeText(dealData(it).paymentLink); toast('Ссылка скопирована — передайте её клиенту.'); return true; }
  catch (_) { toast('Не удалось скопировать автоматически. Выделите ссылку и скопируйте вручную.'); return false; }
}
function apAttachments(files) {
  return files.map(function(f) { return '<div class="ap-doc-row"><span>' + procEscape(f.categoryLabel || (f.type === 'policy' ? 'Полис ОСАГО' : f.type === 'application' ? 'Заявление на страхование' : f.requestedFor || 'Документ')) + '</span><span>' + apFileLink(f) + '</span></div>'; }).join('');
}
function apCaseCard(it, expanded) {
  var status = it.cstatus, content = '', description = {new:'Оператор проверит документы.',docs_uploaded:'Комплект отправлен. Оператор проверит документы и подготовит ссылку на оплату ОСАГО.',in_work:'Оператор проверяет документы. Следующий шаг — оплата ОСАГО.',paid:'Оператор подтвердил оплату ОСАГО. Осталось приложить готовый полис и заявление.',done:'Полис оформлен. Скачайте документы и передайте клиенту.'}[status] || '';
  if (status === 'awaiting_payment') content = apPaymentHTML(it);
  if (status === 'awaiting_docs') content = '<div class="ap-note"><strong>Оператор запросил документы</strong>' + procDocRequestEntries(it).map(function(e,index) { return '<div class="ap-doc-row"><span>' + procEscape(e.label) + '</span>' + (e.files.length ? '<span class="status-text ok">Приложено</span>' : '<label class="btn"><input class="ap-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onchange="apRequestedFile(\'' + it.id + '\',' + index + ',this)">Прикрепить</label>') + '</div>'; }).join('') + '</div>';
  if (status === 'done') content = apAttachments(dealData(it).policyFiles);
  if (status === 'rejected') content = '<p class="proc-err">' + procEscape(it.rejectReason || 'Причина не указана') + '</p><p>Уточните дальнейшие действия у поддержки в переписке по заявке.</p>';
  return '<div class="ap-case"><div class="ap-heading"><h3>АП · Автопомощник</h3><span class="status-text ' + (status === 'done' ? 'ok' : 'wait') + '">' + procEscape(procAgentLabel(it)) + '</span></div><p class="ap-muted">Заявка № ' + it.id + '</p>' + (description ? '<p>' + description + '</p>' : '') + content + '<div class="ap-actions">' + (!expanded ? '<button class="btn btn--primary" onclick="openAutoassistant(' + it.policyIdx + ')">Открыть Автопомощник</button>' : '') + '<button class="btn" onclick="procOpenDiscussion(\'' + it.id + '\')">Переписка</button></div><details class="ap-history"><summary>История заявки</summary>' + it.steps.filter(function(s) { return !s.internal; }).map(function(s) { return '<div class="ap-history-row"><span>' + procEscape(s.d) + '</span><div>' + s.c + '</div></div>'; }).join('') + '</details></div>';
}
function apRequestedFile(id, index, input) {
  var it = supFind(id); if (!it || it.kind !== 'deal' || it.cstatus !== 'awaiting_docs') return false;
  var entry = procDocRequestEntries(it)[index], file = apKeepFile(input && input.files && input.files[0]);
  if (!entry || entry.files.length || !file) return false;
  it.attachments.push(Object.assign(file, {by:'agent',at:'сейчас',requestedFor:entry.label,categoryLabel:entry.label})); entry.files.push(file.name);
  it.docRequest.items = it.docRequest.entries.filter(function(e) { return !e.files.length; }).map(function(e) { return e.label; });
  if (!it.docRequest.items.length) procSetStatus(id,'docs_uploaded','agent','Все запрошенные документы приложены.');
  openAutoassistant(it.policyIdx); return true;
}
function apRequestDocs(id) {
  var it = supFind(id), input = document.getElementById('ap-request-docs');
  if (!it || !['in_work','docs_uploaded'].includes(it.cstatus)) return false;
  var items = (input?.value || '').split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
  if (!items.length) { toast('Укажите, какие документы нужны.'); return false; }
  it.docRequest = {items: items}; procDocRequestEntries(it); it.cstatus = 'awaiting_docs';
  procApply(it,'support','Нужны документы: ' + items.map(procEscape).join('; ')); supUpdateBadge(); supRerender(); return true;
}
function apOperatorField(it, key, label, readonly) {
  return '<label class="ap-field">' + label + '<input class="tselect" value="' + procEscape(dealData(it)[key] || '') + '"' + (readonly ? ' readonly' : ' oninput="dealOpSet(\'' + it.id + '\',\'' + key + '\',this.value)"') + '></label>';
}
function apOperatorBody(it) {
  var c = CLIENTS[it.policyIdx], d = dealData(it), cs = it.cstatus, ready = ['in_work','docs_uploaded'].includes(cs), main = '', action = '';
  if (ready || cs === 'awaiting_payment' || cs === 'paid') {
    main = '<section class="card"><h3>' + (cs === 'paid' ? 'Готовый полис' : 'Оформление и оплата ОСАГО') + '</h3><div class="ap-fields">' + apOperatorField(it,'insurer','Страховая компания',false) + apOperatorField(it,'osagoPremium','Премия ОСАГО, ₽',false)
      + (cs === 'paid' ? apOperatorField(it,'policySeries','Серия полиса',false) + apOperatorField(it,'policyNumber','Номер полиса',false) : '<div class="ap-field-wide">' + apOperatorField(it,'paymentLink','Ссылка на оплату ОСАГО',false) + '</div>') + '</div>';
    if (cs === 'paid') main += ['policy','application'].map(function(type) { var f = d.policyFiles.find(function(f) { return f.type === type; }); return '<div class="ap-doc-row"><span>' + (type === 'policy' ? 'Полис ОСАГО' : 'Заявление на страхование') + (f ? '<div>' + apFileLink(f) + '</div>' : '') + '</span><label class="btn"><input class="ap-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onchange="dealPolicyFile(\'' + it.id + '\',\'' + type + '\',this)">' + (f ? 'Заменить' : 'Прикрепить') + '</label></div>'; }).join('') + '<div class="ap-submit"><button class="btn btn--primary" onclick="dealFinalize(\'' + it.id + '\')">Завершить оформление</button></div>';
    else main += '<div class="ap-submit"><button class="btn ' + (ready || it.payStale ? 'btn--primary' : '') + '" onclick="dealSendPayment(\'' + it.id + '\')">' + (cs === 'awaiting_payment' ? 'Обновить ссылку для агента' : 'Отправить ссылку агенту') + '</button></div>';
    main += '</section>';
  }
  if (cs === 'new' || cs === 'docs_uploaded') action += '<button class="btn btn--primary" onclick="procTake(\'' + it.id + '\')">Взять в работу</button>';
  if (cs === 'awaiting_payment') action += '<p>' + (it.payStale ? 'Агент запросил замену ссылки.' : 'Проверьте поступление оплаты ОСАГО ' + apRub(d.osagoPremium) + '.') + '</p><label class="ap-check"><input type="checkbox" id="ap-payment-checked"' + (it.payStale ? ' disabled' : '') + '>Оплата ОСАГО получена, я проверил платёж</label><button class="btn btn--primary" onclick="dealConfirmPayment(\'' + it.id + '\')"' + (it.payStale ? ' disabled' : '') + '>Подтвердить оплату ОСАГО</button>';
  if (cs === 'paid') action += '<p>Оплата подтверждена. Введите реквизиты, приложите полис и заявление, затем завершите оформление.</p>';
  if (cs === 'awaiting_docs') action += '<p>Ожидаем документы от агента.</p>';
  if (cs === 'done') action += '<p class="status-text ok">Полис оформлен</p><button class="btn" onclick="openContract(' + it.policyIdx + ',false)">Открыть договор</button>';
  if (ready) main += '<details class="card ap-history"><summary>Запросить недостающие документы</summary><label class="ap-field">Один документ на строку<textarea id="ap-request-docs" class="sup-ta" placeholder="Укажите документ и что нужно исправить"></textarea></label><button class="btn" onclick="apRequestDocs(\'' + it.id + '\')">Отправить запрос агенту</button></details>';
  main += '<section class="card"><h3>Документы заявки · ' + it.attachments.length + '</h3>' + apAttachments(it.attachments) + (it.reasonComment ? '<div class="ap-note"><strong>Комментарий агента</strong><p>' + procEscape(it.reasonComment) + '</p></div>' : '') + '</section>';
  main += '<section class="card"><h3>Переписка с агентом</h3>' + supTalk(it) + '</section><details class="card ap-history"><summary>Внутренняя заметка · агент не видит</summary><textarea id="supNoteA" class="sup-ta" aria-label="Внутренняя заметка"></textarea><button class="btn" onclick="supNote(\'' + it.id + '\')">Сохранить заметку</button></details>';
  var responsible = '<section class="card"><h3>Ответственный</h3><p>' + procEscape(it.resp || 'Не назначен') + '</p><select id="lossResp-' + it.id + '" class="tselect" aria-label="Ответственный"><option value="">Выберите сотрудника</option><option>Мария Словакова</option><option>Анастасия Уланова</option></select><button class="btn" onclick="lossAssign(\'' + it.id + '\')">Назначить</button></section>';
  return '<div class="ap-operator">' + apContext(c) + apTrack(c,it) + '<div class="ap-layout"><main>' + main + '</main><aside><section class="card ap-operator-actions"><h3>' + procEscape(procSupLabel(it)) + '</h3>' + action + '</section>' + apCosts(c,it) + apServiceDocumentHTML(c) + responsible + '</aside></div>' + supTimeline(it) + '<div class="ap-demo-footer">Прототип · <button class="ap-file-link" onclick="openAutoassistant(' + it.policyIdx + ')">Открыть вкладку АП со стороны агента →</button></div></div>';
}
