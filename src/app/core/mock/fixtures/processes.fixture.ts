import { faker } from './seed';

import { policies } from './policies.fixture';
import type {
  CreateProcessPayload,
  PolicyProcess,
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

const SUPPORT_NAME = 'Поддержка Agent Academy';

/** Запрос документов, который поддержка выставляет на статусе «Ожидаем документы». */
const DOC_REQUEST = {
  title: 'Приложите документы',
  items: ['Предыдущее водительское удостоверение'],
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
 */
function scheduleSupportProgress(id: string): void {
  setTimeout(() => advance(id, 'in-work', { comment: 'Ваша заявка принята в работу' }), 4500);
  setTimeout(
    () =>
      advance(id, 'awaiting-docs', {
        comment: 'Приложите документы: Предыдущее водительское удостоверение',
        docRequest: DOC_REQUEST,
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
  scheduleSupportProgress(process.id);
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

/** Прикрепить документ к заявке (заглушка). Возвращает заявку в работу. */
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

seedProcess(0, 180);
