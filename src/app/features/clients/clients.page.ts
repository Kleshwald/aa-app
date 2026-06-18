import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, startWith, switchMap } from 'rxjs';
import { TuiTextfield, tuiTextfieldOptionsProvider } from '@taiga-ui/core';
import { TuiInputDate, tuiInputDateOptionsProvider } from '@taiga-ui/kit';

import { ClientService, type ClientRow, type ClientsQuery } from '@core/services/client.service';
import { IsoDayTransformer } from '@shared/iso-day.transformer';

type PeriodKey = 'today' | 'this-month' | 'this-quarter' | 'this-year' | 'all' | 'custom';

function isoDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

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
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, TuiTextfield, TuiInputDate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clients.page.html',
  styleUrl: './clients.page.scss',
  providers: [
    tuiInputDateOptionsProvider({ valueTransformer: new IsoDayTransformer() }),
    tuiTextfieldOptionsProvider({ cleaner: signal(false) }),
  ],
})
export class ClientsPage {
  private readonly service = inject(ClientService);
  private readonly router = inject(Router);

  openRow(row: ClientRow): void {
    void this.router.navigate(['/clients', row.id]);
  }

  protected readonly productLabel = PRODUCT_LABEL;
  protected readonly statusLabel = STATUS_LABEL;

  // Объект страхования зависит от продукта: ОСАГО — авто, НС/Антиклещ — здоровье,
  // ипотека — недвижимость. (В таблице у ОСАГО дополнительно показываем госномер.)
  protected objectLabel(row: ClientRow): string {
    switch (row.type) {
      case 'NS':
      case 'TICK':
        return 'Здоровье';
      case 'MORTGAGE':
        return 'Недвижимость';
      default:
        return `${row.vehicleBrand} ${row.vehicleModel}`.trim();
    }
  }

  // Колонки таблицы; key — поле сортировки (без key колонка не сортируется).
  // Сортируем только по Дате и Цене — остальное агенту сортировать не нужно.
  protected readonly columns: { label: string; key?: string; num?: boolean }[] = [
    { label: 'Дата', key: 'createdAt' },
    { label: 'Страхователь' },
    { label: 'Объект страхования' },
    { label: '№ полиса' },
    { label: 'Продукт' },
    { label: 'Цена', key: 'premium', num: true },
    { label: 'Статус' },
    { label: 'Страховая компания' },
  ];

  protected readonly sortKey = signal('createdAt');
  protected readonly sortOrder = signal<'asc' | 'desc'>('desc');

  toggleSort(key: string): void {
    if (this.sortKey() === key) {
      this.sortOrder.update((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortOrder.set('asc');
    }
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortOrder() === 'asc' ? 'ascending' : 'descending';
  }

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly period = signal<PeriodKey>('this-month');
  protected readonly status = signal<string>('');
  protected readonly type = signal<string>('');
  protected readonly insuranceCompany = signal<string>('');

  // Произвольный период — два календаря (ISO-строки через IsoDayTransformer).
  protected readonly fromControl = new FormControl<string>('', { nonNullable: true });
  protected readonly toControl = new FormControl<string>('', { nonNullable: true });
  private readonly fromValue = toSignal(this.fromControl.valueChanges, { initialValue: '' });
  private readonly toValue = toSignal(this.toControl.valueChanges, { initialValue: '' });

  // Диапазон дат: либо пресет (Сегодня/месяц/…), либо ручной выбор «начало–конец».
  private readonly dateRange = computed<{ from?: string; to?: string }>(() => {
    const key = this.period();
    if (key === 'all') return {};
    if (key === 'custom')
      return { from: this.fromValue() || undefined, to: this.toValue() || undefined };
    const now = new Date();
    const today = isoDay(now);
    switch (key) {
      case 'today':
        return { from: today, to: today };
      case 'this-quarter':
        return {
          from: isoDay(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)),
          to: today,
        };
      case 'this-year':
        return { from: isoDay(new Date(now.getFullYear(), 0, 1)), to: today };
      case 'this-month':
      default:
        return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    }
  });

  protected readonly query = computed<ClientsQuery>(() => {
    const range = this.dateRange();
    return {
      page: 1,
      pageSize: 50,
      dateFrom: range.from,
      dateTo: range.to,
      status: this.status() || undefined,
      type: this.type() || undefined,
      insuranceCompanyId: this.insuranceCompany() || undefined,
      sortBy: this.sortKey(),
      sortOrder: this.sortOrder(),
    };
  });

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

  setPeriod(p: PeriodKey): void {
    this.period.set(p);
  }

  resetFilters(): void {
    this.period.set('this-month');
    this.status.set('');
    this.type.set('');
    this.insuranceCompany.set('');
    this.searchControl.setValue('');
    this.fromControl.setValue('');
    this.toControl.setValue('');
  }
}
