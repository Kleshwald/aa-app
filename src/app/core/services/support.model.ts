import {
  PROCESS_KIND_LABEL,
  processStatusLabel,
  type ProcessAttachment,
  type ProcessComment,
  type ProcessKind,
  type ProcessStatus,
  type ProcessStatusEvent,
} from './process.service';

// ─── Рабочее место поддержки (кокпит) ────────────────────────────────────────
//
// Модель построена по docs/SUPPORT.md §4 «тонкая агрегация»: очередь — это
// УКАЗАТЕЛИ на две разные системы (заявки живут в 1С, диалоги — у чат-вендора),
// а не третья копия данных. Поэтому элемент очереди плоский: кто ждёт, чего ждёт,
// сколько ждёт, кто ведёт и куда идти работать. Всё «мясо» — уже в карточке.
//
// Второй несущий принцип (docs/SUPPORT.md §3): «статус всегда в платформе, даже
// когда работа снаружи». Поэтому у элемента есть `ball` — у кого мяч: у нас,
// у агента или у страховой. Агенту наружу видно только итог, поддержке — весь трек.

/** Откуда пришло: заявка по договору (1С) или диалог в чате (вендор). */
export type SupportSource = '1c' | 'chat';

/** У кого мяч. Ось внимания поддержки: «моя работа» ≠ «жду других». */
export type SupportBall = 'support' | 'agent' | 'insurer';

/** Тон статуса для бейджа (единый язык цвета проекта). */
export type SupportTone = 'new' | 'work' | 'waiting' | 'done' | 'rejected';

/** Строка общей очереди — указатель, не копия данных. */
export interface SupportQueueItem {
  id: string;
  source: SupportSource;
  /** Маршрут внутри кокпита: клик = открыть дело. */
  link: string;
  kind?: ProcessKind;
  requestNumber?: string;
  /** Тема строкой: вид заявки или суть вопроса. */
  topic: string;
  /** Предмет: № полиса + страхователь, либо первая строка вопроса. */
  detail: string;
  agentName: string;
  agentIkp: string;
  region: string;
  insurer?: string;
  statusLabel: string;
  tone: SupportTone;
  ball: SupportBall;
  assignee: string | null;
  /** Последнее движение по делу (от него считаем ожидание). */
  sinceIso: string;
  createdIso: string;
  /**
   * Дело из живой сессии демо-агента: действия поддержки сразу видны в кабинете
   * агента (та же in-memory фикстура / тот же ChatService). Ради этой петли
   * кокпит и живёт в том же приложении — см. docs/SUPPORT.md §8.
   */
  live: boolean;
}

/** Внутренняя заметка поддержки. Агенту НЕ видна (в отличие от `comments`). */
export interface SupportNote {
  at: string;
  author: string;
  text: string;
}

/**
 * Карточка задачи поддержки. Поля — по легаси-спецификации
 * `docs/knowledge/10-processes.md` §1–3 (`[ВИ-ФТ-7]`, `[Р-ФТ-3]`, `[УУ-ФТ-4]`):
 * общая шапка + то, что своё у каждого вида (сумма возврата у расторжения,
 * номер убытка и выплата у УУ).
 */
export interface SupportRequestDetail {
  id: string;
  requestNumber: string;
  kind: ProcessKind;
  status: ProcessStatus;
  reasons: string[];
  createdAt: string;

  policyId: string;
  policyNumber: string;
  insurer: string;
  policyholder: string;
  owner: string;
  vehicle: string;
  premium: number;
  startDate: string;
  endDate: string;

  /** Расторжение: сумма к возврату (удержание 23% + пропорция срока). */
  refundAmount?: number;
  /** Убыток: номер дела и сумма выплаты, когда СК их сообщила. */
  lossNumber?: string;
  payoutAmount?: number;

  agentName: string;
  agentIkp: string;
  agentPhone: string;
  region: string;
  curatorName: string;

  assignee: string | null;
  /**
   * Работа ушла во внешний контур (СК: почта/чат). Мяч не у нас и не у агента —
   * но статус мы всё равно ведём в платформе, а агенту наружу отдаём только итог
   * (docs/SUPPORT.md §3, принцип 2).
   */
  atInsurer: boolean;
  statusHistory: ProcessStatusEvent[];
  /** Переписка с агентом — видна агенту в его кабинете. */
  comments: ProcessComment[];
  /** Внутренние заметки — агенту не видны. */
  notes: SupportNote[];
  attachments: ProcessAttachment[];
  live: boolean;
}

