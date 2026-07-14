import { HttpResponse, type HttpRequest } from '@angular/common/http';
import { type Observable, of, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { type ApiResponse } from '@core/models';
import {
  DEAL_STATUS_LABEL,
  isClosedDeal,
  type AwaitingDeal,
  type Deal,
  type DealRow,
} from '@core/services/deal.model';

import {
  acceptOffer,
  addDealMessage,
  createDeal,
  deals,
  requestRequote,
  type CreateDealInput,
} from '../fixtures/deals.fixture';
import { randomDelay } from '../helpers/delay';

// Сделки («Согласование») — критичный путь демо, отвечаем гарантированным успехом
// (в обход random-fail из mockOk), как и заявки по договору.

function ok<T>(data: T, status = 200): Observable<HttpResponse<ApiResponse<T>>> {
  return timer(randomDelay()).pipe(
    mergeMap(() =>
      of(new HttpResponse({ status, body: { success: true, data, error: null, meta: null } })),
    ),
  );
}

function dealIdFromUrl(url: string): string {
  return url.match(/\/deals\/([^/?]+)/)?.[1] ?? '';
}

function findDeal(url: string): Deal | undefined {
  const id = dealIdFromUrl(url);
  return deals.find((d) => d.id === id);
}

function toRow(d: Deal): DealRow {
  return {
    id: d.id,
    requestNumber: d.requestNumber,
    createdAt: d.createdAt,
    clientName: d.clientName,
    objectLabel: d.objectLabel,
    productLabel: d.productLabel,
    premium: d.premium,
    status: d.status,
    statusLabel: DEAL_STATUS_LABEL[d.status],
    insurerName: d.insurerName,
    actionRequired: d.actionRequired,
    resultingPolicyNumber: d.resultingPolicyNumber,
  };
}

/** Строки сделок для «Мои клиенты» (свежие сверху). */
export function handleGetDeals(): Observable<HttpResponse<ApiResponse<DealRow[]>>> {
  const rows = [...deals].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toRow);
  return ok(rows);
}

export function handleGetDeal(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<Deal | null>>> {
  return ok(findDeal(req.url) ?? null);
}

/**
 * Сделки, где мяч у агента — питает сигнал «Ждут ваших действий».
 * Определяется НАЛИЧИЕМ actionRequired (флаг бэкенда), а не догадкой фронта по статусу.
 */
export function handleListAwaitingDeals(): Observable<HttpResponse<ApiResponse<AwaitingDeal[]>>> {
  const items: AwaitingDeal[] = deals
    .filter((d) => !isClosedDeal(d.status) && d.actionRequired)
    .map((d) => ({
      dealId: d.id,
      requestNumber: d.requestNumber,
      clientName: d.clientName,
      need: d.actionRequired?.label ?? '',
    }));
  return ok(items);
}

export function handleCreateDeal(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<Deal>>> {
  const input = req.body as CreateDealInput;
  return ok(createDeal(input), 201);
}

/** Акцепт тарифа — явное значимое событие, не реплика в переписке. */
export function handleAcceptOffer(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<Deal | null>>> {
  const deal = findDeal(req.url);
  if (!deal) return ok(null);
  acceptOffer(deal);
  return ok(deal);
}

/** Запрос пересчёта — итерация торга, приходит НОВАЯ версия тарифа. */
export function handleRequoteOffer(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<Deal | null>>> {
  const deal = findDeal(req.url);
  if (!deal) return ok(null);
  const { comment } = (req.body ?? {}) as { comment?: string };
  requestRequote(deal, comment?.trim() || 'Дорого для клиента');
  return ok(deal);
}

export function handleAddDealMessage(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<Deal | null>>> {
  const deal = findDeal(req.url);
  if (!deal) return ok(null);
  const { text } = (req.body ?? {}) as { text?: string };
  if (text?.trim()) addDealMessage(deal, text.trim());
  return ok(deal);
}

/** Отметить сообщения поддержки прочитанными (агент открыл сделку). */
export function handleReadDealMessages(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<Deal | null>>> {
  const deal = findDeal(req.url);
  if (!deal) return ok(null);
  deal.messages.forEach((m) => {
    if (m.actor !== 'agent') m.read = true;
  });
  return ok(deal);
}
