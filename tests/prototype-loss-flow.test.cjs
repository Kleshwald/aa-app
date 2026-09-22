'use strict';

// Run: node --test tests/prototype-loss-flow.test.cjs
// Executes real prototype functions in isolation. No browser, dependencies, network, or writes.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.resolve(__dirname, '../public/1c85-v4.html');
const source = fs.readFileSync(htmlPath, 'utf8');
let assertions = 0;
const clone = (value) => JSON.parse(JSON.stringify(value));
function equal(actual, expected, message) {
  assertions++;
  assert.deepStrictEqual(clone(actual), clone(expected), message);
}
function ok(value, message) { assertions++; assert.ok(value, message); }
function between(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Extraction anchors: ${start} / ${end}`);
  return source.slice(from, to);
}

const lossCode = [
  between('var CHANGE_REASONS=', '/* Причины расторжения'),
  between('var PROC_STATUS=', 'function procCreate(idx'),
  between('function procEscape(', '/* Поля по причинам'),
  between('var lossIdx=', '/* --- Прогресс заявки'),
  between('function procForPolicy(', 'function procAgentPay('),
  between('function procAgentSign(', 'function procReqNewLink('),
  between('function procToSK(', 'function procCancelDone('),
  between('function lossShowFiles(', '/* ===== Мои клиенты'),
  between('function supSetStatus(', 'function supSave('),
  between('var supOpen=null', 'function supFind('),
  between('function supDateNum(', 'function supSetSort('),
  between('function supPass(', 'function supDoSearch('),
].join('\n');

const FIXED_ISO = '2026-09-21T10:11:12.000Z';
const TODAY = FIXED_ISO.slice(0, 10);
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [FIXED_ISO])); }
  static now() { return Date.parse(FIXED_ISO); }
}
function decode(value) {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function fileInput(...names) { return { files: names.map((name) => ({ name })), value: '' }; }
function fieldControl(markup, label) {
  const fields = [...markup.matchAll(/<label(?:\s[^>]*)?>([^<]*)<\/label>\s*(<input\b[^>]*>|<select\b[^>]*>[\s\S]*?<\/select>)/g)];
  const field = fields.find((match) => decode(match[1]) === label);
  assert.ok(field, `Rendered control: ${label}`);
  return field[2];
}
function controlValue(control) {
  if (control.startsWith('<select')) {
    const option = [...control.matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)].find((match) => /\bselected\b/.test(match[1]));
    assert.ok(option, 'Selected option is explicitly retained');
    const value = option[1].match(/\bvalue="([^"]*)"/);
    return decode(value ? value[1] : option[2]);
  }
  const value = control.match(/\bvalue="([^"]*)"/);
  assert.ok(value, 'Rendered input value');
  return decode(value[1]);
}
function changeControl(ctx, control, value) {
  const handler = control.match(/\boninput="([^"]*)"/) || control.match(/\bonchange="([^"]*)"/);
  assert.ok(handler, 'Rendered control has an actual event handler');
  ctx.__testControl = { value, checked: Boolean(value) };
  try { vm.runInContext(`(function(){${decode(handler[1])}}).call(__testControl)`, ctx); }
  finally { delete ctx.__testControl; }
}
const clients = [
  { p: 'ОСАГО', num: 'ТЕСТ 000123', sk: 'Демо СК', n: 'Тестов Тест Тестович', o: 'Демо автомобиль', sub: 'А123ВС24', d: '01.02.2026', chat: 'unrelated-chat' },
  { p: 'НС', num: 'РРР 000456', sk: 'Демо СК', n: 'Тестова Анна Тестовна', o: 'Здоровье', sub: '', d: '02.02.2026' },
];

function setup(DateType = FixedDate) {
  const state = { html: '', elements: {}, toasts: [], contracts: [], discussions: [], payloads: [], renders: [], activeTab: {}, work: { scrollTop: 0 } };
  const ctx = {
    Date: DateType, CLIENTS: clone(clients), SUP: [], SV: [], SV_THREADS: {},
    SUP_BALL: { us: 'Поддержка', agent: 'Агент', insurer: 'Страховая', done: 'Завершено' },
    toast: (message) => state.toasts.push(message),
    supUpdateBadge() {}, updateBell() {}, supRerender() {}, svOnMessages: () => false,
    openContract: (index) => state.contracts.push(index),
    openDiscussion: (id) => state.discussions.push(id),
    document: {
      getElementById: (id) => id === 'activeTab' ? state.activeTab : id === 'work' ? state.work : state.elements[id] || null,
      querySelectorAll: () => [], querySelector: () => null,
    },
  };
  ctx.supFind = (id) => ctx.SUP.find((item) => item.id === id);
  ctx.svSyncFromCase = (row) => {
    const item = ctx.supFind(row.caseId);
    if (item) { row.st = item.cstatus; row.action = ctx.procIsAgentBall(item); row.act = ctx.caseVerb(item); }
  };
  ctx.render = (view, index) => {
    state.renders.push({ view, index });
    if (view !== 'lossw') return;
    state.html = ctx.screenLoss(); state.elements = {};
    for (const match of state.html.matchAll(/<textarea\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g)) {
      state.elements[match[1]] = { value: decode(match[2]), scrollIntoView() {} };
    }
    for (const match of state.html.matchAll(/<input\b([^>]*)>/g)) {
      const id = match[1].match(/\bid="([^"]+)"/), value = match[1].match(/\bvalue="([^"]*)"/);
      if (id) state.elements[id[1]] = { value: value ? decode(value[1]) : '', scrollIntoView() {} };
    }
  };
  vm.createContext(ctx); vm.runInContext(lossCode, ctx, { filename: htmlPath });
  const createCase = ctx.procCreateCase;
  ctx.procCreateCase = (...args) => { state.payloads.push(clone(args[2])); return createCase(...args); };
  function comment(value) {
    assert.ok(state.elements.lossComment, 'Rendered comment textarea');
    state.elements.lossComment.value = value;
  }
  function documents(index = 0) { ctx.openLoss(index); ctx.lossPickClaimant('owner'); ctx.lossNext(); return ctx; }
  function seed(kind = 'loss', extra = {}) {
    const id = String(16000 + ctx.SUP.length).padStart(9, '0');
    const item = Object.assign({ id, kind, vid: kind === 'loss' ? 'Урегулирование убытка' : kind === 'change' ? 'Внесение изменений' : 'Расторжение договора', cstatus: 'awaiting_docs', ball: 'agent', policyIdx: 0, reasons: [], attachments: [], steps: [], docRequest: { items: ['Паспорт', 'Реквизиты'] } }, clone(extra));
    ctx.SUP.push(item);
    ctx.SV.push({ id: 'thread-' + id, caseId: id, st: item.cstatus, holder: clients[0].n, unread: 0 });
    ctx.SV_THREADS['thread-' + id] = [];
    return item;
  }
  return { ctx, state, comment, documents, seed };
}

test('inline JS parses; loss entry starts with claimant and derives product from the contract', () => {
  const inline = source.match(/<script>([\s\S]*?)<\/script>/);
  ok(inline); new vm.Script(inline[1], { filename: htmlPath });
  const { ctx, state } = setup(); ctx.openLoss(0);
  equal(ctx.lossStep, 1); equal(ctx.lossClaimant, ''); equal(ctx.lossProduct, 'osago');
  equal(ctx.lossNext(), false, 'Claimant must be explicitly selected'); equal(ctx.lossStep, 1);
  ok(state.html.includes('Заявитель')); ok(state.html.includes('Собственник'));
  ok(!/name="lossProduct"|lossPickProduct\(|id="lossDate"|id="lossDesc"|lossProtocol|lossSecond|lossInjured/.test(state.html), 'No event questionnaire or product picker');
  ctx.openLoss(1); equal(ctx.lossProduct, 'health'); ok(state.html.includes('Застрахованный'));
  equal(ctx.lossDate, ''); equal(ctx.lossDesc, '');
});

test('OSAGO exposes nine document categories with a normal policy uploader; health exposes five', () => {
  const { ctx, state, documents } = setup(); documents();
  equal(ctx.lossDocumentList().map((document) => document.id), ['application', 'photos', 'passport', 'bank', 'vehicle', 'gibdd', 'notice', 'policy', 'other']);
  ok(state.html.includes("lossAddFile('policy',this)")); ok(!state.html.includes('Прикреплён автоматически'));
  equal(ctx.lossAddFile('policy', fileInput('полис.pdf')), true); equal(ctx.lossFiles.policy, ['полис.pdf']);
  documents(1); equal(ctx.lossDocumentList().map((document) => document.id), ['application', 'medical', 'passport', 'bank', 'other']);
  equal(ctx.lossAddFile('photos', fileInput('чужая-категория.jpg')), false); equal(ctx.lossFiles, {});
});

test('step two is available without date/description; Back retains claimant, comment and files', () => {
  const { ctx, state, comment } = setup(); ctx.openLoss(0); ctx.lossPickClaimant('proxy'); ctx.lossNext();
  equal(ctx.lossStep, 2); equal(ctx.lossErr, ''); equal(ctx.lossDate, ''); equal(ctx.lossDesc, '');
  const text = 'Комментарий <текст> & "кавычки"\n</textarea><b>файл</b>';
  comment(text); ctx.lossAddFile('passport', fileInput('Паспорт клиента.pdf')); ctx.lossPrev();
  equal(ctx.lossStep, 1); equal(ctx.lossClaimant, 'proxy'); equal(ctx.lossComment, text);
  equal(ctx.lossFiles.passport, ['Паспорт клиента.pdf']); ctx.lossNext();
  equal(state.elements.lossComment.value, text); ok(state.html.includes('&lt;/textarea&gt;'));
});

test('file picker cancellation never invents a document or replaces existing names', () => {
  const { ctx, documents } = setup(); documents();
  ctx.lossAddFile('passport', fileInput()); equal(ctx.lossFiles.passport || [], []);
  ctx.lossAddFile('passport', fileInput('passport.pdf')); const before = clone(ctx.lossFiles);
  ctx.lossAddFile('passport', fileInput()); equal(ctx.lossFiles, before);
  ctx.lossAddFile('passport', null); equal(ctx.lossFiles, before);
  ok(!Object.values(ctx.lossFiles).flat().includes('Документ.pdf'));
});

test('photos accumulate real filenames, remove one selected file and cannot exceed 30', () => {
  const { ctx, documents } = setup(); documents();
  ctx.lossAddFile('photos', fileInput('front.jpg', 'rear.jpg')); ctx.lossAddFile('photos', fileInput('side.jpg'));
  equal(ctx.lossFiles.photos, ['front.jpg', 'rear.jpg', 'side.jpg']);
  ctx.lossRemoveFile('photos', 1); equal(ctx.lossFiles.photos, ['front.jpg', 'side.jpg']);
  const before = clone(ctx.lossFiles.photos); ctx.lossRemoveFile('photos', 90); equal(ctx.lossFiles.photos, before);
  ctx.openLoss(0); ctx.lossPickClaimant('owner'); ctx.lossNext();
  const names = Array.from({ length: 30 }, (_, index) => `photo-${index + 1}.jpg`);
  ctx.lossAddFile('photos', fileInput(...names)); equal(ctx.lossFiles.photos, names);
  ctx.lossAddFile('photos', fileInput('photo-31.jpg')); equal(ctx.lossFiles.photos.length, 30);
  equal(ctx.lossFiles.photos, names, 'Exceeding limit does not replace existing photos');
});

test('documents page and summary do not claim compression, quality checks or fake completeness', () => {
  const { ctx, state, documents, seed } = setup(); documents(); ctx.lossAddFile('passport', fileInput('scan.pdf'));
  ok(!/сожм|сжато|файл читается|формат подходит|подготовлено для СК/i.test(state.html));
  const item = seed('loss', { cstatus: 'new', ball: 'us', docRequest: null, lossDate: '', lossDetails: { claimDate: TODAY } });
  const summary = ctx.lossSummary(item);
  ok(!/\d+\s*%/.test(summary)); ok(!/Комплектность/.test(summary));
});

test('submission keeps file categories, current claim date and optional event date separate', () => {
  const { ctx, state, comment, documents } = setup(); documents(); comment('Документы клиента');
  ctx.lossAddFile('passport', fileInput('паспорт.pdf')); ctx.lossAddFile('photos', fileInput('повреждение.jpg'));
  ctx.lossSubmit(); const item = ctx.SUP[0], payload = state.payloads[0];
  equal(ctx.lossStep, 3); ok(ctx.lossCreatedId); equal(ctx.SUP.length, 1);
  equal(item.cstatus, 'new'); equal(ctx.procAgentLabel(item), 'Проверка документов');
  equal(item.lossDetails.claimDate, TODAY); equal(item.lossDate, ''); equal(item.reasonComment, 'Документы клиента');
  equal([...payload.files].sort(), ['паспорт.pdf', 'повреждение.jpg']); equal(payload.lossDocuments.length, 2);
  equal(payload.lossDocuments.map((document) => document.category).sort(), ['passport', 'photos']);
  ok(payload.lossDocuments.every((document) => document.categoryLabel && document.name));
  equal(item.attachments.map((document) => document.category).sort(), ['passport', 'photos']);
  equal(item.attachments.map((document) => document.categoryLabel), payload.lossDocuments.map((document) => document.categoryLabel));
  equal(ctx.SV[0].caseId, item.id); ok(state.html.includes(item.id));
  ok(state.html.includes(`procOpenDiscussion('${item.id}')`), 'Success button targets created case');
});

test('event date is not overwritten by submission date or by saving operator data', () => {
  const { ctx, documents } = setup(); documents(); ctx.lossDate = '2026-08-15'; ctx.lossSubmit();
  const item = ctx.SUP[0]; equal(item.lossDate, '2026-08-15'); equal(item.lossDetails.claimDate, TODAY);
  ctx.lossOpSet(item.id, 'claimDate', '2026-09-19'); ctx.lossOpSave(item.id);
  equal(item.lossDate, '2026-08-15'); equal(item.lossDetails.claimDate, '2026-09-19');
  const summary = ctx.lossSummary(item); ok(summary.includes('2026-08-15') || summary.includes('15.08.2026'));
  const noEvent = clone(item); noEvent.lossDate = '';
  const eventField = ctx.lossSummary(noEvent).match(/<label>Дата события<\/label><div[^>]*>([\s\S]*?)<\/div>/);
  ok(!eventField || (!eventField[1].includes('2026-09-19') && !eventField[1].includes('19.09.2026')), 'Claim date is not labelled event date');
  ok(!ctx.lossOpBlock(item).includes('Дата события / заявления'), 'Operator dates have distinct meaning');
});

test('support date normalization accepts ISO and dotted dates and rejects impossible calendar days', () => {
  const { ctx } = setup();
  for (const [value, expected] of [
    ['2026-09-21', '2026-09-21'], [' 21.09.2026 ', '2026-09-21'],
    ['21.09.2026 13:11', '2026-09-21'], ['29.02.2024', '2024-02-29'],
    ['2024-02-29', '2024-02-29'],
    ['29.02.2026', ''], ['2026-02-29', ''], ['2026-02-30', ''],
    ['31.04.2026', ''], ['2026-13-01', ''], ['2026-00-01', ''],
    ['2026-01-00', ''], ['2026-01-32', ''], ['21.09.2026wrong', ''],
    ['2026-09-21T00:00:00Z', ''], ['not a date', ''], ['', ''], [null, ''],
  ]) equal(ctx.lossDateISO(value), expected, String(value));
  equal(ctx.lossDisplayDate('2026-09-21'), '21.09.2026');
  equal(ctx.lossDisplayDate(''), 'Не указана');
});

test('operator screen retains screenshot fields and edited values without changing case or event status', () => {
  const { ctx, seed } = setup();
  const item = seed('loss', { cstatus: 'under_review', ball: 'insurer', date: '17.09.2026 12:00', lossDate: '2026-09-01', owner: 'Исходный собственник', obj: 'Демо ТС <123>' });
  let markup = ctx.lossOpBlock(item);
  equal(controlValue(fieldControl(markup, 'Собственник')), 'Исходный собственник');
  equal(controlValue(fieldControl(markup, 'Дата заявления')), '2026-09-17');
  ok(markup.includes('<label>Транспортное средство</label>')); ok(markup.includes('Демо ТС &lt;123&gt;'));
  ok(markup.includes('Соглашение и выплата'));
  const edits = [
    ['Заявитель', 'applicant', 'representative'],
    ['Собственник', 'owner', 'Тестов Новый Тестович "А"'],
    ['Дата заявления', 'claimDate', '2026-09-18'],
    ['Номер убытка', 'claimNumber', 'У-009'],
    ['Тип убытка', 'claimType', 'secondary'],
    ['Признак убытка', 'claimSign', 'classic'],
    ['Тип осмотра', 'inspectionType', 'field'],
    ['Дата соглашения от СК', 'insurerAgreementDate', '2026-09-19'],
    ['Дата соглашения от агента', 'agentAgreementDate', '2026-09-20'],
    ['Фактическая дата выплаты', 'paymentDate', '2026-09-21'],
    ['Сумма выплаты, ₽', 'payoutAmount', '12 345,67'],
    ['Внутренняя заметка по убытку', 'note', '<проверка> & "заметка"'],
  ];
  for (const [label, key, value] of edits) {
    changeControl(ctx, fieldControl(markup, label), value);
    equal(item.lossDetails[key], value, `Handler persists ${key}`);
  }
  for (const key of ['rs', 'go']) {
    const checkbox = [...markup.matchAll(/<input\b[^>]*>/g)].find((match) => match[0].includes(`'${key}',this.checked`));
    ok(checkbox, `${key} checkbox`); changeControl(ctx, checkbox[0], true);
    equal(item.lossDetails[key], true);
  }
  ctx.lossOpSave(item.id); markup = ctx.lossOpBlock(item);
  for (const [label, , value] of edits) equal(controlValue(fieldControl(markup, label)), value, `Rerender retains ${label}`);
  equal((markup.match(/type="checkbox" checked/g) || []).length, 2);
  equal(item.cstatus, 'under_review'); equal(item.ball, 'insurer'); equal(item.lossDate, '2026-09-01');
  ok(!item.payoutConfirmed); ok(item.steps.at(-1).internal);
  ok(markup.includes('&lt;проверка&gt; &amp; &quot;заметка&quot;'));
  const health = seed('loss', { policyIdx: 1, lossProduct: 'health' });
  const healthMarkup = ctx.lossOpBlock(health);
  ok(healthMarkup.includes('Застрахованный')); ok(!healthMarkup.includes('id="lossOwner"'));
  ok(!healthMarkup.includes('<label>Транспортное средство</label>'));
  for (const label of ['Признак убытка', 'Дополнительные признаки', 'Тип осмотра']) ok(!healthMarkup.includes('<label>'+label+'</label>'));
  ctx.lossComplaint(health.id);
  ok(!ctx.lossComplaintBlock(health).includes('Тип осмотра'));
});

test('complaint screen preserves all eight screenshot fields, selected status and separate complaint values', () => {
  const { ctx, seed } = setup(); const item = seed('loss', { cstatus: 'under_review', ball: 'insurer' });
  ctx.lossComplaint(item.id); ctx.lossComplaint(item.id);
  equal(item.lossDetails.complaints.length, 2); equal(item.cstatus, 'under_review'); equal(item.ball, 'insurer');
  const second = clone(item.lossDetails.complaints[1]);
  const edits = [
    ['Тип осмотра', 'inspectionType', 'client_independent'],
    ['Номер убытка', 'claimNumber', 'П-002'],
    ['Дата заявления', 'date', '2026-09-15'],
    ['Сумма доплаты, ₽', 'amount', '2 500,25'],
    ['Дата соглашения от СК', 'insurerAgreementDate', '2026-09-17'],
    ['Дата соглашения от агента', 'agentAgreementDate', '2026-09-18'],
    ['Дата оплаты', 'paymentDate', '2026-09-19'],
    ['Статус', 'status', 'На рассмотрении'],
    ['Заметка', 'reason', '<претензия> & "сумма"'],
  ];
  const initialMarkup = ctx.lossComplaintBlock(item);
  equal(controlValue(fieldControl(initialMarkup, 'Статус')), 'Новая');
  for (const [label, key, value] of edits) {
    changeControl(ctx, fieldControl(initialMarkup, label), value);
    equal(item.lossDetails.complaints[0][key], value);
  }
  ctx.lossOpSave(item.id);
  const markup = ctx.lossComplaintBlock(item);
  for (const [label, , value] of edits) equal(controlValue(fieldControl(markup, label)), value, `Complaint rerender retains ${label}`);
  equal(item.lossDetails.complaints[1], second, 'Editing first complaint does not overwrite second');
  equal(item.cstatus, 'under_review'); equal(item.ball, 'insurer'); ok(!item.payoutConfirmed);
  ok(markup.includes('&lt;претензия&gt; &amp; &quot;сумма&quot;'));
  for (const status of ['Новая', 'На рассмотрении', 'Удовлетворена', 'Отказ']) {
    changeControl(ctx, fieldControl(ctx.lossComplaintBlock(item), 'Статус'), status);
    equal(controlValue(fieldControl(ctx.lossComplaintBlock(item), 'Статус')), status);
    equal(item.cstatus, 'under_review', 'Complaint status is not the overall case status');
  }
  ctx.lossComplaintSet(item.id, 0, 'date', '15.09.2026');
  equal(controlValue(fieldControl(ctx.lossComplaintBlock(item), 'Дата заявления')), '2026-09-15');
});

test('support upload uses actual filenames, keeps requested documents and leaves status unchanged', () => {
  const { ctx, seed } = setup(); const item = seed('loss'); const original = clone(item);
  equal(ctx.lossSupportUpload(item.id, fileInput()), false); equal(item, original);
  equal(ctx.lossSupportUpload(item.id, null), false); equal(item, original);
  equal(ctx.lossSupportUpload('missing', fileInput('missing.pdf')), false);
  const other = seed('change'); const otherBefore = clone(other);
  equal(ctx.lossSupportUpload(other.id, fileInput('wrong-process.pdf')), false); equal(other, otherBefore);
  equal(ctx.lossSupportUpload(item.id, fileInput('реальный скан.pdf', 'осмотр <1>.jpg')), true);
  equal(item.attachments.map((file) => file.name), ['реальный скан.pdf', 'осмотр <1>.jpg']);
  ok(item.attachments.every((file) => file.by === 'support'));
  equal(item.docRequest, original.docRequest); equal(item.cstatus, 'awaiting_docs'); equal(item.ball, 'agent');
  ok(item.steps.at(-1).internal); ok(!item.payoutConfirmed);
  const uploaded = clone(item); equal(ctx.lossSupportUpload(item.id, fileInput()), false); equal(item, uploaded);
  equal(ctx.lossSupportUpload(item.id, fileInput('дополнение.pdf')), true);
  equal(item.attachments.map((file) => file.name), ['реальный скан.pdf', 'осмотр <1>.jpg', 'дополнение.pdf']);
  equal(item.cstatus, 'awaiting_docs'); equal(item.ball, 'agent');
});

test('show-files navigation scrolls only to the requested case attachment section', () => {
  const { ctx, state, seed } = setup(); const first = seed(), second = seed(); const calls = [];
  for (const item of [first, second]) state.elements['lossFiles-' + item.id] = { scrollIntoView: (options) => calls.push({ id: item.id, options }) };
  ctx.lossShowFiles(second.id);
  equal(calls, [{ id: second.id, options: { behavior: 'smooth', block: 'center' } }]);
  ctx.lossShowFiles('missing'); equal(calls.length, 1);
});

test('submission requires step two and explicit acceptance of an existing-loss warning', () => {
  const { ctx, seed } = setup(); ctx.openLoss(0); ctx.lossSubmit(); equal(ctx.SUP.length, 0);
  seed('loss', { cstatus: 'new', docRequest: null }); ctx.openLoss(0); equal(ctx.lossDuplicateAccepted, false);
  ctx.lossStep = 2; ctx.lossSubmit(); equal(ctx.SUP.length, 1, 'Direct invocation cannot bypass duplicate warning');
  ctx.lossDuplicateAccepted = true; ctx.lossPickClaimant('owner'); ctx.lossSubmit(); equal(ctx.SUP.length, 2);
  const created = ctx.lossCreatedId; ctx.lossSubmit(); ctx.lossStep = 2; ctx.lossSubmit();
  equal(ctx.SUP.length, 2); equal(ctx.lossCreatedId, created, 'Created-id guard prevents duplicate submit');
});

test('new loss request resets fields, files, claimant and created id', () => {
  const { ctx, comment, documents } = setup(); documents(); ctx.lossClaimant = 'proxy'; comment('Комментарий');
  ctx.lossAddFile('passport', fileInput('passport.pdf')); ctx.lossSubmit();
  ctx.openLoss(1); equal(ctx.lossStep, 1); equal(ctx.lossProduct, 'health'); equal(ctx.lossClaimant, '');
  equal(ctx.lossFiles, {}); equal(ctx.lossComment, ''); equal(ctx.lossCreatedId, ''); equal(ctx.lossDate, ''); equal(ctx.lossDesc, '');
});

test('new loss, change and cancel cases are dated locally and visible in month and today queues', () => {
  // Simulate UTC+03 at the year boundary independently of the machine timezone.
  class LocalBoundaryDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-12-31T21:30:00.000Z'])); }
    static now() { return Date.parse('2026-12-31T21:30:00.000Z'); }
    getFullYear() { return 2027; }
    getMonth() { return 0; }
    getDate() { return 1; }
  }
  for (const DateType of [FixedDate, LocalBoundaryDate]) {
    const { ctx, seed } = setup(DateType); const now = new DateType();
    const day = String(now.getDate()).padStart(2, '0'), month = String(now.getMonth() + 1).padStart(2, '0');
    const expectedDate = `${day}.${month}.${now.getFullYear()}`;
    const old = seed('loss', { date: '21.08.2026' });
    for (const kind of ['loss', 'change', 'cancel']) {
      const id = ctx.procCreateCase(0, kind, { what: 'Тест новой заявки', stay: true }); const item = ctx.supFind(id);
      equal(item.date, expectedDate, `${kind} uses local creation day`);
      ctx.supPeriod = 'month'; equal(ctx.supPass(item), true, `${kind} visible this month`);
      ctx.supPeriod = 'today'; equal(ctx.supPass(item), true, `${kind} visible today`);
      if (kind === 'loss') equal(item.lossDetails.claimDate, `${now.getFullYear()}-${month}-${day}`);
    }
    equal(old.date, '21.08.2026', 'Creating new cases does not rewrite legacy fixture dates');
  }
});

test('queue periods exclude previous months and other days while all-time retains old fixtures', () => {
  const { ctx, seed } = setup();
  const dates = ['21.09.2026', '20.09.2026', '21.08.2026', '21.09.2025', '31.12.2025'];
  const items = dates.map((date) => seed('loss', { date }));
  ctx.supPeriod = 'month'; equal(items.filter(ctx.supPass).map((item) => item.date), ['21.09.2026', '20.09.2026']);
  ctx.supPeriod = 'today'; equal(items.filter(ctx.supPass).map((item) => item.date), ['21.09.2026']);
  ctx.supPeriod = 'all'; equal(items.filter(ctx.supPass).map((item) => item.date), dates);
  equal(items.map((item) => item.date), dates, 'Period filtering is read-only');
});

test('period filters still compose with source, insurer, task, responsible, region, API, search and completed filters', () => {
  const { ctx } = setup();
  const id = ctx.procCreateCase(0, 'loss', { what: 'Тест фильтров', stay: true }); const item = ctx.supFind(id);
  Object.assign(item, { resp: 'Тестовый Оператор', api: true });
  const matching = { supSrc: '1c', supSK: item.sk, supTask: item.type, supResp: item.resp, supRegion: item.region, supApi: true, supQ: 'тестов', supHideDone: true };
  for (const period of ['month', 'today', 'all']) {
    Object.assign(ctx, matching, { supPeriod: period }); equal(ctx.supPass(item), true, `${period}: matching constraints`);
    for (const [key, value] of [['supSrc', 'chat'], ['supSK', 'Другая СК'], ['supTask', 'Другая задача'], ['supResp', 'Другой оператор'], ['supRegion', 'Другой регион'], ['supQ', 'нет такого клиента']]) {
      ctx[key] = value; equal(ctx.supPass(item), false, `${period}: ${key} still excludes`); ctx[key] = matching[key];
    }
    item.api = false; equal(ctx.supPass(item), false, `${period}: API restriction`); item.api = true;
    item.ball = 'done'; equal(ctx.supPass(item), false, `${period}: completed restriction`);
    ctx.supHideDone = false; equal(ctx.supPass(item), true, `${period}: completed cases can be shown`);
    item.ball = 'us'; ctx.supHideDone = true;
  }
});

test('discussion opens by case id even when the same contract has several requests', () => {
  const { ctx, state, seed } = setup(); const first = seed('loss'), second = seed('change');
  ctx.CLIENTS[0].chat = 'thread-' + second.id;
  equal(ctx.procCaseDiscussion(first.id).id, 'thread-' + first.id);
  equal(ctx.procOpenDiscussion(first.id), true); equal(state.discussions, ['thread-' + first.id]);
  equal(ctx.procOpenDiscussion('missing'), false); equal(state.discussions.length, 1);
  const cards = ctx.procActiveReq(0);
  ok(cards.includes(`procOpenDiscussion('${first.id}')`)); ok(cards.includes(`procOpenDiscussion('${second.id}')`));
});

for (const kind of ['loss', 'change', 'cancel']) {
  test(`partial document upload retains remaining positions and agent action for ${kind}`, () => {
    const { ctx, seed } = setup(); const item = seed(kind); const entries = ctx.procDocRequestEntries(item), key = item.docRequest.key;
    equal(entries.length, 2);
    equal(ctx.procAgentUpload(item.id, 0, fileInput('passport.pdf'), key), true);
    equal(item.cstatus, 'awaiting_docs'); equal(item.ball, 'agent'); equal(item.docRequest.items, ['Реквизиты']);
    equal(item.attachments[0].requestedFor, 'Паспорт'); equal(item.attachments[0].requestKey, key);
    equal(ctx.procCaseDiscussion(item.id).action, true);
    equal(ctx.procAgentUpload(item.id, 0, fileInput('duplicate.pdf'), key), false);
    equal(ctx.procAgentUpload(item.id, 1, fileInput('bank.pdf'), key), true);
    equal(item.cstatus, 'docs_uploaded'); equal(item.ball, 'us'); equal(item.docRequest, null);
    equal(item.attachments.map((file) => file.name), ['passport.pdf', 'bank.pdf']);
  });
}

test('empty, invalid and stale requested-document uploads are no-ops', () => {
  const { ctx, seed } = setup(); const item = seed(); ctx.procDocRequestEntries(item); const key = item.docRequest.key;
  equal(ctx.procAgentUpload(item.id, 0, fileInput(), key), false);
  equal(ctx.procAgentUpload(item.id, 99, fileInput('wrong.pdf'), key), false);
  equal(ctx.procAgentUpload(item.id, 0, fileInput('wrong.pdf'), 'old-key'), false); equal(item.attachments, []);
  item.docRequest = { items: ['Новый документ'] }; ctx.procDocRequestEntries(item);
  ok(item.docRequest.key !== key); equal(ctx.procAgentUpload(item.id, 0, fileInput('stale.pdf'), key), false);
  equal(item.docRequest.items, ['Новый документ']); equal(item.attachments, []);
});

function readyLoss(seed, extra = {}) {
  return seed('loss', Object.assign({
    cstatus: 'signed', ball: 'us', docRequest: null,
    attachments: [{ name: 'agreement.pdf', agreement: true, current: true }],
    lossDetails: { claimNumber: 'У-001', payoutAmount: '10 500,50', paymentDate: '2026-09-20', claimDate: TODAY },
  }, extra));
}

test('signed agreement returns to support without claiming that payment has occurred', () => {
  const { ctx, seed } = setup();
  const item = readyLoss(seed, { cstatus: 'signing', ball: 'agent', lossDetails: { claimNumber: 'У-001', payoutAmount: '', paymentDate: '' } });
  ctx.procAgentSign(item.id); equal(item.cstatus, 'signed'); equal(item.ball, 'us'); ok(!item.payoutConfirmed);
  ctx.procSettle(item.id); equal(item.cstatus, 'signed'); ok(!item.payoutConfirmed);
});

test('attaching an agreement retains previous versions and only one current version', () => {
  const { ctx, seed } = setup(); const item = readyLoss(seed);
  ctx.lossAgreement(item.id); equal(item.attachments.length, 2);
  equal(item.attachments.filter((file) => file.agreement && file.current).length, 1);
  equal(item.attachments[0].current, false); equal(item.attachments[0].name, 'agreement.pdf');
});

test('generic completion cannot bypass signed agreement and confirmed-payout guards', () => {
  const { ctx, seed } = setup(); const item = readyLoss(seed);
  equal(ctx.procSetStatus(item.id, 'done', 'support'), false); equal(item.cstatus, 'signed');
  equal(ctx.procSetStatus(item.id, 'settled', 'support'), false); equal(item.cstatus, 'signed');
  ctx.supSetStatus(item.id, 'Завершена'); equal(item.cstatus, 'signed'); equal(item.ball, 'us');
  item.cstatus = 'under_review'; ctx.procSettle(item.id); equal(item.cstatus, 'under_review'); ok(!item.payoutConfirmed);
});

test('payout needs current agreement, claim number, positive amount, real date and closed document request', () => {
  const { ctx, seed } = setup();
  const variants = [
    { attachments: [] }, { attachments: [{ name: 'old.pdf', agreement: true, current: false }] },
    { docRequest: { items: ['Не приложено'] } },
  ];
  for (const variant of variants) {
    const item = readyLoss(seed, variant); ok(ctx.lossCloseChecks(item).length > 0); ctx.procSettle(item.id); equal(item.cstatus, 'signed');
  }
  for (const [field, value] of [['claimNumber', ''], ['payoutAmount', '0'], ['payoutAmount', '-1'], ['payoutAmount', 'abc'], ['paymentDate', '2026-02-30'], ['paymentDate', '2099-01-01']]) {
    const item = readyLoss(seed); item.lossDetails[field] = value;
    ok(ctx.lossCloseChecks(item).length > 0, `${field}: ${value}`); ctx.procSettle(item.id); equal(item.cstatus, 'signed');
  }
});

test('support can confirm a valid payout once and preserve the final state', () => {
  const { ctx, seed } = setup(); const item = readyLoss(seed);
  equal(ctx.lossCloseChecks(item), []); ctx.procSettle(item.id);
  equal(item.cstatus, 'settled'); equal(item.ball, 'done'); equal(item.payoutConfirmed, true); equal(item.payoutConfirmedAt, FIXED_ISO);
  const historyLength = item.steps.length; ctx.procSettle(item.id); equal(item.steps.length, historyLength);
});

after(() => console.log(`Loss regression: ${assertions} explicit assertions executed, plus extraction and DOM checks.`));
