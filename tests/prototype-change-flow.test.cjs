'use strict';

// Run from any directory: node --test /path/to/aa-app/tests/prototype-change-flow.test.cjs
// No browser, dependencies, network, or writes. Test the actual inline prototype code.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.resolve(__dirname, '../public/1c85-v4.html');
const source = fs.readFileSync(htmlPath, 'utf8');
let assertions = 0;

function equal(actual, expected, message) {
  assertions++;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), message);
}

function ok(value, message) {
  assertions++;
  assert.ok(value, message);
}

function between(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Prototype extraction anchors: ${start} / ${end}`);
  return source.slice(from, to);
}

// Only reasons, shared case creation/status helpers used by VI, and the VI wizard.
// Cancellation, claims, new-policy calculations, queue rendering and boot code are not run.
const changeCode = [
  between('var CHANGE_REASONS=', '/* Причины расторжения'),
  between('function reasonNeeds(', '/* cstatus'),
  between('var PROC_STATUS=', 'function procSetStatus('),
  between('function procGenNo(', '/* --- Визард расторжения'),
  between('function procReasonsBlock(', 'function lossSortFiles('),
].join('\n');

const sampleClient = {
  p: 'ОСАГО', num: 'ТЕСТ 000123', sk: 'Демо СК', n: 'Тестов Тест Тестович',
  o: 'Демо автомобиль', sub: 'А123ВС24', d: '01.02.2026', price: '10 000',
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function decode(value) {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function attr(attributes, name) {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return match ? decode(match[1]) : undefined;
}

function setup() {
  const state = { html: '', elements: {}, opened: [], toasts: [], work: { scrollTop: 0 }, activeTab: {} };
  const ctx = {
    CLIENTS: [clone(sampleClient)], SUP: [], SV: [], SV_THREADS: {},
    toast: (message) => state.toasts.push(message),
    supUpdateBadge() {}, updateBell() {}, svOnMessages: () => false,
    openContract: (index) => state.opened.push(index),
    document: {
      getElementById: (id) => id === 'activeTab' ? state.activeTab : id === 'work' ? state.work : state.elements[id] || null,
      querySelectorAll: () => [],
      querySelector: (selector) => selector === '.chg-err' && state.html.includes('chg-err') ? { scrollIntoView() {} } : null,
    },
  };
  ctx.supFind = (id) => ctx.SUP.find((item) => item.id === id);
  ctx.svSyncFromCase = (row) => {
    const item = ctx.supFind(row.caseId);
    if (item) row.st = item.cstatus;
  };
  ctx.render = (view) => {
    assert.equal(view, 'change', 'Wizard renders only the VI view');
    state.html = ctx.screenChange();
    state.elements = {};
    function register(attributes, value, decoded = false) {
      const id = attr(attributes, 'id');
      if (!id) return;
      state.elements[id] = {
        value: decoded ? (value || '') : decode(value || ''), checked: /(?:^|\s)checked(?:\s|$)/.test(attributes),
        readOnly: /(?:^|\s)readonly(?:\s|$)/.test(attributes),
        disabled: /(?:^|\s)disabled(?:\s|$)/.test(attributes),
        oninput: attr(attributes, 'oninput'), onchange: attr(attributes, 'onchange'),
        scrollIntoView() {},
      };
    }
    for (const match of state.html.matchAll(/<input\b([^>]*)>/g)) register(match[1], attr(match[1], 'value'), true);
    for (const match of state.html.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) register(match[1], match[2]);
    for (const match of state.html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
      const options = [...match[2].matchAll(/<option([^>]*)>(.*?)<\/option>/g)];
      const selected = options.find((option) => option[1].includes('selected')) || options[0];
      register(match[1], selected ? selected[2] : '');
    }
    if (state.html.includes('id="changeFormError"')) state.elements.changeFormError = { scrollIntoView() {} };
  };
  vm.createContext(ctx);
  vm.runInContext(changeCode, ctx, { filename: htmlPath });
  function input(id, value, eventName = 'input') {
    const element = state.elements[id];
    assert.ok(element, `Rendered control ${id}`);
    assert.ok(!element.disabled && !element.readOnly, `Editable control ${id}`);
    const handler = element[`on${eventName}`];
    assert.ok(handler, `Real ${eventName} handler on ${id}`);
    if (typeof value === 'boolean') element.checked = value;
    else element.value = value;
    ctx.__eventTarget = element;
    vm.runInContext(`(function(){${handler}}).call(__eventTarget)`, ctx);
  }
  function open(reasons = []) {
    ctx.openChange(0);
    reasons.forEach((reason) => ctx.changeToggle(reason));
  }
  function proposal() {
    return ctx.changeProposal(ctx.changeOriginal, ctx.changeDraft, Object.keys(ctx.changeSel));
  }
  return { ctx, state, input, open, proposal };
}

test('the full inline script parses and all 12 reasons expose the intended controls', () => {
  const inline = source.match(/<script>([\s\S]*?)<\/script>/);
  ok(inline, 'Inline script exists');
  new vm.Script(inline[1], { filename: htmlPath });
  const { ctx } = setup();
  equal(ctx.CHANGE_REASONS.length, 12, 'Twelve original reasons retained');
  const fields = {
    'replace-plate-sts': 'plate', 'change-owner': 'ownerName', 'owner-name': 'ownerName',
    'policyholder-name': 'policyholderName', 'policyholder-doc': 'policyholderDocNumber',
    'owner-doc': 'ownerDocNumber', 'with-trailer': 'withTrailer',
    'unlimited-drivers': 'unlimitedDrivers', 'policy-error': 'vin',
  };
  Object.entries(fields).forEach(([reason, field]) => ok(ctx.changeFieldAllowed([reason], field), reason));
  ok(ctx.changeDriverAllowed(['add-driver'], { added: true }, 'fullName'), 'New-driver fields');
  ok(ctx.changeDriverAllowed(['replace-license'], {}, 'licenseNumber'), 'Existing VU number');
  ok(ctx.changeDriverAllowed(['replace-license'], {}, 'licenseDate'), 'Existing VU date');
  equal(ctx.changeDriverAllowed(['replace-license'], {}, 'fullName'), false, 'VU reason does not change name');
  equal(ctx.changeFieldAllowed(['remove-driver'], 'plate'), false, 'Removal does not change vehicle');
});

test('snapshot distinguishes card facts from demo values and matches the displayed demo term', () => {
  const { ctx, open } = setup(); open();
  equal(ctx.changeOriginal.fields.plate, sampleClient.sub);
  equal(ctx.changeOriginal.fields.vehicleModel, sampleClient.o);
  equal(ctx.changeOriginal.fields.policyholderName, sampleClient.n);
  ['vin', 'year', 'power', 'startDate', 'endDate', 'ownerName'].forEach((key) => ok(ctx.changeOriginal.demoFields.includes(key), `${key} is demo`));
  equal(ctx.changeOriginal.fields.startDate, '', 'List date is not the insurance start date');
  equal(ctx.changeOriginal.fields.endDate, '', 'Unknown expiry stays empty');
  equal(ctx.changeOriginal.driversAreDemo, true);
  ctx.changeDraft.fields.plate = 'ЧЕРНОВИК';
  equal(ctx.changeOriginal.fields.plate, sampleClient.sub, 'Original independent from draft');
  equal(ctx.CLIENTS[0], sampleClient, 'Opening and editing do not mutate contract');
});

test('unknown SLA is not rendered as a made-up deadline or NaN', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(between('function supFmt(', '\nfunction supSla(') + '\n' + between('function supSla(', '\nfunction sup'), ctx);
  [undefined, null, NaN, Infinity, '30'].forEach((sla) => equal(ctx.supSla({ball:'us',sla}), '', 'Unknown SLA hidden'));
  ok(ctx.supSla({ball:'us',sla:30}).includes('SLA 30 мин'), 'Existing finite SLA is unchanged');
  ok(ctx.supSla({ball:'us',sla:-10}).includes('Просрочено на 10 мин'), 'Existing overdue SLA is unchanged');
});

test('selected field changes are projected; all unrelated values retain the snapshot', () => {
  const { ctx, open } = setup(); open();
  const pairs = [
    ['replace-plate-sts', 'plate'], ['replace-plate-sts', 'vehicleDocNumber'], ['replace-plate-sts', 'vehicleDocDate'],
    ['owner-name', 'ownerName'], ['policyholder-name', 'policyholderName'], ['owner-doc', 'ownerDocNumber'],
    ['policyholder-doc', 'policyholderDocNumber'], ['change-owner', 'ownerAddress'],
    ['with-trailer', 'withTrailer'], ['unlimited-drivers', 'unlimitedDrivers'], ['policy-error', 'vin'],
  ];
  pairs.forEach(([reason, field]) => {
    const draft = ctx.changeClone(ctx.changeOriginal);
    draft.fields[field] = typeof draft.fields[field] === 'boolean' ? true : 'Новое значение';
    const proposed = ctx.changeProposal(ctx.changeOriginal, draft, [reason]);
    equal(proposed.fields[field], draft.fields[field], `${reason}: edited value`);
    equal(ctx.changeDraftErrors(ctx.changeOriginal, proposed), [], `${reason}: valid proposal`);
  });
  const draft = ctx.changeClone(ctx.changeOriginal);
  draft.fields.plate = 'НОВЫЙ'; draft.fields.policyholderName = 'Не выбранное изменение';
  draft.drivers[0].licenseNumber = 'Не выбранное ВУ';
  const proposed = ctx.changeProposal(ctx.changeOriginal, draft, ['replace-plate-sts']);
  equal(proposed.fields.policyholderName, ctx.changeOriginal.fields.policyholderName);
  equal(proposed.drivers, ctx.changeOriginal.drivers);
});

test('driver addition, deletion and VU replacement work alone and together', () => {
  const { ctx, open } = setup(); open();
  const draft = ctx.changeClone(ctx.changeOriginal);
  draft.drivers[0].licenseNumber = '12 34 567890'; draft.drivers[1].removed = true;
  draft.drivers.push({ id: 'driver-3', added: true, fullName: 'Новый Тестовый Водитель', licenseNumber: '99 88 777777' });
  let proposed = ctx.changeProposal(ctx.changeOriginal, draft, ['replace-license']);
  equal(proposed.drivers.length, 2); equal(proposed.drivers[0].licenseNumber, '12 34 567890');
  proposed = ctx.changeProposal(ctx.changeOriginal, draft, ['remove-driver']);
  equal(proposed.drivers.length, 1); equal(proposed.drivers[0].licenseNumber, ctx.changeOriginal.drivers[0].licenseNumber);
  proposed = ctx.changeProposal(ctx.changeOriginal, draft, ['add-driver']);
  equal(proposed.drivers.length, 3); equal(proposed.drivers[2].fullName, 'Новый Тестовый Водитель');
  proposed = ctx.changeProposal(ctx.changeOriginal, draft, ['add-driver', 'remove-driver', 'replace-license']);
  equal(proposed.drivers.length, 2); equal(proposed.drivers[0].licenseNumber, '12 34 567890');
  equal(proposed.drivers[1].id, 'driver-3'); equal(Object.hasOwn(proposed.drivers[1], 'added'), false, 'UI flags not submitted');
});

test('step one cannot submit: reason is required and direct legacy submit only opens step two', () => {
  const { ctx, open, state } = setup(); open();
  ctx.changeSubmit(); equal(ctx.SUP.length, 0); equal(ctx.changeStep, 1); equal(ctx.changeErr, true);
  ctx.changeToggle('replace-plate-sts'); ctx.changeSubmit();
  equal(ctx.changeStep, 2); equal(ctx.SUP.length, 0);
  ok(state.html.includes('id="change-plate"')); ok(state.html.includes('id="change-vehicleDocNumber"'));
});

test('rendered input handlers preserve comments, files and structured edits across Back', () => {
  const { ctx, state, input, open } = setup(); open(['replace-plate-sts']);
  const comment = 'Новый ГРЗ <А001> & "СТС"\n</textarea><b>текст</b>';
  input('changeComment', comment);
  ctx.changeToggle('with-trailer'); equal(state.elements.changeComment.value, comment, 'Reason rerender');
  ctx.changeAddFile(); equal(state.elements.changeComment.value, comment, 'File rerender');
  ctx.changeNext(); input('change-plate', 'А001АА24'); input('change-vehicleDocNumber', '12 34 567890');
  input('change-withTrailer', true, 'change'); ctx.changeBack();
  equal(state.elements.changeComment.value, comment); equal(ctx.changeFiles.length, 1);
  ctx.changeNext(); equal(state.elements['change-plate'].value, 'А001АА24');
  equal(state.elements['change-vehicleDocNumber'].value, '12 34 567890'); equal(state.elements['change-withTrailer'].checked, true);
  ok(state.html.includes('&lt;/textarea&gt;&lt;b&gt;текст&lt;/b&gt;'), 'Comment escapes markup');
  equal(state.elements['change-ownerName'].readOnly, true, 'Unselected section readonly');
  ctx.changeSetField('ownerName', 'Попытка записи'); equal(ctx.changeDraft.fields.ownerName, ctx.changeOriginal.fields.ownerName, 'Setter also enforces selected reasons');
});

test('submission creates the same case, number, status, documents and discussion with new data visible to support', () => {
  const { ctx, state, input, open } = setup(); open(['replace-plate-sts']);
  input('changeComment', 'Новый ГРЗ и СТС'); ctx.changeAddFile(); ctx.changeNext();
  input('change-plate', 'А001АА24'); input('change-vehicleDocNumber', '12 34 567890'); ctx.changeSubmit();
  const item = ctx.SUP[0];
  equal(ctx.SUP.length, 1); equal(item.id, '000015182'); equal(item.cstatus, 'new');
  equal(ctx.procAgentLabel(item), 'Проверка документов'); equal(item.ball, 'us');
  equal(item.reasonComment, 'Новый ГРЗ и СТС'); equal(item.attachments.length, 1);
  equal(item.changeData.proposed.fields.plate, 'А001АА24'); equal(item.changeData.snapshot.fields.plate, sampleClient.sub);
  equal(item.steps.length, 1); equal(ctx.SV.length, 1); equal(ctx.SV[0].caseId, item.id); equal(state.opened, [0]);
  ok(ctx.procReasonsBlock(item).includes('А001АА24'), 'Operator sees proposed plate');
  ok(ctx.procReasonsBlock(item).includes('12 34 567890'), 'Operator sees proposed STS');
  Object.entries(sampleClient).forEach(([key, value]) => equal(ctx.CLIENTS[0][key], value, `Contract ${key} untouched`));
});

test('case payload copies snapshot and proposal; later draft changes cannot modify a submitted case', () => {
  const { ctx, input, open } = setup(); open(['replace-plate-sts']); ctx.changeNext();
  input('change-plate', 'А001АА24'); ctx.changeSubmit(); const item = ctx.SUP[0];
  ctx.changeDraft.fields.plate = 'ПЕРЕЗАПИСЬ'; ctx.changeOriginal.fields.plate = 'ДРУГОЙ СНИМОК';
  ctx.changeDraft.drivers[0].fullName = 'Перезаписанный водитель';
  equal(item.changeData.proposed.fields.plate, 'А001АА24'); equal(item.changeData.snapshot.fields.plate, sampleClient.sub);
  ok(item.changeData.proposed.drivers[0].fullName !== 'Перезаписанный водитель');
  const payload = clone(item.changeData); ctx.procCreateCase(0, 'change', { what: 'Копия', changeData: payload });
  payload.proposed.fields.plate = 'ИЗВНЕ'; payload.snapshot.fields.plate = 'ИЗВНЕ';
  equal(ctx.SUP[0].changeData.proposed.fields.plate, 'А001АА24'); equal(ctx.SUP[0].changeData.snapshot.fields.plate, sampleClient.sub);
});

test('removing a reason excludes its earlier edits, including VU, added drivers and removals', () => {
  const { ctx, input, open, proposal } = setup(); open(['replace-plate-sts', 'replace-license', 'add-driver', 'remove-driver']); ctx.changeNext();
  input('change-plate', 'НЕ ОТПРАВЛЯТЬ'); input('change-driver-1-licenseNumber', 'НЕ ОТПРАВЛЯТЬ');
  ctx.changeRemoveDriver('driver-2'); ctx.changeAddDriver(); input('change-driver-3-fullName', 'Новый Водитель'); input('change-driver-3-licenseNumber', '1234 567890');
  ctx.changeBack(); ['replace-plate-sts', 'replace-license', 'add-driver', 'remove-driver'].forEach((reason) => ctx.changeToggle(reason));
  ctx.changeToggle('with-trailer'); ctx.changeNext(); input('change-withTrailer', true, 'change');
  const data = proposal(); equal(data.fields.plate, sampleClient.sub); equal(data.drivers, ctx.changeOriginal.drivers);
  equal(data.fields.withTrailer, true); ctx.changeSubmit();
  equal(ctx.SUP[0].changeData.proposed.fields.plate, sampleClient.sub); equal(ctx.SUP[0].changeData.proposed.drivers, ctx.SUP[0].changeData.snapshot.drivers);
});

test('repeat submit, next and back after success cannot create duplicates', () => {
  const { ctx, input, open } = setup(); open(['with-trailer']); ctx.changeNext(); input('change-withTrailer', true, 'change'); ctx.changeSubmit();
  equal(ctx.changeStep, 0); ctx.changeSubmit(); ctx.changeSubmit(); ctx.changeNext(); ctx.changeBack(); ctx.changeSubmit();
  equal(ctx.changeStep, 0); equal(ctx.SUP.length, 1); equal(ctx.SV.length, 1);
});

test('five active drivers is the cap, including restore and reason-removal edge cases', () => {
  const { ctx, state, open, proposal } = setup(); open(['add-driver', 'remove-driver']); ctx.changeNext();
  for (let i = 0; i < 4; i++) ctx.changeAddDriver();
  equal(proposal().drivers.length, 5); ok(state.toasts.at(-1).includes('5'));
  ctx.changeRemoveDriver('driver-1'); ctx.changeAddDriver(); equal(proposal().drivers.length, 5);
  ctx.changeRemoveDriver('driver-1'); equal(ctx.changeDraft.drivers[0].removed, true, 'Cannot restore a sixth driver');
  ctx.changeBack(); ctx.changeToggle('remove-driver'); ctx.changeNext();
  equal(proposal().drivers.length, 6, 'Snapshot driver is restored after removal reason deselected');
  ok(ctx.changeDraftErrors(ctx.changeOriginal, proposal()).some((message) => message.includes('не более 5')), 'Invalid list cannot submit');
  ctx.changeSubmit(); equal(ctx.SUP.length, 0);
});

test('limited list needs a driver; unlimited mode keeps the draft but does not require the list', () => {
  const { ctx, input, open, proposal, state } = setup(); open(['remove-driver']); ctx.changeNext();
  ctx.changeRemoveDriver('driver-1'); ctx.changeRemoveDriver('driver-2');
  ok(ctx.changeDraftErrors(ctx.changeOriginal, proposal()).some((message) => message.includes('хотя бы одного')));
  ctx.changeBack(); ctx.changeToggle('unlimited-drivers'); ctx.changeNext(); input('change-unlimitedDrivers', true, 'change');
  equal(ctx.changeDraftErrors(ctx.changeOriginal, proposal()), []); ok(state.html.includes('Список водителей не требуется'));
  equal(ctx.changeDraft.drivers.length, 2, 'Draft drivers retained');
});

test('empty new driver and no-op proposal are rejected without a new case', () => {
  const { ctx, input, open, proposal } = setup(); open(['add-driver']); ctx.changeNext();
  ctx.changeSubmit(); equal(ctx.SUP.length, 0); ok(ctx.changeFormError.includes('Внесите новые данные'));
  ctx.changeAddDriver(); ctx.changeSubmit(); equal(ctx.SUP.length, 0); ok(ctx.changeFormError.includes('ФИО и номер ВУ'));
  input('change-driver-3-fullName', 'Новый Тестовый Водитель'); input('change-driver-3-licenseNumber', '1234 567890');
  equal(ctx.changeDraftErrors(ctx.changeOriginal, proposal()), []);
});

test('opening a new request resets all VI draft state without touching the submitted snapshot', () => {
  const { ctx, input, open } = setup(); open(['replace-plate-sts']); input('changeComment', 'Комментарий'); ctx.changeAddFile(); ctx.changeNext();
  input('change-plate', 'А001АА24'); ctx.changeSubmit(); const submitted = clone(ctx.SUP[0].changeData);
  ctx.openChange(0); equal(ctx.changeStep, 1); equal(ctx.changeComment, ''); equal(ctx.changeFiles, []); equal(ctx.changeSel, {});
  equal(ctx.changeErr, false); equal(ctx.changeFormError, ''); equal(ctx.changeDriverSeq, 2);
  equal(ctx.changeDraft.fields.plate, sampleClient.sub); equal(ctx.SUP[0].changeData, submitted);
});

after(() => console.log(`VI regression: ${assertions} explicit data assertions executed, plus DOM handler and extraction checks.`));
