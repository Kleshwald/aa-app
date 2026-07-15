import { HttpResponse, type HttpRequest } from '@angular/common/http';
import { type Observable, of, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { type ApiResponse } from '@core/models';
import {
  isCompletedProcess,
  type ActiveProcess,
  type AwaitingProcess,
  type CreateProcessPayload,
} from '@core/services/process.service';

import { policies } from '../fixtures/policies.fixture';
import { addAttachment, addComment, createProcess, processes } from '../fixtures/processes.fixture';
import { randomDelay } from '../helpers/delay';

// Заявки по договору — критичный путь демо (процессы = отличие платформы),
// поэтому отвечаем гарантированным успехом (в обход random-fail из mockOk).

/**
 * Отдаём КОПИЮ, а не живую ссылку на объект из фикстуры — как настоящий бэкенд,
 * который сериализует ответ. Мок, отдающий живую ссылку, врёт: фикстура мутируется
 * на месте (поддержка «отвечает» через setTimeout) → ссылка та же → Angular-сигналы
 * (сравнение по ссылке) считают, что ничего не изменилось, и ход заявки замирает,
 * пока окно открыто. Тот же класс ошибки чинили в сделках (deals.handler `8db8d9d`).
 */
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

function policyIdFromUrl(url: string): string {
  return url.match(/\/policies\/([^/?]+)\/processes/)?.[1] ?? '';
}
function processIdFromUrl(url: string): string {
  return url.match(/\/processes\/([^/?]+)\//)?.[1] ?? '';
}

/** GET /policies/:id/processes — заявки по договору, свежие сверху. */
export function handleListPolicyProcesses(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const policyId = policyIdFromUrl(req.url);
  const list = processes.filter((p) => p.policyId === policyId);
  return ok(list);
}

/**
 * GET /processes/awaiting — заявки, ждущие действия агента (по всем полисам).
 * Джойним с полисом за именем клиента (в самой заявке его нет) и вытаскиваем
 * последний запрос документов для человеческой подписи «что нужно».
 */
export function handleListAwaitingProcesses(): Observable<HttpResponse<ApiResponse<unknown>>> {
  const awaiting: AwaitingProcess[] = processes
    .filter((p) => p.status === 'awaiting-docs')
    .map((p) => {
      const policy = policies.find((x) => x.id === p.policyId);
      const docRequest = [...p.statusHistory].reverse().find((e) => e.docRequest)?.docRequest;
      // Пункт говорит КОНКРЕТНО, что нужно от агента: без «ждут» (не дублируем
      // заголовок «Ждут ваших действий») и без метафоры «ваш ход» (аудитория 45+).
      const need = docRequest
        ? `Нужны документы: ${docRequest.items.join(', ')}`
        : 'Нужен ваш ответ по заявке';
      return {
        processId: p.id,
        requestNumber: p.requestNumber,
        policyId: p.policyId,
        policyNumber: p.policyNumber,
        clientName: policy?.clientName ?? `Полис ${p.policyNumber}`,
        kind: p.kind,
        need,
      };
    });
  return ok(awaiting);
}

/**
 * GET /processes/active — ВСЕ незакрытые заявки по всем полисам (инбокс «Процессы»).
 * И «ваш ход», и «в работе»: свежие сверху. Джойн имени клиента с полисом.
 */
export function handleListActiveProcesses(): Observable<HttpResponse<ApiResponse<unknown>>> {
  const items: ActiveProcess[] = processes
    .filter((p) => !isCompletedProcess(p.status))
    .map((p) => {
      const policy = policies.find((x) => x.id === p.policyId);
      const last = p.statusHistory[p.statusHistory.length - 1];
      return {
        processId: p.id,
        requestNumber: p.requestNumber,
        policyId: p.policyId,
        policyNumber: p.policyNumber,
        clientName: policy?.clientName ?? `Полис ${p.policyNumber}`,
        kind: p.kind,
        status: p.status,
        awaiting: p.status === 'awaiting-docs',
        since: last?.at ?? p.createdAt,
      };
    })
    .sort((a, b) => b.since.localeCompare(a.since));
  return ok(items);
}

/** POST /policies/:id/processes — создать заявку (внесение изменений). */
export function handleCreateProcess(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const policyId = policyIdFromUrl(req.url);
  const body = (req.body ?? {}) as Partial<CreateProcessPayload>;
  const policy = policies.find((p) => p.id === policyId);
  const process = createProcess({
    policyId,
    policyNumber: policy?.number ?? '',
    kind: body.kind ?? 'change',
    reasons: body.reasons ?? [],
    formSnapshot: body.formSnapshot,
  });
  return ok({ id: process.id, requestNumber: process.requestNumber }, 201);
}

/** POST /processes/:id/comments — комментарий агента (поддержка ответит отложенно). */
export function handleAddProcessComment(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const id = processIdFromUrl(req.url);
  const text = ((req.body ?? {}) as { text?: string }).text ?? '';
  const process = addComment(id, text) ?? null;
  return ok(process);
}

/** POST /processes/:id/documents — приложить документ к заявке (заглушка). */
export function handleUploadProcessDoc(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const id = processIdFromUrl(req.url);
  const name = ((req.body ?? {}) as { name?: string }).name ?? 'Документ';
  const process = addAttachment(id, name) ?? null;
  return ok(process);
}
