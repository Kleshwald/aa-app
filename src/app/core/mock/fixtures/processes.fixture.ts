import { faker } from './seed';

import { policies, type PolicyFixture } from './policies.fixture';
import type {
  CreateProcessPayload,
  PolicyProcess,
  ProcessKind,
  ProcessStatus,
  ProcessStatusEvent,
} from '@core/services/process.service';

// Заявки по договорам (in-memory, на сессию — как policies). F5 регенерирует.
// Имитируем работу поддержки: заявка сама «продвигается» по статусам через setTimeout
// (по образцу ChatService.scheduleSupportReply), а на комментарий агента приходит ответ.

export const processes: PolicyProcess[] = [];

// Номер заявки — сквозной счётчик от 12900 (как в 1С: «000012900»).
let requestCounter = 12900;
function nextRequestNumber(): string {
  const n = requestCounter;
  requestCounter += 1;
  return String(n).padStart(9, '0');
}

function nowIso(): string {
  return new Date().toISOString();
}
function agoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}
function agoDaysIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const SUPPORT_NAME = 'Поддержка Agent Academy';

/** Что поддержка просит у агента — своё для каждого вида заявки. */
const DOC_ITEMS: Record<ProcessKind, string[]> = {
  change: ['Предыдущее водительское удостоверение'],
  cancel: ['Заявление о расторжении', 'Реквизиты для возврата премии'],
  loss: ['Справка о ДТП', 'Фотографии повреждений'],
};

/** Запрос документов, который поддержка выставляет на статусе «Ожидаем документы». */
const DOC_REQUEST = {
  title: 'Приложите документы',
  items: DOC_ITEMS.change,
};

const AWAITING_COMMENT =
  'Для проверки КБМ загрузите данные предыдущего водительского удостоверения. По текущим данным КБМ 1.17.';

interface CreateProcessInput extends CreateProcessPayload {
  policyId: string;
  policyNumber: string;
}

/** Найти заявку в массиве по id (для отложенных мутаций поддержки). */
function find(id: string): PolicyProcess | undefined {
  return processes.find((p) => p.id === id);
}

/** Обновить статус заявки + добавить событие в историю (от лица поддержки). */
function advance(id: string, status: ProcessStatus, extra?: Partial<ProcessStatusEvent>): void {
  const proc = find(id);
  if (!proc) return;
  const event: ProcessStatusEvent = {
    at: nowIso(),
    status,
    author: 'support',
    requestNumber: proc.requestNumber,
    ...extra,
  };
  proc.status = status;
  proc.statusHistory.push(event);
}

/**
 * Имитация обработки заявки поддержкой: «Проверка документов» → «В работе» →
 * «Ожидаем документы». Как только агент дозагрузит документ — заявка вернётся в работу.
 * Документы запрашиваем ПО ВИДУ заявки: по расторжению просить «предыдущее ВУ» — бред.
 */
function scheduleSupportProgress(id: string, kind: ProcessKind): void {
  const items = DOC_ITEMS[kind];
  setTimeout(() => advance(id, 'in-work', { comment: 'Ваша заявка принята в работу' }), 4500);
  setTimeout(
    () =>
      advance(id, 'awaiting-docs', {
        comment: `Приложите документы: ${items.join(', ')}`,
        docRequest: { title: 'Приложите документы', items },
      }),
    9000,
  );
}

/** Создаёт заявку, кладёт в начало списка и запускает имитацию обработки. */
export function createProcess(input: CreateProcessInput): PolicyProcess {
  const requestNumber = nextRequestNumber();
  const process: PolicyProcess = {
    id: faker.string.uuid(),
    requestNumber,
    policyId: input.policyId,
    policyNumber: input.policyNumber,
    kind: input.kind,
    reasons: input.reasons,
    status: 'checking-docs',
    statusHistory: [
      { at: nowIso(), status: 'submitted', author: 'agent', requestNumber },
      {
        at: nowIso(),
        status: 'checking-docs',
        author: 'support',
        requestNumber,
        comment: 'Заявка зарегистрирована, идёт проверка документов',
      },
    ],
    comments: [],
    attachments: [],
    responsibleName: 'Статьева Елена Владимировна',
    createdAt: nowIso(),
  };
  processes.unshift(process);
  scheduleSupportProgress(process.id, process.kind);
  return process;
}

