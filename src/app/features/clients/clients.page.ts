import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, startWith, switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

import { ClientService, type ClientRow, type ClientsQuery } from '@core/services/client.service';

const PRODUCT_LABEL: Record<ClientRow['type'], string> = {
  OSAGO: 'ОСАГО',
  NS: 'НС при ДТП',
  TICK: 'Антиклещ',
  MORTGAGE: 'Ипотека',
};

const STATUS_LABEL: Record<ClientRow['status'], string> = {
  active: 'Оформлен',
  expired: 'Истёк',
  cancelled: 'Расторгнут',
  pending: 'Черновик',
  processing: 'В обработке',
};

@Component({
  selector: 'app-clients-page',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clients.page.html',
  styleUrl: './clients.page.scss',
})
export class ClientsPage {
  private readonly service = inject(ClientService);
  private readonly router = inject(Router);

  openRow(row: ClientRow): void {
    void this.router.navigate(['/clients', row.id]);
  }

  protected readonly productLabel = PRODUCT_LABEL;
  protected readonly statusLabel = STATUS_LABEL;

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly period = signal<NonNullable<ClientsQuery['period']>>('this-month');
  protected readonly status = signal<string>('');
  protected readonly type = signal<string>('');
  protected readonly insuranceCompany = signal<string>('');

  protected readonly query = computed<ClientsQuery>(() => ({
    page: 1,
    pageSize: 50,
    period: this.period(),
    status: this.status() || undefined,
    type: this.type() || undefined,
    insuranceCompanyId: this.insuranceCompany() || undefined,
  }));

  private readonly search$ = this.searchControl.valueChanges.pipe(
    startWith(''),
    debounceTime(300),
    distinctUntilChanged(),
  );

  private readonly query$ = toObservable(this.query);

  protected readonly response = toSignal(
    this.query$.pipe(
      switchMap((q) =>
        this.search$.pipe(
          switchMap((search) => this.service.list({ ...q, search: search || undefined })),
        ),
      ),
    ),
    { initialValue: undefined },
  );

  protected readonly rows = computed<ClientRow[]>(() => this.response()?.data ?? []);
  protected readonly isLoading = computed(() => this.response() === undefined);
  protected readonly hasError = computed(() => {
    const r = this.response();
    return r !== undefined && !r.success;
  });
  protected readonly errorMessage = computed(() => this.response()?.error?.message ?? null);

  // Totals over the currently loaded/filtered rows — feeds the table "Итого" footer.
  protected readonly summary = computed(() => {
    const rows = this.rows();
    return {
      total: rows.length,
      premium: rows.reduce((sum, r) => sum + (r.premium ?? 0), 0),
    };
  });

  setPeriod(p: NonNullable<ClientsQuery['period']>): void {
    this.period.set(p);
  }

  resetFilters(): void {
    this.period.set('this-month');
    this.status.set('');
    this.type.set('');
    this.insuranceCompany.set('');
    this.searchControl.setValue('');
  }
}
