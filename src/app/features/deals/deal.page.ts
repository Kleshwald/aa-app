import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { switchMap, timer } from 'rxjs';

import {
  DEAL_BALL_LABEL,
  DEAL_STATUS_LABEL,
  currentOffer,
  isClosedDeal,
  type Deal,
  type DealOffer,
} from '@core/services/deal.model';
import { DealService } from '@core/services/deal.service';
import { BreadcrumbsComponent } from '@shared/breadcrumbs/breadcrumbs.component';

/**
 * Страница СДЕЛКИ («Согласование») — дело, у которого ещё нет договора.
 *
 * Главный экран всего флоу. Его несущая мысль (Анвар): настоящее ограничение —
 * не структура разделов, а то, что в асинхронной сделке на троих (агент — поддержка —
 * СК) агент НЕ ВИДИТ, у кого мяч. Поэтому наверху — блок «чей ход · что дальше ·
 * когда», который агент может ПРОЧИТАТЬ КЛИЕНТУ ВСЛУХ за 10 секунд, не открывая
 * другие экраны. Всё остальное на странице — вторично.
 */
@Component({
  selector: 'app-deal-page',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, BreadcrumbsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './deal.page.html',
  styleUrl: './deal.page.scss',
})
export class DealPage {
  private readonly service = inject(DealService);
  private readonly route = inject(ActivatedRoute);

  protected readonly statusLabel = DEAL_STATUS_LABEL;
  protected readonly ballLabel = DEAL_BALL_LABEL;

  private readonly dealId = this.route.snapshot.paramMap.get('id') ?? '';

  /** Поллинг: сделка живёт днями, а тариф может прийти прямо сейчас. */
  private readonly response = toSignal(
    timer(0, 4000).pipe(switchMap(() => this.service.get(this.dealId))),
    { initialValue: undefined },
  );

  protected readonly deal = computed<Deal | null>(() => {
    const r = this.response();
    return r?.success ? (r.data ?? null) : null;
  });
  protected readonly isLoading = computed(() => this.response() === undefined);
  protected readonly hasError = computed(() => {
    const r = this.response();
    return r !== undefined && !r.success;
  });

  protected readonly offer = computed<DealOffer | null>(() => {
    const d = this.deal();
    return d ? (currentOffer(d) ?? null) : null;
  });

  /** Тариф ждёт согласования агента (а не просто лежит в истории). */
  protected readonly offerNeedsDecision = computed(() => {
    const d = this.deal();
    return d?.status === 'offer-review' && !!this.offer() && !this.offer()?.acceptedAt;
  });

  protected readonly closed = computed(() => {
    const d = this.deal();
    return d ? isClosedDeal(d.status) : false;
  });

  /** Предыдущие версии тарифа — история торга (аудит «почему такая цена»). */
  protected readonly previousOffers = computed<DealOffer[]>(() => {
    const d = this.deal();
    if (!d || d.offers.length < 2) return [];
    return d.offers.slice(0, -1).reverse();
  });

  protected readonly messageControl = new FormControl<string>('', { nonNullable: true });
  protected readonly requoteOpen = signal(false);
  protected readonly requoteControl = new FormControl<string>('', { nonNullable: true });
  protected readonly linkCopied = signal(false);
  protected readonly busy = signal(false);

  constructor() {
    // Агент открыл сделку — гасим «непрочитанное» (иначе сигнал будет звать вечно).
    this.service.markRead(this.dealId).subscribe();
  }

  acceptOffer(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.service.acceptOffer(this.dealId).subscribe({
      next: () => this.busy.set(false),
      error: () => this.busy.set(false),
    });
  }

  toggleRequote(): void {
    this.requoteOpen.update((v) => !v);
  }

  sendRequote(): void {
    const comment = this.requoteControl.value.trim();
    if (!comment || this.busy()) return;
    this.busy.set(true);
    this.service.requote(this.dealId, comment).subscribe({
      next: () => {
        this.requoteControl.setValue('');
        this.requoteOpen.set(false);
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
  }

  sendMessage(): void {
    const text = this.messageControl.value.trim();
    if (!text) return;
    this.messageControl.setValue('');
    this.service.addMessage(this.dealId, text).subscribe();
  }

  copyPaymentLink(url: string): void {
    void navigator.clipboard?.writeText(url).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2500);
    });
  }

  /** Телефон клиента для tel: — только цифры и ведущий «+». */
  telHref(phone: string): string {
    return 'tel:' + phone.replace(/[^\d+]/g, '');
  }
}
