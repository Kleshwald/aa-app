import { faker } from './seed';

import type {
  BallHolder,
  Deal,
  DealAction,
  DealMessage,
  DealOffer,
  DealPhase,
  DealStatus,
} from '@core/services/deal.model';

// Сиды сделок («Согласование»). Показываем ВСЕ несущие состояния, иначе экран нечем
// проверять: ждём тариф · тариф пришёл (мяч агента) · СК просит документы (мяч агента) ·
// ждём оплату клиента · оформляется · оформлен · отказ СК.
//
// Объём в реальности маленький (~5% от 500 сделок/день на всю систему), поэтому для
// агента это РЕДКАЯ операция: привычки не будет, он забудет, где дело. Отсюда два
// следствия, зашитые в модель: строка не переезжает, и сигнал обязан дойти.

const SUPPORT = 'Поддержка Agent Academy';
const AGENT = 'Филь Виктория Викторовна';

let dealCounter = 12930;
function nextRequestNumber(): string {
  dealCounter += 1;
  return String(dealCounter).padStart(9, '0');
}

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

let msgCounter = 0;
function msg(
  actor: DealMessage['actor'],
  authorName: string,
  text: string,
  atMs: number,
  read = true,
): DealMessage {
  msgCounter += 1;
  return { id: `dm${msgCounter}`, at: iso(atMs), actor, authorName, text, read };
}

/** Фаза и мяч выводятся из статуса ОДИН раз здесь — фронт их не пересчитывает. */
const STATUS_META: Record<DealStatus, { phase: DealPhase; ball: BallHolder }> = {
  draft: { phase: 'draft', ball: 'agent' },
  submitted: { phase: 'submitted', ball: 'support' },
  'with-insurer': { phase: 'with-insurer', ball: 'insurer' },
  'insurer-info': { phase: 'action-required', ball: 'agent' },
  'offer-review': { phase: 'action-required', ball: 'agent' },
  requote: { phase: 'with-insurer', ball: 'insurer' },
  'payment-link': { phase: 'payment', ball: 'client' },
  'contract-upload': { phase: 'finalizing', ball: 'support' },
  completed: { phase: 'closed', ball: 'none' },
  declined: { phase: 'closed', ball: 'none' },
  expired: { phase: 'closed', ball: 'none' },
  withdrawn: { phase: 'closed', ball: 'none' },
};

const ACTION: Partial<Record<DealStatus, DealAction>> = {
  'offer-review': { kind: 'review-offer', label: 'Согласуйте тариф' },
  'insurer-info': { kind: 'upload-docs', label: 'Страховая просит документы' },
  'payment-link': { kind: 'send-payment-link', label: 'Отправьте клиенту ссылку на оплату' },
};

/**
 * Норматив ожидания — ТОЛЬКО там, где мы его реально знаем.
 * Владелец подтвердил ровно один: договор грузим «в течение дня».
 * Для ответа СК норматива НЕТ → молчим, а не выдумываем (иначе соврём агенту,
 * а он соврёт клиенту).
 */
const WAIT_HINT: Partial<Record<DealStatus, string>> = {
  'contract-upload': 'Обычно в течение дня',
};

function makeDeal(input: {
  status: DealStatus;
  clientName: string;
  clientPhone: string;
  productLabel: string;
  objectLabel: string;
  request: string;
  createdAgoMs: number;
  waitingSinceMs?: number;
  offers?: DealOffer[];
  messages?: DealMessage[];
  premium?: number;
  insurerName?: string;
  resultingPolicyNumber?: string;
}): Deal {
  const meta = STATUS_META[input.status];
  return {
    id: faker.string.uuid(),
    requestNumber: nextRequestNumber(),
    status: input.status,
    phase: meta.phase,
    ballHolder: meta.ball,
    actionRequired: ACTION[input.status],
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    productLabel: input.productLabel,
    objectLabel: input.objectLabel,
    request: input.request,
    offers: input.offers ?? [],
    messages: input.messages ?? [],
    documents: [],
    history: [{ at: iso(-input.createdAgoMs), status: 'submitted', actor: 'agent' }],
    waitHint: WAIT_HINT[input.status],
    waitingSince: input.waitingSinceMs !== undefined ? iso(-input.waitingSinceMs) : undefined,
    premium: input.premium,
    insurerName: input.insurerName,
    resultingPolicyNumber: input.resultingPolicyNumber,
    createdAt: iso(-input.createdAgoMs),
  };
}

