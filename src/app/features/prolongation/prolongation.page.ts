import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ProlongationService,
  type ProlongationRow,
  type ProlongationStatus,
  type NsisSearchRow,
  type NsisStatus,
} from '@core/services/prolongation.service';

const STATUS_LABEL: Record<ProlongationStatus, string> = {
  issued: 'Оформлено',
  calculated: 'Рассчитано',
  declined: 'Отказ клиента',
  'not-renewed': 'Не продлён',
};

const NSIS_STATUS_LABEL: Record<NsisStatus, string> = {
  renewed: 'Продлён',
  'expiring-soon': '10 дней до окончания',
  expired: 'Просрочен',
};

/** Экранирование значения для CSV (разделитель «;» — как ждёт Excel в ru-локали). */
function csvCell(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** ISO-дата → «ДД.ММ.ГГГГ» для выгрузки. */
function ruDate(iso: string): string {
  const parts = iso.slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : iso;
}

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
  protected readonly nsisStatusLabel = NSIS_STATUS_LABEL;

  protected readonly activeTab = signal<'my' | 'nsis'>('my');

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

  // ─── NSIS search ───
  protected readonly nsisName = new FormControl<string>('', { nonNullable: true });
  protected readonly nsisPlate = new FormControl<string>('', { nonNullable: true });
  protected readonly nsisLicense = new FormControl<string>('', { nonNullable: true });

  protected readonly nsisSearched = signal<boolean>(false);
  protected readonly nsisLoading = signal<boolean>(false);
  protected readonly nsisRows = signal<NsisSearchRow[]>([]);

  /** Телефон для атрибута tel: — только цифры и ведущий «+». */
  telHref(phone: string): string {
    return 'tel:' + phone.replace(/[^\d+]/g, '');
  }

  setTab(tab: 'my' | 'nsis'): void {
    this.activeTab.set(tab);
  }

  resetMyFilters(): void {
    this.searchControl.setValue('');
    this.statusFilter.set('');
  }

  /** Скачать текущий отфильтрованный список как CSV — для обзвона клиентов по пролонгации. */
  downloadCallList(): void {
    const rows = this.myFiltered();
    if (rows.length === 0) return;

    const header = [
      'ФИО страхователя',
      'Телефон',
      'Марка/модель',
      'Номер полиса',
      'Дата окончания',
      'Страховая компания',
      'Цена (прошл. год)',
      'Статус',
    ];
    const lines = rows.map((r) =>
      [
        r.clientName,
        r.phone,
        `${r.vehicleBrand} ${r.vehicleModel}`,
        r.policyNumber,
        ruDate(r.endDate),
        r.insuranceCompanyName,
        String(r.lastYearPrice),
        this.statusLabel[r.status],
      ]
        .map(csvCell)
        .join(';'),
    );
    const csv = [header.map(csvCell).join(';'), ...lines].join('\r\n');

    // BOM — чтобы Excel открыл кириллицу в UTF-8 корректно.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'пролонгация-прозвон.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  searchNsis(): void {
    this.nsisLoading.set(true);
    this.nsisSearched.set(true);
    this.service
      .searchNsis({
        name: this.nsisName.value || undefined,
        plate: this.nsisPlate.value || undefined,
        license: this.nsisLicense.value || undefined,
      })
      .subscribe({
        next: (response) => {
          this.nsisLoading.set(false);
          this.nsisRows.set(response.success ? (response.data ?? []) : []);
        },
        error: () => {
          this.nsisLoading.set(false);
          this.nsisRows.set([]);
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