/** Сообщение в диалоге поддержки с агентом. */
export interface SupportChatMessage {
  id: string;
  at: string;
  author: 'agent' | 'support';
  authorName: string;
  text: string;
}

/** Диалог (чат-вендор). Для демо-агента подменяется живым `ChatService`. */
export interface SupportChatThread {
  id: string;
  agentName: string;
  agentIkp: string;
  agentPhone: string;
  region: string;
  curatorName: string;
  topic: string;
  assignee: string | null;
  messages: SupportChatMessage[];
  /** Куда передали дальше (2-я линия по темам). */
  escalatedTo?: string;
  live: boolean;
}

// ─── Команда поддержки ───────────────────────────────────────────────────────
// Владелец (2026-07-20): поддержка — ОДНА команда ~3 человека, ведёт и заявки,
// и чат. Вторая линия структурирована ПО ТЕМАМ, а не по «уровням важности».

export const SUPPORT_OPERATORS: readonly string[] = [
  'Статьева Елена Владимировна',
  'Гончарова Марина Сергеевна',
  'Абрамов Игорь Петрович',
] as const;

/** Кто сидит за кокпитом в демо. Совпадает с `responsibleName` в фикстуре заявок. */
export const CURRENT_OPERATOR = SUPPORT_OPERATORS[0];

/** Вторая линия — по темам (docs/SUPPORT.md §2). */
export const SECOND_LINE_TOPICS: readonly string[] = [
  'Расчёты и андеррайтинг',
  'Сегментация и скоринг',
  'Пул и Автопомощник',
  'Технические баги',
] as const;

// ─── SLA ─────────────────────────────────────────────────────────────────────
// Порог — не «красиво», а обещание агенту: первый ответ в течение рабочего дня.
// Считаем от последнего движения и ТОЛЬКО когда мяч у нас: пока ждём агента или
// страховую, часы капают не на нас (иначе очередь через день вся красная и слепнет).

export const SLA_SOON_MINUTES = 120;
export const SLA_OVERDUE_MINUTES = 240;

export type SlaState = 'ok' | 'soon' | 'overdue' | 'idle';

export function minutesSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

export function slaState(item: {
  ball: SupportBall;
  sinceIso: string;
  tone: SupportTone;
}): SlaState {
  if (item.tone === 'done' || item.tone === 'rejected') return 'idle';
  if (item.ball !== 'support') return 'idle';
  const minutes = minutesSince(item.sinceIso);
  if (minutes >= SLA_OVERDUE_MINUTES) return 'overdue';
  if (minutes >= SLA_SOON_MINUTES) return 'soon';
  return 'ok';
}

/** Возраст словами: «2 часа», «3 дня». Без «назад» — колонка и так «Ждёт». */
export function humanAge(iso: string): string {
  const minutes = minutesSince(iso);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${plural(hours, 'час', 'часа', 'часов')}`;
  const days = Math.floor(hours / 24);
  return `${days} ${plural(days, 'день', 'дня', 'дней')}`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const SUPPORT_BALL_LABEL: Record<SupportBall, string> = {
  support: 'У нас',
  agent: 'У агента',
  insurer: 'У страховой',
};

export const SUPPORT_SOURCE_LABEL: Record<SupportSource, string> = {
  '1c': 'Заявка',
  chat: 'Вопрос',
};

/** Тон бейджа по статусу заявки — единый язык цвета (тёплый = ждём кого-то). */
export function toneOfStatus(status: ProcessStatus): SupportTone {
  switch (status) {
    case 'submitted':
      return 'new';
    case 'awaiting-docs':
      return 'waiting';
    case 'done':
      return 'done';
    case 'rejected':
      return 'rejected';
    default:
      return 'work';
  }
}

/**
 * У кого мяч по статусу заявки. Это НЕ то же самое, что статус: «Ожидаем документы»
 * = мяч у агента (мы не работаем), «В работе» = мяч у нас. Именно по этой оси
 * поддержка сортирует свой день.
 */
export function ballOfStatus(status: ProcessStatus, atInsurer = false): SupportBall {
  if (status === 'awaiting-docs') return 'agent';
  if (status === 'done' || status === 'rejected') return 'support';
  return atInsurer ? 'insurer' : 'support';
}

/** Заголовок дела для списков и шапки карточки. */
export function requestTitle(kind: ProcessKind, requestNumber: string): string {
  return `${PROCESS_KIND_LABEL[kind]} · № ${requestNumber}`;
}

export { processStatusLabel };