// Ответ поддержки по заявке — по ключевым словам (чтобы не был один и тот же на всё).
const PROCESS_CANNED: { match: RegExp; reply: string }[] = [
  {
    match: /когда|срок|сколько|быстро|время|готов/i,
    reply:
      'По этой заявке обычно отвечаем в течение рабочего дня. Как проверим документы — статус изменится здесь.',
  },
  {
    match: /документ|ву|удостоверен|паспорт|скан|фото|приложил/i,
    reply:
      'Спасибо, проверяем документы по заявке. Если чего-то не хватит — попросим дозагрузить прямо здесь.',
  },
  {
    match: /кбм|коэффициент|цена|стоимост|доплат/i,
    reply: 'Уточняем расчёт по заявке в системе. Вернёмся с результатом в этой заявке.',
  },
];
const PROCESS_DEFAULT_REPLY =
  'Приняли ваше сообщение по заявке. Специалист, который её ведёт, ответит здесь же.';

/** Комментарий агента + отложенный ответ поддержки (по ключевым словам). */
export function addComment(id: string, text: string): PolicyProcess | undefined {
  const proc = find(id);
  if (!proc) return undefined;
  proc.comments.push({ at: nowIso(), author: 'agent', authorName: 'Вы', text });
  const reply = PROCESS_CANNED.find((c) => c.match.test(text))?.reply ?? PROCESS_DEFAULT_REPLY;
  setTimeout(() => {
    const p = find(id);
    if (!p) return;
    p.comments.push({ at: nowIso(), author: 'support', authorName: SUPPORT_NAME, text: reply });
  }, 2500);
  return proc;
}

/**
 * Финальная запись «Хода заявки»: не голый статус, а «что это значит».
 * Без неё лента обрывается словом «Готово», и агент не знает, что сказать клиенту.
 */
const DONE_COMMENT: Record<ProcessKind, string> = {
  change: 'Изменения внесены. Обновлённый полис — в документах договора ниже.',
  cancel: 'Договор расторгнут. Возврат части премии придёт на счёт клиента.',
  loss: 'Убыток урегулирован. Выплата перечислена на счёт клиента.',
};

/** Прикрепить документ к заявке (заглушка). Возвращает заявку в работу и доводит до конца. */
export function addAttachment(id: string, name: string): PolicyProcess | undefined {
  const proc = find(id);
  if (!proc) return undefined;
  proc.attachments.push({
    id: faker.string.uuid(),
    name,
    uploadedAt: nowIso(),
    author: 'agent',
  });
  if (proc.status === 'awaiting-docs') {
    advance(id, 'in-work', { comment: 'Документы получены, продолжаем работу по заявке' });
    // Доводим заявку до `done`: иначе статус недостижим, и правило «маркер исчез —
    // след на договоре остался» нельзя ни показать владельцу, ни проверить на агентах.
    setTimeout(() => {
      const p = find(id);
      if (!p || p.status !== 'in-work') return; // статус уже сдвинули — не перетираем
      advance(id, 'done', { comment: DONE_COMMENT[p.kind] });
    }, 7000);
  }
  return proc;
}