function offer(input: {
  version: number;
  insurerName: string;
  premium: number;
  conditions: string[];
  createdAgoMs: number;
  validForDays: number;
  acceptedAgoMs?: number;
  requoteComment?: string;
}): DealOffer {
  return {
    id: faker.string.uuid(),
    version: input.version,
    insurerName: input.insurerName,
    premium: input.premium,
    conditions: input.conditions,
    validUntil: iso(input.validForDays * DAY),
    createdAt: iso(-input.createdAgoMs),
    acceptedAt: input.acceptedAgoMs !== undefined ? iso(-input.acceptedAgoMs) : undefined,
    requoteComment: input.requoteComment,
  };
}

const SEEDED_DEALS: Deal[] = [
  // 1. ТАРИФ ПРИШЁЛ — мяч у агента. Ядро всего флоу: агент должен УВИДЕТЬ это, не
  //    спрашивая куратора. Тариф — карточка с суммой и сроком, а не реплика в чате.
  makeDeal({
    status: 'offer-review',
    clientName: 'Сорокина Наталья Андреевна',
    clientPhone: '+7 (923) 445 12 08',
    productLabel: 'КАСКО',
    objectLabel: 'Toyota Camry, 2021, В445АХ124',
    request: 'КАСКО без франшизы, стаж 3 года, был убыток в 2025.',
    createdAgoMs: 3 * DAY,
    offers: [
      offer({
        version: 1,
        insurerName: 'Согласие',
        premium: 74_300,
        conditions: ['Без франшизы', 'Ремонт у официального дилера', 'Один водитель'],
        createdAgoMs: 40 * MIN,
        validForDays: 5,
      }),
    ],
    messages: [
      msg(
        'agent',
        AGENT,
        'Клиент просит КАСКО без франшизы. Данные и фото ТС приложила.',
        -3 * DAY,
      ),
      msg('support', SUPPORT, 'Приняли, направляем в страховую.', -3 * DAY + 20 * MIN),
      msg(
        'support',
        SUPPORT,
        'Пришёл тариф от «Согласия» — 74 300 ₽. Условия в карточке выше. Если дорого — запросим пересчёт.',
        -40 * MIN,
        false, // непрочитано → «вас ждут»
      ),
    ],
  }),

  // 2. ЖДЁМ ТАРИФ ОТ СК — мяч у страховой. Норматива у нас НЕТ → не обещаем срок,
  //    но честно показываем, С КОГО и КОГДА ждём (что сказать клиенту по телефону).
  makeDeal({
    status: 'with-insurer',
    clientName: 'Дёмин Артём Павлович',
    clientPhone: '+7 (983) 210 77 46',
    productLabel: 'Имущество',
    objectLabel: 'Дом 140 м², Минусинск',
    request: 'Страхование дома и отделки, ипотечное требование банка.',
    createdAgoMs: 2 * DAY,
    waitingSinceMs: 2 * DAY - 30 * MIN,
    messages: [
      msg('agent', AGENT, 'Нужен расчёт по дому, требование банка приложено.', -2 * DAY),
      msg('support', SUPPORT, 'Направили в страховую, ждём тариф.', -2 * DAY + 30 * MIN),
    ],
  }),

  // 3. СК ПРОСИТ ДОКУМЕНТЫ — мяч у агента (второй способ попасть в сигнал, кроме тарифа).
  makeDeal({
    status: 'insurer-info',
    clientName: 'Ковалёв Игорь Степанович',
    clientPhone: '+7 (913) 664 30 91',
    productLabel: 'Спецтехника',
    objectLabel: 'Экскаватор JCB 3CX, 2019',
    request: 'Страхование спецтехники на период работ.',
    createdAgoMs: 4 * DAY,
    waitingSinceMs: 6 * 60 * MIN,
    messages: [
      msg('agent', AGENT, 'Прошу расчёт по экскаватору.', -4 * DAY),
      msg(
        'support',
        SUPPORT,
        'Страховая просит ПТС и фото техники с четырёх сторон — без них не считают.',
        -6 * 60 * MIN,
        false,
      ),
    ],
  }),

  // 4. ЖДЁМ ОПЛАТУ КЛИЕНТА. ЧЕСТНОСТЬ: эквайринг на стороне СК → статуса платежа мы
  //    НЕ ВИДИМ. Не пишем «оплачено», пишем правду. Доказательство оплаты = приход полиса.
  makeDeal({
    status: 'payment-link',
    clientName: 'Тимофеева Елена Борисовна',
    clientPhone: '+7 (902) 118 54 22',
    productLabel: 'Ипотека',
    objectLabel: 'Квартира 54 м², Абакан',
    request: 'Страхование ипотеки, банк — ВТБ.',
    createdAgoMs: 6 * DAY,
    waitingSinceMs: 20 * 60 * MIN,
    premium: 12_480,
    insurerName: 'Ренессанс',
    offers: [
      offer({
        version: 1,
        insurerName: 'Ренессанс',
        premium: 12_480,
        conditions: ['Конструктив + отделка', 'Выгодоприобретатель — банк'],
        createdAgoMs: 26 * 60 * MIN,
        validForDays: 6,
        acceptedAgoMs: 20 * 60 * MIN,
      }),
    ],
    messages: [
      msg(
        'support',
        SUPPORT,
        'Тариф 12 480 ₽ — согласовано. Выставили ссылку на оплату.',
        -20 * 60 * MIN,
      ),
    ],
  }),

  // 5. ОФОРМЛЯЕТСЯ — клиент оплатил, полис пришёл, поддержка грузит договор.
  //    Мяч у ПОДДЕРЖКИ, а деньги агента (КВ) ждут → показываем это явно, с нормативом.
  makeDeal({
    status: 'contract-upload',
    clientName: 'Бабенко Сергей Витальевич',
    clientPhone: '+7 (960) 773 09 15',
    productLabel: 'КАСКО',
    objectLabel: 'Kia Sportage, 2023, Е904ТТ124',
    request: 'КАСКО с франшизой 30 000 ₽.',
    createdAgoMs: 8 * DAY,
    waitingSinceMs: 3 * 60 * MIN,
    premium: 51_900,
    insurerName: 'Югория',
    offers: [
      offer({
        version: 1,
        insurerName: 'Югория',
        premium: 51_900,
        conditions: ['Франшиза 30 000 ₽', 'Ремонт у дилера'],
        createdAgoMs: 4 * DAY,
        validForDays: 2,
        acceptedAgoMs: 3.5 * DAY,
      }),
    ],
    messages: [
      msg('support', SUPPORT, 'Клиент оплатил, полис получен. Загружаем договор.', -3 * 60 * MIN),
    ],
  }),

  // 6. ОФОРМЛЕН — договор в системе, КВ начислено. Строка НЕ переехала: у неё теперь
  //    есть № полиса, цена и СК. Агент видит непрерывность сделки.
  makeDeal({
    status: 'completed',
    clientName: 'Мельникова Ольга Ивановна',
    clientPhone: '+7 (933) 502 61 74',
    productLabel: 'Имущество',
    objectLabel: 'Дача 96 м², Шушенское',
    request: 'Страхование дачи.',
    createdAgoMs: 16 * DAY,
    premium: 9_150,
    insurerName: 'Зетта',
    resultingPolicyNumber: 'РРР-40218837',
    offers: [
      offer({
        version: 1,
        insurerName: 'Зетта',
        premium: 9_150,
        conditions: ['Конструктив', 'Без отделки'],
        createdAgoMs: 13 * DAY,
        validForDays: 1,
        acceptedAgoMs: 12 * DAY,
      }),
    ],
    messages: [msg('support', SUPPORT, 'Договор загружен, комиссия начислена.', -10 * DAY)],
  }),

  // 7. ОТКАЗ СК — не терминальная беда, а «пробуем другую». Иначе агент уйдёт в WhatsApp.
  makeDeal({
    status: 'declined',
    clientName: 'Гурьев Павел Николаевич',
    clientPhone: '+7 (923) 887 44 03',
    productLabel: 'Спецтехника',
    objectLabel: 'Автокран, 2008',
    request: 'Страхование автокрана 2008 г.',
    createdAgoMs: 11 * DAY,
    messages: [
      msg(
        'support',
        SUPPORT,
        'Страховая отказала: возраст техники выше лимита. Можем подать в другую компанию — скажите, пробуем?',
        -9 * DAY,
      ),
    ],
  }),
];

