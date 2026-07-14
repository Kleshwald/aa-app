// ─── Расторжение договора: домен ────────────────────────────────────────────
// Источник правды — легаси-спека «процессы 1.0» (docs/knowledge/10-processes.md):
//   [Р-ФТ-1] форма = кто заявитель + причина расторжения + документы (+ комментарий);
//   [Р-ФТ-4] калькулятор возврата премии (формула ниже).
// Правовая рамка (ГК РФ ст. 958, Правила ОСАГО): основания и дата прекращения.
//
// Живёт отдельным файлом, а не в process.service.ts: там общая kind-агностичная
// инфраструктура заявок, а здесь — специфика ОДНОГО вида. Заявка создаётся через
// общий `ProcessService.create(policyId, { kind: 'cancel', reasons, formSnapshot })`.

/** Кто подаёт заявление о расторжении. */
export interface CancelApplicant {
  code: string;
  label: string;
}

export const CANCEL_APPLICANTS: readonly CancelApplicant[] = [
  { code: 'policyholder', label: 'Страхователь' },
  { code: 'owner', label: 'Собственник ТС' },
  { code: 'heir', label: 'Наследник' },
  { code: 'representative', label: 'Представитель по доверенности' },
] as const;

/**
 * От какой даты отсчитывается прекращение договора:
 * - `application` — со дня подачи заявления страховщику (продажа, отказ, отзыв лицензии);
 * - `event` — со дня самого события, подтверждённого документом (гибель ТС, смерть).
 *
 * Это НЕ формальность: если считать продажу от даты договора купли-продажи, а не от
 * даты заявления, сумма возврата окажется завышенной — агент назовёт клиенту цифру,
 * которая не сойдётся с выплатой страховой.
 */
export type CancelDateBasis = 'application' | 'event';

export interface CancelReason {
  code: string;
  label: string;
  /** Возвращается ли часть премии по этому основанию. */
  refund: boolean;
  dateBasis: CancelDateBasis;
  /** Документ-основание. Прикладывать сразу не обязательно — поддержка запросит. */
  document: string;
}

export const CANCEL_REASONS: readonly CancelReason[] = [
  {
    code: 'sale',
    label: 'Клиент продал машину или сменился собственник',
    refund: true,
    dateBasis: 'application',
    document: 'Договор купли-продажи (или дарения)',
  },
  {
    code: 'total-loss',
    label: 'Машина погибла или утрачена (тотал, утилизация, угон)',
    refund: true,
    dateBasis: 'event',
    document: 'Документ о гибели, утилизации или угоне ТС',
  },
  {
    code: 'death',
    label: 'Смерть страхователя',
    refund: true,
    dateBasis: 'event',
    document: 'Свидетельство о смерти и документы наследника',
  },
  {
    code: 'insurer-license',
    label: 'У страховой компании отозвали лицензию',
    refund: true,
    dateBasis: 'application',
    document: 'Отдельный документ не нужен',
  },
  {
    code: 'voluntary',
    label: 'Клиент отказывается от полиса',
    refund: true,
    dateBasis: 'application',
    document: 'Заявление страхователя',
  },
] as const;

const REASON_BY_CODE = new Map(CANCEL_REASONS.map((r) => [r.code, r]));

export function cancelReason(code: string): CancelReason | undefined {
  return REASON_BY_CODE.get(code);
}

export function cancelReasonLabel(code: string): string {
  return REASON_BY_CODE.get(code)?.label ?? code;
}

/** Снимок формы расторжения — уходит в `formSnapshot` заявки (в бою — в 1С). */
export interface CancelPayload {
  applicant: string;
  reason: string;
  /** ISO yyyy-mm-dd. Дата прекращения договора. */
  terminationDate: string;
  comment?: string;
  /** Оценка возврата на момент подачи — чтобы поддержка видела, что показали агенту. */
  refundEstimate?: number;
}

// ─── Калькулятор возврата премии ─────────────────────────────────────────────

/**
 * Доля премии, удерживаемая страховщиком при досрочном прекращении: **23%**.
 * Это «нагрузка» в структуре тарифа (≈20% РВД + 3% отчисления в РСА); возвращают
 * только нетто-часть за неистёкший срок.
 *
 * Важно: у ОСАГО полного возврата не бывает — 23% удерживают даже если договор
 * ещё не начал действовать. «Период охлаждения» (14 дней) на ОСАГО не распространяется,
 * он есть только у добровольных видов (НС, Антиклещ).
 */
export const CANCEL_WITHHOLD_RATE = 0.23;

export interface RefundEstimate {
  /** Дней в сроке действия полиса. */
  termDays: number;
  /** Дней, оставшихся до окончания на дату прекращения (0, если срок вышел). */
  remainingDays: number;
  /** Премия по договору. */
  premium: number;
  /** Удержано страховщиком, ₽. */
  withheld: number;
  /** Итог к возврату, ₽ (округляем до копеек). */
  amount: number;
}

const MS_PER_DAY = 86_400_000;

/** Целых дней между двумя ISO-датами (b − a). Отрицательное — если b раньше a. */
function daysBetween(a: string, b: string): number {
  const from = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / MS_PER_DAY);
}

/**
 * Возврат премии по формуле легаси-платформы [Р-ФТ-4]:
 *
 *   Сумма к возврату = (Премия − 0,23 × Премия) ÷ дней действия × дней до окончания
 *
 * Результат — ОЦЕНОЧНЫЙ. Точную сумму определяет страховая компания: округление дней,
 * знаменатель 365/366 и практика удержаний у СК различаются. Экран обязан говорить
 * «ориентировочно», иначе агент назовёт клиенту цифру, которая не сойдётся.
 */
export function estimateRefund(
  premium: number,
  startDate: string,
  endDate: string,
  terminationDate: string,
): RefundEstimate {
  const termDays = Math.max(1, daysBetween(startDate, endDate));
  const remainingDays = Math.max(0, Math.min(termDays, daysBetween(terminationDate, endDate)));
  const net = premium * (1 - CANCEL_WITHHOLD_RATE);
  const amount = Math.round(((net / termDays) * remainingDays + Number.EPSILON) * 100) / 100;
  return {
    termDays,
    remainingDays,
    premium,
    withheld: Math.round(premium * CANCEL_WITHHOLD_RATE * 100) / 100,
    amount,
  };
}
