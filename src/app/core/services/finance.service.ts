import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

// ─── «Мои результаты» — мотивационный дашборд агента ───

export interface FinanceSegmentMetrics {
  totalCollected: number; // итого сборов за период, ₽
  osagoCount: number; // ОСАГО, кол-во
  avgAddonCheck: number; // средний чек по доп. продуктам, ₽
  penetrationPct: number; // уровень проникновения допов, %
}

export interface FinancePoolMetrics {
  osagoPoolCount: number; // ОСАГО Пул, кол-во
  autoHelper: number; // Автопомощник
  reliableTrip: number; // Надёжная поездка
  reliableTripPlus: number; // Надёжная поездка +
  reliableTripEco: number; // Надёжная поездка ЭКО
  poolSharePct: number; // доля Пула в портфеле, %
}

export interface FinanceResults {
  periodLabel: string; // «Июнь 2026»
  periodRange: string; // «1 – 14 июня»
  category: string; // текущая категория мотивации
  nextCategory: string | null; // следующая категория (null = максимум)
  collected: number; // сборы за период, ₽
  nextThreshold: number; // порог следующей категории, ₽
  amountToNext: number; // ещё нужно собрать, ₽
  dailyToNext: number; // ₽/день до конца периода
  daysLeft: number; // дней до конца периода
  segment: FinanceSegmentMetrics;
  pool: FinancePoolMetrics;
}

// ─── «К выплате» — начисленное вознаграждение по договорам ───

export interface PayoutRow {
  id: string;
  policyholder: string;
  contract: string;
  rewardPct: number; // вознаграждение, %
  premium: number; // страховая премия, ₽
  payout: number; // к выплате, ₽
}

// ─── «История выплат» — акты агента (только свои) ───

export type PayoutStatus = 'preparing' | 'paid';

export interface PayoutAct {
  id: string;
  actNumber: string; // «000022640»
  date: string; // ISO YYYY-MM-DD
  status: PayoutStatus;
  amount: number;
}

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly api = inject(ApiClient);

  results(): Observable<ApiResponse<FinanceResults>> {
    return this.api.get<FinanceResults>('/finance/results');
  }

  payouts(): Observable<ApiResponse<PayoutRow[]>> {
    return this.api.get<PayoutRow[]>('/finance/payouts');
  }

  history(): Observable<ApiResponse<PayoutAct[]>> {
    return this.api.get<PayoutAct[]>('/finance/history');
  }
}