// ВРЕМЕННО СКРЫТО (владелец, 2026-07-15): в демо оставляем только процессы по договору
// — внесение изменений, расторжение, урегулирование убытка. Примеры «Согласования»
// (тарифы/КАСКО/ипотека/спецтехника) прячем до отдельного захода. Флоу сделки цел:
// модель, страница /deals/:id, мок POST /deals — всё на месте.
// Пустой массив держит согласованность: нет строк-сделок в «Мои клиенты» И нет их в
// счётчике сигнала «Ждут ваших действий» (не разойдётся с тем, что видно).
// Вернуть примеры: DEAL_SEED_COUNT = SEEDED_DEALS.length.
const DEAL_SEED_COUNT = 0;
export const deals: Deal[] = SEEDED_DEALS.slice(0, DEAL_SEED_COUNT);

// ─── Авто-продвижение (демо) ─────────────────────────────────────────────────
// Свежая сделка от агента должна ЩЁЛКНУТЬ в «тариф пришёл» посреди несвязанной
// задачи — это и есть проверка RAT сигнала («заметит ли, когда heads-down в ОСАГО»).
// Тот же приём, что у процессов.

function advance(
  deal: Deal,
  status: DealStatus,
  comment?: string,
  actor: DealActor = 'support',
): void {
  const meta = STATUS_META[status];
  deal.status = status;
  deal.phase = meta.phase;
  deal.ballHolder = meta.ball;
  deal.actionRequired = ACTION[status];
  deal.waitHint = WAIT_HINT[status];
  deal.waitingSince = iso(0);
  deal.history.push({ at: iso(0), status, actor, comment });
}

