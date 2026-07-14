import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

import type { AwaitingDeal, Deal, DealRow } from './deal.model';

export interface CreateDealPayload {
  clientName: string;
  clientPhone: string;
  productLabel: string;
  objectLabel: string;
  request: string;
  desiredStart?: string;
}

/**
 * Сделки («Согласование») — заявка на оформление ДО появления полиса.
 * Отдельный домен от PolicyProcess: у процесса есть договор, у сделки его ещё нет.
 */
@Injectable({ providedIn: 'root' })
export class DealService {
  private readonly api = inject(ApiClient);

  /** Строки сделок — подмешиваются в «Мои клиенты» (картотека сделок). */
  list(): Observable<ApiResponse<DealRow[]>> {
    return this.api.get<DealRow[]>('/deals');
  }

  get(id: string): Observable<ApiResponse<Deal | null>> {
    return this.api.get<Deal | null>(`/deals/${id}`);
  }

  /** Сделки, где мяч у агента — для сигнала «Ждут ваших действий». */
  listAwaiting(): Observable<ApiResponse<AwaitingDeal[]>> {
    return this.api.get<AwaitingDeal[]>('/deals/awaiting');
  }

  create(payload: CreateDealPayload): Observable<ApiResponse<Deal>> {
    return this.api.post<Deal>('/deals', payload);
  }

  /** Согласовать тариф — явный акцепт (не реплика в переписке). */
  acceptOffer(dealId: string): Observable<ApiResponse<Deal | null>> {
    return this.api.post<Deal | null>(`/deals/${dealId}/accept`, {});
  }

  /** Попросить пересчёт — придёт новая ВЕРСИЯ тарифа. */
  requote(dealId: string, comment: string): Observable<ApiResponse<Deal | null>> {
    return this.api.post<Deal | null>(`/deals/${dealId}/requote`, { comment });
  }

  addMessage(dealId: string, text: string): Observable<ApiResponse<Deal | null>> {
    return this.api.post<Deal | null>(`/deals/${dealId}/messages`, { text });
  }

  markRead(dealId: string): Observable<ApiResponse<Deal | null>> {
    return this.api.post<Deal | null>(`/deals/${dealId}/read`, {});
  }
}