// ─── Сид: 1–2 существующие заявки на первых OSAGO-полисах, чтобы холодный вход
//     на странице договора не был пустым и счётчики что-то показывали. ───
function seedProcess(policyIndex: number, minutesAgo: number): void {
  const osago = policies.filter((p) => p.type === 'OSAGO');
  const policy = osago[policyIndex];
  if (!policy) return;
  const requestNumber = nextRequestNumber();
  processes.push({
    id: faker.string.uuid(),
    requestNumber,
    policyId: policy.id,
    policyNumber: policy.number,
    kind: 'change',
    reasons: ['add-driver'],
    status: 'awaiting-docs',
    statusHistory: [
      { at: agoIso(minutesAgo + 12), status: 'submitted', author: 'agent', requestNumber },
      {
        at: agoIso(minutesAgo + 10),
        status: 'checking-docs',
        author: 'support',
        requestNumber,
        comment: 'Добавление нового водителя',
      },
      {
        at: agoIso(minutesAgo + 6),
        status: 'in-work',
        author: 'support',
        requestNumber,
        comment: 'Ваша заявка принята в работу',
      },
      {
        at: agoIso(minutesAgo),
        status: 'awaiting-docs',
        author: 'support',
        requestNumber,
        comment: 'Приложите документы: Предыдущее водительское удостоверение',
        docRequest: DOC_REQUEST,
      },
    ],
    comments: [
      {
        at: agoIso(minutesAgo - 2),
        author: 'support',
        authorName: SUPPORT_NAME,
        text: AWAITING_COMMENT,
      },
    ],
    attachments: [],
    responsibleName: 'Статьева Елена Владимировна',
    createdAt: agoIso(minutesAgo + 12),
  });
}

// ─── Сид завершённых заявок ──────────────────────────────────────────────────
// Без них `done`/`rejected` недостижимы, и «история заявок» — разговор о пустом
// экране. Кладём все три на ОДИН полис прошлого месяца: это же тест-кейс
// «клиент звонит про майский полис, а в таблице стоит фильтр "Этот месяц"».

/**
 * Полис для завершённых заявок. Берём достаточно СТАРЫЙ (≥75 дней): заявка не может
 * быть старше своего договора, а на десятидневном полисе всё «закрылось» бы вчера —
 * и тест-кейс «клиент звонит про заявление, закрытое месяц назад» не воспроизвести.
 * Фолбэки: любой полис прошлых месяцев → второй по списку.
 */
const MIN_POLICY_AGE_DAYS = 75;

function olderOsagoPolicy(): PolicyFixture | undefined {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const newestFirst = (a: PolicyFixture, b: PolicyFixture) =>
    b.createdAt.localeCompare(a.createdAt);
  const osago = policies.filter((p) => p.type === 'OSAGO');
  const agedCutoff = new Date(Date.now() - MIN_POLICY_AGE_DAYS * 86_400_000).toISOString();
  const aged = osago.filter((p) => p.createdAt < agedCutoff).sort(newestFirst);
  const beforeMonth = osago.filter((p) => p.createdAt < startOfMonth).sort(newestFirst);
  return aged[0] ?? beforeMonth[0] ?? osago[1];
}

interface CompletedSeed {
  kind: ProcessKind;
  reasons: string[];
  status: 'done' | 'rejected';
  /** Доли возраста полиса: заявка не может быть старше самого договора. */
  openedAt: number;
  closedAt: number;
  workComment: string;
  outcome: string;
}

function seedCompleted(policy: PolicyFixture, seed: CompletedSeed): void {
  const ageDays = Math.max(
    6,
    Math.floor((Date.now() - new Date(policy.createdAt).getTime()) / 86_400_000),
  );
  const opened = ageDays * seed.openedAt;
  const closed = ageDays * seed.closedAt;
  const requestNumber = nextRequestNumber();
  processes.push({
    id: faker.string.uuid(),
    requestNumber,
    policyId: policy.id,
    policyNumber: policy.number,
    kind: seed.kind,
    reasons: seed.reasons,
    status: seed.status,
    statusHistory: [
      { at: agoDaysIso(opened), status: 'submitted', author: 'agent', requestNumber },
      {
        at: agoDaysIso(opened - 0.1),
        status: 'checking-docs',
        author: 'support',
        requestNumber,
        comment: 'Заявка зарегистрирована, идёт проверка документов',
      },
      {
        at: agoDaysIso((opened + closed) / 2),
        status: 'in-work',
        author: 'support',
        requestNumber,
        comment: seed.workComment,
      },
      {
        at: agoDaysIso(closed),
        status: seed.status,
        author: 'support',
        requestNumber,
        comment: seed.outcome,
      },
    ],
    comments: [],
    attachments: [],
    responsibleName: 'Статьева Елена Владимировна',
    createdAt: agoDaysIso(opened),
  });
}

