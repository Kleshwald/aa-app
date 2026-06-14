import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import {
  FinanceService,
  type FinanceResults,
  type PayoutAct,
  type PayoutRow,
  type PayoutStatus,
} from '@core/services/finance.service';

type Tab = 'results' | 'payout' | 'history';

const HISTORY_STATUS_LABEL: Record<PayoutStatus, string> = {
  preparing: 'Готовим выплату',
  paid: 'Выплачено',
};

@Component({
  selector: 'app-finance-page',
  imports: [DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance.page.html',
  styleUrl: './finance.page.scss',
})
export class FinancePage {
  private readonly finance = inject(FinanceService);

  protected readonly historyStatusLabel = HISTORY_STATUS_LABEL;
  protected readonly activeTab = signal<Tab>('results');

  // ─── Мои результаты ───
  private readonly resultsResponse = toSignal(this.finance.results(), { initialValue: undefined });
  protected readonly results = computed<FinanceResults | null>(
    () => this.resultsResponse()?.data ?? null,
  );
  protected readonly resultsLoading = computed(() => this.resultsResponse() === undefined);
  protected readonly progressPct = computed(() => {
    const r = this.results();
    if (!r || r.nextThreshold <= 0) return 0;
    return Math.min(100, Math.round((r.collected / r.nextThreshold) * 100));
  });

  // ─── К выплате ───
  private readonly payoutsResponse = toSignal(this.finance.payouts(), { initialValue: undefined });
  protected readonly payouts = computed<PayoutRow[]>(() => this.payoutsResponse()?.data ?? []);
  protected readonly payoutsLoading = computed(() => this.payoutsResponse() === undefined);
  protected readonly payoutTotal = computed(() =>
    this.payouts().reduce((sum, row) => sum + row.payout, 0),
  );
  protected readonly confirmed = signal(false);
  protected readonly requested = signal(false);

  // ─── История выплат (только свои акты) ───
  private readonly historyResponse = toSignal(this.finance.history(), { initialValue: undefined });
  protected readonly history = computed<PayoutAct[]>(() => this.historyResponse()?.data ?? []);
  protected readonly historyLoading = computed(() => this.historyResponse() === undefined);

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  onConfirmChange(event: Event): void {
    this.confirmed.set((event.target as HTMLInputElement).checked);
  }

  requestPayout(): void {
    if (!this.confirmed()) return;
    this.requested.set(true);
  }
}
