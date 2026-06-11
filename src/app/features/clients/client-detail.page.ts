import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs';

import { ClientDetailService, type PolicyDetail } from '@core/services/client-detail.service';
import { type ApiResponse } from '@core/models';

const STATUS_LABEL: Record<PolicyDetail['status'], string> = {
  active: 'Оформлен',
  expired: 'Истёк',
  cancelled: 'Расторгнут',
  pending: 'Черновик',
  processing: 'В обработке',
};

const PRODUCT_LABEL: Record<PolicyDetail['type'], string> = {
  OSAGO: 'ОСАГО',
  NS: 'НС при ДТП',
  TICK: 'Антиклещ',
  MORTGAGE: 'Ипотека',
};

@Component({
  selector: 'app-client-detail-page',
  imports: [DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-detail.page.html',
  styleUrl: './client-detail.page.scss',
})
export class ClientDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ClientDetailService);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly productLabel = PRODUCT_LABEL;

  protected readonly showMore = signal(false);
  protected readonly selectedProcess = signal<string | null>(null);
  protected readonly selectedDocs = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedService = signal<string | null>(null);

  protected readonly response = toSignal<ApiResponse<PolicyDetail | null> | undefined>(
    this.route.paramMap.pipe(switchMap((params) => this.service.get(params.get('id') ?? ''))),
    { initialValue: undefined },
  );

  protected readonly policy = computed<PolicyDetail | null>(() => {
    const r = this.response();
    return r?.success ? (r.data ?? null) : null;
  });

  protected readonly isLoading = computed(() => this.response() === undefined);
  protected readonly hasError = computed(() => {
    const r = this.response();
    return r !== undefined && (!r.success || !r.data);
  });

  protected readonly allDocsSelected = computed(() => {
    const p = this.policy();
    return !!p && this.selectedDocs().size === p.documents.length && p.documents.length > 0;
  });

  protected readonly hasAnyDocs = computed(() => this.selectedDocs().size > 0);

  toggleAllDocs(): void {
    const p = this.policy();
    if (!p) return;
    if (this.allDocsSelected()) {
      this.selectedDocs.set(new Set());
    } else {
      this.selectedDocs.set(new Set(p.documents.map((d) => d.id)));
    }
  }

  toggleDoc(id: string): void {
    const next = new Set(this.selectedDocs());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedDocs.set(next);
  }

  isDocSelected(id: string): boolean {
    return this.selectedDocs().has(id);
  }

  submitProcess(): void {
    const choice = this.selectedProcess();
    if (!choice) return;
    // Prototype stub — real action will route into a process flow.
    alert(`Запустим процесс: ${choice}`);
  }

  downloadDocs(): void {
    if (!this.hasAnyDocs()) return;
    alert(`Скачиваем документы: ${[...this.selectedDocs()].join(', ')}`);
  }

  submitService(): void {
    const choice = this.selectedService();
    if (!choice) return;
    alert(`Оформим продукт: ${choice}`);
  }
}
