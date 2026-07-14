// ─── СДЕЛКА («Согласование») ──────────────────────────────────────────────────
//
// Ключевое отличие от PolicyProcess (изменение/расторжение/убыток): у тех есть
// ДОГОВОР, а у сделки его ещё НЕТ — он только будет. Поэтому сделка не может жить
// на /clients/:id и не может быть «процессом по полису» (там policyId обязателен).
//
// Что это за работа агента: клиент просит полис, который агент не может посчитать
// сам (нестандарт, ЮЛ, КАСКО, имущество, спецтехника). Агент отдаёт данные →
// поддержка идёт в СК → приходит тариф → агент согласовывает → клиент платит →
// приходит полис → поддержка грузит договор → агент получает КВ.
//
// Дом сделки — строка в «Мои клиенты» (картотека СДЕЛОК, а не реестр полисов).
// Строка не переезжает: после оплаты у неё появляется № полиса, цена и КВ.
//
// Модель — ядро Белова: UI смотрит на `phase` + `ballHolder` + `actionRequired`,
// а НЕ на switch(status). Тогда рост числа статусов не трогает фронт.
// Сюда же потом мигрируют change/cancel/loss (сейчас у них своя плоская модель —
// осознанный временный долг, см. docs; схлопывать, когда освободятся файлы).

/** Универсальная фаза — единственное, на что смотрит UI. */
export type DealPhase =
  | 'draft'
  | 'submitted'
  | 'with-insurer'
  | 'action-required'
  | 'payment'
  | 'finalizing'
  | 'closed';

/**
 * Чей мяч. Несущее понятие всей модели: настоящее ограничение в асинхронной сделке
 * на троих (агент — поддержка — СК) — агент НЕ ВИДИТ, у кого сейчас ход, и от этого
 * уходит писать куратору в WhatsApp. Мяч приходит флагом с бэкенда, фронт его не
 * вычисляет.
 */
export type BallHolder = 'agent' | 'support' | 'insurer' | 'client' | 'none';

/** Кто автор события/сообщения. `insurer` и `system` не выразимы в старой модели. */
export type DealActor = 'agent' | 'support' | 'insurer' | 'system';

export type DealStatus =
  | 'draft' // агент заполняет опросник
  | 'submitted' // отправлено, поддержка разбирает
  | 'with-insurer' // направлено в СК, ждём тариф
  | 'insurer-info' // СК просит данные → мяч агента
  | 'offer-review' // тариф пришёл → мяч агента (согласовать/пересчитать)
  | 'requote' // агент попросил пересчёт → снова у СК
  | 'payment-link' // ссылка на оплату у клиента → мяч клиента
  | 'contract-upload' // полис пришёл, поддержка грузит договор в систему
  | 'completed' // договор доступен, КВ начислено
  | 'declined' // СК отказала
  | 'expired' // тариф/ссылка протухли
  | 'withdrawn'; // агент отозвал

/** Что именно требуется от агента. Фильтр сигнала строится по НАЛИЧИЮ этого поля. */
export type DealActionKind = 'upload-docs' | 'review-offer' | 'send-payment-link';

export interface DealAction {
  kind: DealActionKind;
  /** Человеческой строкой: «Согласуйте тариф», «Страховая просит документы». */
  label: string;
}

/**
 * Тариф — ВЕРСИОНИРОВАННЫЙ АРТЕФАКТ с явным акцептом, а не реплика в переписке.
 * Это несущее: если цену «согласовали словами», однажды случится «поддержка писала
 * 17 900, а списали 18 400» — ровно тот позор перед клиентом, ради устранения
 * которого всё и делается. Переписка — канал; акцепт — значимое событие.
 */
export interface DealOffer {
  id: string;
  version: number;
  insurerName: string;
  premium: number;
  conditions: string[];
  /** До какой даты действует. После — `expired`, тариф надо запрашивать заново. */
  validUntil: string;
  createdAt: string;
  acceptedAt?: string;
  /** Комментарий агента при запросе пересчёта — почему не устроило. */
  requoteComment?: string;
}

export interface DealMessage {
  /** id и read — то, без чего «непрочитанное по сделке» нечем посчитать. */
  id: string;
  at: string;
  actor: DealActor;
  authorName: string;
  text: string;
  /** Для сообщений НЕ от агента: прочитано ли агентом. */
  read: boolean;
}

export interface DealDocument {
  id: string;
  name: string;
  uploadedAt: string;
  actor: DealActor;
}

export interface DealEvent {
  at: string;
  status: DealStatus;
  actor: DealActor;
  comment?: string;
}