type DealActor = Deal['history'][number]['actor'];

export interface CreateDealInput {
  clientName: string;
  clientPhone: string;
  productLabel: string;
  objectLabel: string;
  request: string;
  desiredStart?: string;
}

/** Создаёт сделку из опросника и запускает имитацию обработки. */
export function createDeal(input: CreateDealInput): Deal {
  const deal = makeDeal({
    status: 'submitted',
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    productLabel: input.productLabel,
    objectLabel: input.objectLabel,
    request: input.request,
    createdAgoMs: 0,
    waitingSinceMs: 0,
    messages: [msg('agent', AGENT, input.request, 0)],
  });
  deal.desiredStart = input.desiredStart;
  deals.unshift(deal);

  // Поддержка забрала → направила в СК → пришёл тариф (мяч у агента).
  setTimeout(() => {
    advance(deal, 'with-insurer', 'Направили в страховую компанию.');
    deal.messages.push(msg('support', SUPPORT, 'Направили в страховую, ждём тариф.', 0, false));
  }, 6000);

  setTimeout(() => {
    const premium = faker.helpers.arrayElement([18_400, 24_900, 31_500, 46_200]);
    deal.offers.push(
      offer({
        version: 1,
        insurerName: 'Согласие',
        premium,
        conditions: ['Условия по запросу', 'Один водитель'],
        createdAgoMs: 0,
        validForDays: 5,
      }),
    );
    advance(deal, 'offer-review', 'Страховая прислала тариф.');
    deal.messages.push(
      msg('support', SUPPORT, `Пришёл тариф — ${premium.toLocaleString('ru-RU')} ₽.`, 0, false),
    );
  }, 14000);

  return deal;
}

/** Агент согласовал тариф → поддержка выставляет ссылку на оплату. */
export function acceptOffer(deal: Deal): void {
  const last = deal.offers[deal.offers.length - 1];
  if (!last) return;
  last.acceptedAt = iso(0);
  deal.premium = last.premium;
  deal.insurerName = last.insurerName;

  setTimeout(() => {
    deal.payment = {
      url: `https://pay.${last.insurerName === 'Согласие' ? 'soglasie' : 'insurer'}.ru/l/${deal.requestNumber}`,
      sentAt: iso(0),
      validUntil: iso(3 * DAY),
    };
    advance(deal, 'payment-link', 'Выставлена ссылка на оплату.');
    deal.messages.push(
      msg('support', SUPPORT, 'Ссылка на оплату готова — отправьте клиенту.', 0, false),
    );
  }, 3000);
}

/** Агент попросил пересчёт → мяч снова у СК, приходит новая ВЕРСИЯ тарифа. */
export function requestRequote(deal: Deal, comment: string): void {
  const last = deal.offers[deal.offers.length - 1];
  if (last) last.requoteComment = comment;
  advance(deal, 'requote', 'Запрошен пересчёт.', 'agent');
  deal.messages.push(msg('agent', AGENT, `Прошу пересчёт: ${comment}`, 0));

  setTimeout(() => {
    const prev = deal.offers[deal.offers.length - 1];
    const next = Math.round((prev?.premium ?? 30_000) * 0.88);
    deal.offers.push(
      offer({
        version: (prev?.version ?? 0) + 1,
        insurerName: prev?.insurerName ?? 'Согласие',
        premium: next,
        conditions: prev?.conditions ?? [],
        createdAgoMs: 0,
        validForDays: 5,
      }),
    );
    advance(deal, 'offer-review', 'Страховая прислала пересчитанный тариф.');
    deal.messages.push(
      msg('support', SUPPORT, `Пересчитали — ${next.toLocaleString('ru-RU')} ₽.`, 0, false),
    );
  }, 8000);
}

export function addDealMessage(deal: Deal, text: string): DealMessage {
  const m = msg('agent', AGENT, text, 0);
  deal.messages.push(m);
  setTimeout(() => {
    deal.messages.push(
      msg('support', SUPPORT, 'Принято, уточняю у страховой и вернусь с ответом.', 0, false),
    );
  }, 2500);
  return m;
}