seedProcess(0, 180);

const olderPolicy = olderOsagoPolicy();
if (olderPolicy) {
  seedCompleted(olderPolicy, {
    kind: 'change',
    reasons: ['add-driver'],
    status: 'done',
    openedAt: 0.5,
    closedAt: 0.38,
    workComment: 'Проверяем данные нового водителя и пересчитываем КБМ.',
    outcome: 'Изменения внесены. Обновлённый полис — в документах договора ниже.',
  });
  seedCompleted(olderPolicy, {
    kind: 'loss',
    reasons: [],
    status: 'done',
    openedAt: 0.3,
    closedAt: 0.16,
    workComment: 'Осмотр не потребовался — ущерб подтверждён по фотографиям.',
    outcome: 'Убыток урегулирован. Выплата 47 300 ₽ перечислена на счёт клиента.',
  });
  seedCompleted(olderPolicy, {
    kind: 'change',
    reasons: ['replace-license'],
    status: 'rejected',
    openedAt: 0.12,
    closedAt: 0.06,
    workComment: 'Запросили чёткое фото водительского удостоверения.',
    outcome:
      'Отклонено: фото водительского удостоверения нечитаемо. Подайте заявку заново с чётким снимком.',
  });
}

// ─── Сид активных заявок ─────────────────────────────────────────────────────
// Без них на «Мои клиенты» не увидеть ни нейтральный маркер «В работе» (пассивный
// трекинг: клиент звонит — «что там?»), ни то, ради чего сделан чип «Ждут ваших
// действий»: заявку на полисе ВНЕ дефолтного фильтра «Этот месяц».

/** Активная заявка: `awaiting-docs` ждёт агента, `in-work` просто идёт. */
function seedActive(
  policy: PolicyFixture | undefined,
  kind: ProcessKind,
  status: Extract<ProcessStatus, 'in-work' | 'awaiting-docs'>,
  openedDaysAgo: number,
): void {
  if (!policy) return;
  const requestNumber = nextRequestNumber();
  const openedAt = agoDaysIso(openedDaysAgo);
  const history: ProcessStatusEvent[] = [
    { at: openedAt, status: 'submitted', author: 'agent', requestNumber },
    {
      at: agoDaysIso(openedDaysAgo * 0.9),
      status: 'checking-docs',
      author: 'support',
      requestNumber,
      comment: 'Заявка зарегистрирована, идёт проверка документов',
    },
    {
      at: agoDaysIso(openedDaysAgo * 0.5),
      status: 'in-work',
      author: 'support',
      requestNumber,
      comment: 'Ваша заявка принята в работу',
    },
  ];
  if (status === 'awaiting-docs') {
    history.push({
      at: agoIso(25),
      status: 'awaiting-docs',
      author: 'support',
      requestNumber,
      comment: `Приложите документы: ${DOC_ITEMS[kind].join(', ')}`,
      docRequest: { title: 'Приложите документы', items: DOC_ITEMS[kind] },
    });
  }
  processes.push({
    id: faker.string.uuid(),
    requestNumber,
    policyId: policy.id,
    policyNumber: policy.number,
    kind,
    reasons: [],
    status,
    statusHistory: history,
    comments: [],
    attachments: [],
    responsibleName: 'Статьева Елена Владимировна',
    createdAt: openedAt,
  });
}

const osagoList = policies.filter((p) => p.type === 'OSAGO');

// Нейтральный маркер «В работе · Расторжение» на свежем полисе (не на том, где уже
// висит заявка seedProcess(0), иначе строка была бы одна на два маркера).
const inWorkPolicy = osagoList.find((p) => p.id !== osagoList[0]?.id && p.id !== olderPolicy?.id);
seedActive(inWorkPolicy, 'cancel', 'in-work', 2);

// «Ждут ваших действий» на СТАРОМ полисе: под дефолтным «Этот месяц» строки не видно,
// и найти её можно только чипом. Это и есть кросс-периодность внимания.
seedActive(olderPolicy, 'loss', 'awaiting-docs', 20);
