import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

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
  imports: [DatePipe, DecimalPipe, RouterLink],
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

  // ─── SVG-кольца (рукописная визуализация, без библиотек) ───
  private readonly RING_CIRC = 2 * Math.PI * 86; // главное кольцо, r=86
  private readonly POOL_RING_CIRC = 2 * Math.PI * 50; // кольцо доли пула, r=50
  protected readonly ringDash = this.RING_CIRC;
  protected readonly poolRingDash = this.POOL_RING_CIRC;
  protected readonly ringOffset = computed(() => this.RING_CIRC * (1 - this.progressPct() / 100));
  protected readonly ringColor = computed(() =>
    this.progressPct() >= 100 ? 'var(--success-600)' : 'var(--accent-500)',
  );
  protected readonly poolShareOffset = computed(() => {
    const pct = this.results()?.pool.poolSharePct ?? 0;
    return this.POOL_RING_CIRC * (1 - pct / 100);
  });

  // ─── Состав перестраховочного пула (сегментированный бар) ───
  protected readonly poolSegments = computed(() => {
    const p = this.results()?.pool;
    if (!p) return [];
    const items = [
      { label: 'ОСАГО Пул', count: p.osagoPoolCount, color: 'var(--brand-500)' },
      { label: 'Автопомощник', count: p.autoHelper, color: 'var(--accent-600)' },
      { label: 'Надёжная поездка', count: p.reliableTrip, color: 'var(--accent-500)' },
      { label: 'Надёжная поездка +', count: p.reliableTripPlus, color: 'var(--accent-400)' },
      { label: 'Надёжная поездка ЭКО', count: p.reliableTripEco, color: 'var(--accent-300)' },
    ];
    const total = items.reduce((sum, i) => sum + i.count, 0) || 1;
    return items.map((i) => ({
      ...i,
      widthPct: (i.count / total) * 100,
      sharePct: Math.round((i.count / total) * 100),
    }));
  });
  protected readonly poolTotal = computed(() =>
    this.poolSegments().reduce((sum, s) => sum + s.count, 0),
  );

  /** «100 тыс» / «старт» для подписей лестницы уровней. */
  tierThresholdLabel(threshold: number): string {
    return threshold === 0 ? 'старт' : `${Math.round(threshold / 1000)} тыс`;
  }

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
