import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ProlongationService,
  type ProlongationRow,
  type ProlongationStatus,
  type RsaSearchRow,
  type RsaStatus,
} from '@core/services/prolongation.service';

const STATUS_LABEL: Record<ProlongationStatus, string> = {
  issued: 'Оформлено',
  calculated: 'Рассчитано',
  declined: 'Отказ клиента',
  'not-renewed': 'Не продлён',
};

const RSA_STATUS_LABEL: Record<RsaStatus, string> = {
  renewed: 'Продлён',
  'expiring-soon': '10 дней до окончания',
  expired: 'Просрочен',
};

@Component({
  selector: 'app-prolongation-page',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prolongation.page.html',
  styleUrl: './prolongation.page.scss',
})
export class ProlongationPage {
  private readonly service = inject(ProlongationService);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly rsaStatusLabel = RSA_STATUS_LABEL;

  protected readonly activeTab = signal<'my' | 'rsa'>('my');

  // ─── My prolongations ───
  protected readonly statsResponse = toSignal(this.service.stats(), { initialValue: undefined });
  protected readonly stats = computed(() => this.statsResponse()?.data ?? null);

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly statusFilter = signal<string>('');

  protected readonly myResponse = toSignal(this.service.list(), { initialValue: undefined });
  protected readonly myAll = computed<ProlongationRow[]>(() => this.myResponse()?.data ?? []);

  protected readonly myFiltered = computed<ProlongationRow[]>(() => {
    this.searchTick(); // re-evaluate when the (non-signal) search FormControl changes
    const query = (this.searchControl.value ?? '').trim().toLowerCase();
    const status = this.statusFilter();
    return this.myAll().filter((row) => {
      if (status && row.status !== status) return false;
      if (!query) return true;
      return (
        row.clientName.toLowerCase().includes(query) ||
        row.policyNumber.toLowerCase().includes(query) ||
        row.phone.includes(query) ||
        `${row.vehicleBrand} ${row.vehicleModel}`.toLowerCase().includes(query)
      );
    });
  });

  protected readonly isMyLoading = computed(() => this.myResponse() === undefined);

  // ─── RSA search ───
  protected readonly rsaName = new FormControl<string>('', { nonNullable: true });
  protected readonly rsaPlate = new FormControl<string>('', { nonNullable: true });
  protected readonly rsaLicense = new FormControl<string>('', { nonNullable: true });

  protected readonly rsaSearched = signal<boolean>(false);
  protected readonly rsaLoading = signal<boolean>(false);
  protected readonly rsaRows = signal<RsaSearchRow[]>([]);

  setTab(tab: 'my' | 'rsa'): void {
    this.activeTab.set(tab);
  }

  resetMyFilters(): void {
    this.searchControl.setValue('');
    this.statusFilter.set('');
  }

  searchRsa(): void {
    this.rsaLoading.set(true);
    this.rsaSearched.set(true);
    this.service
      .searchRsa({
        name: this.rsaName.value || undefined,
        plate: this.rsaPlate.value || undefined,
        license: this.rsaLicense.value || undefined,
      })
      .subscribe({
        next: (response) => {
          this.rsaLoading.set(false);
          this.rsaRows.set(response.success ? (response.data ?? []) : []);
        },
        error: () => {
          this.rsaLoading.set(false);
          this.rsaRows.set([]);
        },
      });
  }

  // For template — search input triggers re-evaluate of myFiltered via signal-bridge
  onSearchChange(): void {
    // FormControl.valueChanges is RxJS; we trigger a re-read by toggling a noop signal.
    this.searchTick.update((n) => n + 1);
  }

  protected readonly searchTick = signal(0);
}
