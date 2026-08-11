import { HttpResponse, type HttpRequest } from '@angular/common/http';
import { type Observable, of, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { type ApiResponse } from '@core/models';
import {
  PROCESS_KIND_LABEL,
  processStatusLabel,
  type PolicyProcess,
  type ProcessStatus,
} from '@core/services/process.service';
import {
  ballOfStatus,
  toneOfStatus,
  type SupportChatThread,
  type SupportNote,
  type SupportQueueItem,
  type SupportRequestDetail,
} from '@core/services/support.model';

import { currentAgent } from '../fixtures/agents.fixture';
import { policies } from '../fixtures/policies.fixture';
import { processes } from '../fixtures/processes.fixture';
import {
  findSupportRequest,
  pushThreadReply,
  supportRequests,
  supportThreads,
} from '../fixtures/support.fixture';
import { randomDelay } from '../helpers/delay';

// Кокпит поддержки. Ключевое: заявки демо-агента берём из ЖИВОЙ фикстуры `processes` —
// той самой, что читает кабинет агента. Поэтому «запросить документы» из кокпита
// зажигает у агента «Ждут ваших действий», а ответ поддержки появляется в его ленте
// заявки. Ради этой петли кокпит и живёт в одном приложении с кабинетом.

const SUPPORT_NAME = 'Поддержка Agent Academy';

/** Копия, а не живая ссылка — иначе сигналы Angular не увидят мутацию фикстуры. */
function ok<T>(data: T, status = 200): Observable<HttpResponse<ApiResponse<T>>> {
  const copy = data === null || data === undefined ? data : (structuredClone(data) as T);
  return timer(randomDelay()).pipe(
    mergeMap(() =>
      of(
        new HttpResponse({ status, body: { success: true, data: copy, error: null, meta: null } }),
      ),
    ),
  );
}

function idFromUrl(url: string, segment: string): string {
  return url.match(new RegExp(`/${segment}/([^/?]+)`))?.[1] ?? '';
}

// ─── Побочные данные по живым заявкам ────────────────────────────────────────
// Внутренние заметки и признак «ушло в СК» НЕ кладём в PolicyProcess: этот объект
// целиком уезжает агенту. Внутреннее хранение здесь — заодно напоминание, что в
// контракте у заявки должны быть ДВА представления: агентское и операторское.

const liveNotes = new Map<string, SupportNote[]>();
const liveAtInsurer = new Set<string>();

// ─── Проекции ────────────────────────────────────────────────────────────────

/** Живая заявка демо-агента → карточка поддержки (джойн с полисом за реквизитами). */
function fromLiveProcess(proc: PolicyProcess): SupportRequestDetail {
  const policy = policies.find((p) => p.id === proc.policyId);
  return {
    id: proc.id,
    requestNumber: proc.requestNumber,
    kind: proc.kind,
    status: proc.status,
    reasons: proc.reasons,
    createdAt: proc.createdAt,

    policyId: proc.policyId,
    policyNumber: proc.policyNumber,
    insurer: policy?.insuranceCompanyName ?? '—',
    policyholder: policy?.clientName ?? '—',
    owner: policy?.clientName ?? '—',
    vehicle: policy
      ? `${policy.vehicleBrand} ${policy.vehicleModel} · ${policy.vehicleLicensePlate}`
      : '—',
    premium: policy?.premium ?? 0,
    startDate: policy?.startDate ?? proc.createdAt,
    endDate: policy?.endDate ?? proc.createdAt,

    refundAmount:
      proc.kind === 'cancel' ? refundFor(policy?.premium ?? 0, policy?.endDate) : undefined,

    agentName: currentAgent.fullName,
    agentIkp: currentAgent.ikp,
    agentPhone: currentAgent.phone,
    region: `${currentAgent.region}, ${currentAgent.district}`,
    curatorName: currentAgent.curatorName,

    assignee: proc.responsibleName ?? null,
    atInsurer: liveAtInsurer.has(proc.id),
    statusHistory: proc.statusHistory,
    comments: proc.comments,
    notes: liveNotes.get(proc.id) ?? [],
    attachments: proc.attachments,
    live: true,
  };
}

/**
 * Калькулятор возврата премии при расторжении `[Р-ФТ-4]`:
 * (Премия − 23% × Премия) / дней действия × дней остатка.
 */
function refundFor(premium: number, endDate?: string): number {
  if (!premium || !endDate) return 0;
  const end = new Date(endDate).getTime();
  const left = Math.max(0, Math.round((end - Date.now()) / 86_400_000));
  return Math.round(((premium - 0.23 * premium) / 365) * Math.min(left, 365));
}

function queueItemFromRequest(r: SupportRequestDetail): SupportQueueItem {
  const last = r.statusHistory[r.statusHistory.length - 1];
  return {
    id: r.id,
    source: '1c',
    link: `/support/requests/${r.id}`,
    kind: r.kind,
    requestNumber: r.requestNumber,
    topic: PROCESS_KIND_LABEL[r.kind],
    detail: `${r.policyNumber} · ${r.policyholder}`,
    agentName: r.agentName,
    agentIkp: r.agentIkp,
    region: r.region,
    insurer: r.insurer,
    statusLabel: processStatusLabel(r.status, r.kind),
    tone: toneOfStatus(r.status),
    ball: ballOfStatus(r.status, r.atInsurer),
    assignee: r.assignee,
    sinceIso: last?.at ?? r.createdAt,
    createdIso: r.createdAt,
    live: r.live,
  };
}

function queueItemFromThread(t: SupportChatThread): SupportQueueItem {
  const last = t.messages[t.messages.length - 1];
  const waitingUs = last?.author === 'agent';
  return {
    id: t.id,
    source: 'chat',
    link: `/support/threads/${t.id}`,
    topic: t.topic,
    detail: last?.text ?? '',
    agentName: t.agentName,
    agentIkp: t.agentIkp,
    region: t.region,
    statusLabel: t.escalatedTo
      ? `Передано: ${t.escalatedTo}`
      : waitingUs
        ? 'Ждёт ответа'
        : 'Ответ отправлен',
    tone: waitingUs ? 'new' : 'work',
    ball: waitingUs ? 'support' : 'agent',
    assignee: t.assignee,
    sinceIso: last?.at ?? new Date().toISOString(),
    createdIso: t.messages[0]?.at ?? new Date().toISOString(),
    live: t.live,
  };
}

/** Все заявки в одном списке: живые (демо-агент) + «чужие» из фикстуры. */
function allRequests(): SupportRequestDetail[] {
  return [...processes.map(fromLiveProcess), ...supportRequests];
}

function findAnyRequest(id: string): SupportRequestDetail | undefined {
  const live = processes.find((p) => p.id === id);
  if (live) return fromLiveProcess(live);
  return findSupportRequest(id);
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/** GET /support/queue — общая очередь: заявки (1С) + диалоги (чат), свежее движение сверху. */
export function handleSupportQueue(): Observable<HttpResponse<ApiResponse<unknown>>> {
  const items: SupportQueueItem[] = [
    ...allRequests().map(queueItemFromRequest),
    ...supportThreads.map(queueItemFromThread),
  ].sort((a, b) => b.sinceIso.localeCompare(a.sinceIso));
  return ok(items);
}

/** GET /support/requests/:id — карточка задачи. */
export function handleSupportRequest(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  return ok(findAnyRequest(idFromUrl(req.url, 'requests')) ?? null);
}

/** POST /support/requests/:id/assign — взять на себя / сменить ответственного. */
export function handleSupportAssign(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const id = idFromUrl(req.url, 'requests');
  const assignee = ((req.body ?? {}) as { assignee?: string | null }).assignee ?? null;
  const live = processes.find((p) => p.id === id);
  if (live) {
    live.responsibleName = assignee ?? undefined;
  } else {
    const other = findSupportRequest(id);
    if (other) other.assignee = assignee;
  }
  return ok(findAnyRequest(id) ?? null);
}

/** POST /support/requests/:id/reply — ответ агенту в переписке по заявке (агент это видит). */
export function handleSupportReply(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const id = idFromUrl(req.url, 'requests');
  const text = ((req.body ?? {}) as { text?: string }).text?.trim() ?? '';
  if (text) {
    const comment = {
      at: new Date().toISOString(),
      author: 'support' as const,
      authorName: SUPPORT_NAME,
      text,
    };
    const live = processes.find((p) => p.id === id);
    if (live) live.comments.push(comment);
    else findSupportRequest(id)?.comments.push(comment);
  }
  return ok(findAnyRequest(id) ?? null);
}

/** POST /support/requests/:id/note — внутренняя заметка (агенту НЕ видна). */
export function handleSupportNote(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const id = idFromUrl(req.url, 'requests');
  const body = (req.body ?? {}) as { text?: string; author?: string };
  const text = body.text?.trim() ?? '';
  if (text) {
    const note: SupportNote = {
      at: new Date().toISOString(),
      author: body.author ?? SUPPORT_NAME,
      text,
    };
    const live = processes.find((p) => p.id === id);
    if (live) {
      liveNotes.set(id, [...(liveNotes.get(id) ?? []), note]);
    } else {
      findSupportRequest(id)?.notes.push(note);
    }
  }
  return ok(findAnyRequest(id) ?? null);
}

/**
 * POST /support/requests/:id/status — движение по статусной модели.
 * Всё, что здесь происходит с живой заявкой, агент видит у себя: статус в строке
 * «Мои клиенты», ленту заявки на странице договора и сигнал «Ждут ваших действий».
 */
export function handleSupportStatus(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const id = idFromUrl(req.url, 'requests');
  const body = (req.body ?? {}) as {
    status?: ProcessStatus;
    comment?: string;
    docItems?: string[];
    atInsurer?: boolean;
  };
  const status = body.status;
  if (!status) return ok(findAnyRequest(id) ?? null);

  const docRequest =
    body.docItems && body.docItems.length > 0
      ? { title: 'Приложите документы', items: body.docItems }
      : undefined;

  const live = processes.find((p) => p.id === id);
  if (live) {
    live.status = status;
    live.statusHistory.push({
      at: new Date().toISOString(),
      status,
      author: 'support',
      requestNumber: live.requestNumber,
      comment: body.comment,
      docRequest,
    });
    if (body.atInsurer === true) liveAtInsurer.add(id);
    if (body.atInsurer === false) liveAtInsurer.delete(id);
  } else {
    const other = findSupportRequest(id);
    if (other) {
      other.status = status;
      other.statusHistory.push({
        at: new Date().toISOString(),
        status,
        author: 'support',
        requestNumber: other.requestNumber,
        comment: body.comment,
        docRequest,
      });
      if (body.atInsurer !== undefined) other.atInsurer = body.atInsurer;
    }
  }
  return ok(findAnyRequest(id) ?? null);
}

/** GET /support/threads/:id — диалог с агентом. */
export function handleSupportThread(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const id = idFromUrl(req.url, 'threads');
  return ok(supportThreads.find((t) => t.id === id) ?? null);
}

/** POST /support/threads/:id/reply — ответ оператора в чат. */
export function handleSupportThreadReply(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const id = idFromUrl(req.url, 'threads');
  const body = (req.body ?? {}) as { text?: string; author?: string };
  const text = body.text?.trim() ?? '';
  if (text) pushThreadReply(id, text, body.author ?? SUPPORT_NAME);
  return ok(supportThreads.find((t) => t.id === id) ?? null);
}

/**
 * POST /support/threads/:id/escalate — передать во 2-ю линию ПО ТЕМЕ.
 * Эскалация внутрь — не «наверх начальнику», а к специалисту по теме
 * (расчёты · скоринг · пул/Автопомощник · техбаги), docs/SUPPORT.md §2.
 */
export function handleSupportEscalate(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const id = idFromUrl(req.url, 'threads');
  const topic = ((req.body ?? {}) as { topic?: string }).topic ?? '';
  const thread = supportThreads.find((t) => t.id === id);
  if (thread && topic) {
    thread.escalatedTo = topic;
    thread.messages.push({
      at: new Date().toISOString(),
      id: `esc-${thread.messages.length + 1}`,
      author: 'support',
      authorName: SUPPORT_NAME,
      text: `Передали вопрос специалисту: ${topic}. Вернёмся с ответом здесь же.`,
    });
  }
  return ok(thread ?? null);
}

/** POST /support/threads/:id/assign — взять диалог на себя. */
export function handleSupportThreadAssign(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const id = idFromUrl(req.url, 'threads');
  const assignee = ((req.body ?? {}) as { assignee?: string | null }).assignee ?? null;
  const thread = supportThreads.find((t) => t.id === id);
  if (thread) thread.assignee = assignee;
  return ok(thread ?? null);
}