/**
 * Что мы ЧЕСТНО знаем про оплату.
 *
 * Владелец: «эквайринг будет разный, на стороне СК». Значит коллбэка о платеже у нас
 * НЕТ — мы физически не знаем, оплатил клиент или нет. Поэтому:
 *   • статуса «Оплачено» в модели НЕТ СОЗНАТЕЛЬНО (нельзя показывать факт, которого
 *     не знаешь: агент скажет клиенту «оплата прошла», а она не прошла);
 *   • доказательство оплаты = ПРИХОД ПОЛИСА. Пока полиса нет — мы честно говорим,
 *     что статус оплаты нам не виден.
 */
export interface DealPayment {
  /** Ссылка, которую агент отдаёт клиенту (её выставляет поддержка/СК). */
  url: string;
  sentAt: string;
  /** До какой даты ссылка жива. Протухла → `expired`, нужен новый тариф. */
  validUntil: string;
}

export interface Deal {
  id: string;
  /** Сквозной номер, как у заявок: «000012934». */
  requestNumber: string;

  status: DealStatus;
  phase: DealPhase;
  ballHolder: BallHolder;
  /** Заполнено ⇔ мяч у агента ⇔ сделка попадает в «Ждут ваших действий». */
  actionRequired?: DealAction;

  // ─── Предмет (полиса ещё нет — есть клиент и продукт) ───
  clientName: string;
  clientPhone: string;
  productLabel: string;
  objectLabel: string;
  /** Что агент просит посчитать — свободный текст из опросника. */
  request: string;
  desiredStart?: string;

  offers: DealOffer[];
  messages: DealMessage[];
  documents: DealDocument[];
  history: DealEvent[];
  payment?: DealPayment;

  /**
   * Норматив ожидания — ТОЛЬКО если мы его реально знаем. Не выдумывать.
   * Владелец подтвердил один: договор поддержка грузит «в течение дня».
   */
  waitHint?: string;
  /** С какого момента ждём (для «ждём тариф с 3 июля» — что сказать клиенту). */
  waitingSince?: string;

  /** Появляется, когда сделка доехала до полиса — тогда строка получает № полиса. */
  resultingPolicyId?: string;
  resultingPolicyNumber?: string;
  /** Итоговая премия (после акцепта тарифа). */
  premium?: number;
  insurerName?: string;

  createdAt: string;
  closedAt?: string;
}

/** Строка сделки для «Мои клиенты» — ложится в существующие 8 колонок, без новых. */
export interface DealRow {
  id: string;
  requestNumber: string;
  createdAt: string;
  clientName: string;
  objectLabel: string;
  productLabel: string;
  /** Пока тариф не согласован — цены нет. В таблице покажем «—», а не ноль. */
  premium?: number;
  status: DealStatus;
  statusLabel: string;
  /** Пока СК не выбрана — «Подбираем». */
  insurerName?: string;
  actionRequired?: DealAction;
  resultingPolicyNumber?: string;
}

/** Сделка, ждущая агента — плоский указатель для сигнала «Ждут ваших действий». */
export interface AwaitingDeal {
  dealId: string;
  requestNumber: string;
  clientName: string;
  /** Что нужно от агента, человеческой строкой. */
  need: string;
}

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  draft: 'Черновик',
  submitted: 'Заявка принята',
  'with-insurer': 'На согласовании',
  'insurer-info': 'Страховая просит документы',
  'offer-review': 'Тариф получен',
  requote: 'На пересчёте',
  'payment-link': 'Ждём оплату клиента',
  'contract-upload': 'Оформляется',
  completed: 'Оформлен',
  declined: 'Отказ страховой',
  expired: 'Тариф истёк',
  withdrawn: 'Отозвана',
};

/**
 * Что агент говорит клиенту по телефону — главный текст всего экрана.
 * Мяч + что дальше + когда, одной строкой, без открывания трёх экранов.
 */
export const DEAL_BALL_LABEL: Record<BallHolder, string> = {
  agent: 'Ход за вами',
  support: 'В работе у нашей поддержки',
  insurer: 'В работе у страховой компании',
  client: 'Ждём оплату от клиента',
  none: 'Завершено',
};

/** Сделка закрыта — маркера/сигнала нет, след остаётся. */
export function isClosedDeal(status: DealStatus): boolean {
  return (
    status === 'completed' ||
    status === 'declined' ||
    status === 'withdrawn' ||
    status === 'expired'
  );
}

/** Актуальный тариф — последняя версия. */
export function currentOffer(deal: Deal): DealOffer | undefined {
  return deal.offers.length > 0 ? deal.offers[deal.offers.length - 1] : undefined;
}
