import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, startWith, switchMap, timer } from 'rxjs';
import { TuiTextfield, tuiTextfieldOptionsProvider } from '@taiga-ui/core';
import { TuiInputDate, tuiInputDateOptionsProvider } from '@taiga-ui/kit';

import { AttentionService } from '@core/services/attention.service';
import { ClientService, type ClientRow, type ClientsQuery } from '@core/services/client.service';
import { isClosedDeal, type DealRow } from '@core/services/deal.model';
import { DealService } from '@core/services/deal.service';
import { type ProcessKind, type ProcessStatus } from '@core/services/process.service';
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

// Вид заявки — СЛОВОМ (коды ВИ/Р/УУ запрещены: их не расшифровывают).
const PROCESS_KIND_SHORT: Record<ProcessKind, string> = {
  change: 'Изменение',
  cancel: 'Расторжение',
  loss: 'Убыток',
};

// Расширенный статус заявки — в КОЛОНКУ «Статус» (владелец 2026-07-15): раньше он ютился
// в ячейке «№ полиса», теперь стоит там, где статусу и место. Формулировки — что агент
// прочитает клиенту вслух («что с моим заявлением?»), а не служебные коды 1С.
const PROCESS_STATE_LABEL: Record<ProcessStatus, string> = {
  submitted: 'Заявка принята',
  'checking-docs': 'Проверка документов',
  'in-work': 'В работе у страховой',
  'awaiting-docs': 'Ожидаем документы',
  done: 'Заявка завершена',
  rejected: 'Заявка отклонена',
};

/**
 * Маркер заявки в строке — ВТОРАЯ ось статуса, отдельная от статуса полиса.
 * `urgent` = «ваш ход» (заявка ждёт агента); иначе — пассивный трекинг «в работе».
 */
export interface RowProcessMarker {
  urgent: boolean;
  kind: ProcessKind;
  stateLabel: string;
  kindLabel: string;
  /** Дата последнего движения — «с 3 июля» (что сказать клиенту по телефону). */
  since?: string;
}

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
  private readonly dealService = inject(DealService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly attention = inject(AttentionService);

  constructor() {
    // Клик по сквозному индикатору в сайдбаре ведёт сюда с ?awaiting=1 — сразу
    // включаем чип-фильтр, чтобы таблица открылась уже как список «ждут вас»
    // (зоны-дубля над таблицей больше нет — детектор один, в сайдбаре).
    if (this.route.snapshot.queryParamMap.get('awaiting') === '1') {
      this.awaitingOnly.set(true);
    }
  }

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
    // ВИД заявки (значок) НЕ отдельной колонкой, а внутри «Статуса»: замер показал, что
    // 9-я колонка + расширенный статус переполняют таблицу на 1366px и РЕЖУТ сам статус.
    // Значок типа стоит перед текстом состояния в той же ячейке — и тип, и состояние.
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

  /** Чип «Ждут ваших действий»: показать только полисы, где заявка ждёт агента. */
  protected readonly awaitingOnly = signal(false);
  /** Счётчик для чипа — из того же поллинга, что и сквозной индикатор (без 2-го запроса). */
  protected readonly awaitingCount = this.attention.awaitingPolicyCount;

  toggleAwaitingOnly(): void {
    this.awaitingOnly.update((v) => !v);
  }

  // Активен ли поиск и есть ли период, который он перебивает — для честной плашки.
  private readonly searchValue = toSignal(this.searchControl.valueChanges, { initialValue: '' });
  protected readonly searchActive = computed(() => this.searchValue().trim().length > 0);
  protected readonly periodActive = computed(() => {
    const r = this.dateRange();
    return !!(r.from || r.to);
  });
  /** Поиск перебивает фильтр периода (см. мок) — говорим об этом прямо, не молча. */
  protected readonly searchOverridesPeriod = computed(
    () => this.searchActive() && this.periodActive() && !this.awaitingOnly(),
  );

  /**
   * Маркер заявки для строки. `null` — заявок нет либо все закрыты.
   * НЕ смешивать со статусом полиса: это разные оси (полис «Оформлен» может
   * одновременно иметь заявку, которая ждёт агента).
   */
  protected processMarker(row: ClientRow): RowProcessMarker | null {
    if (!row.processStatus || !row.processKind) return null;
    const urgent = row.processStatus === 'awaiting-docs';
    return {
      urgent,
      kind: row.processKind,
      // Расширенный статус в колонку «Статус» — что агент прочитает клиенту вслух.
      stateLabel: PROCESS_STATE_LABEL[row.processStatus],
      kindLabel: PROCESS_KIND_SHORT[row.processKind],
      since: row.processSince,
    };
  }

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
    // «Ждут ваших действий» — внимание кросс-периодное: заявка на прошлогоднем полисе обязана
    // найтись, поэтому чип СНИМАЕТ фильтр периода (иначе `this-month` её спрячет).
    const awaiting = this.awaitingOnly();
    return {
      page: 1,
      pageSize: 50,
      dateFrom: awaiting ? undefined : range.from,
      dateTo: awaiting ? undefined : range.to,
      // Только `true` уходит в query-параметры: `false` превратился бы в строку "false".
      awaitingOnly: awaiting || undefined,
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

  // ─── Сделки («Согласование») — незавершённые продажи ───
  // «Мои клиенты» — картотека СДЕЛОК, а не реестр выданных полисов (в 1С так и есть:
  // там и черновики, и «оформляется»; прототип это нечаянно потерял). Сделка появляется
  // строкой с первой секунды и НЕ переезжает: после оплаты у неё просто появляется
  // № полиса. Агент ищет ИВАНОВА, а не «заявку», — и всегда находит в одном месте.
  private readonly dealsResponse = toSignal(
    timer(0, 4000).pipe(switchMap(() => this.dealService.list())),
    { initialValue: undefined },
  );

  /** Активные сделки — сверху списка: это дела, которые ещё не доведены до полиса. */
  protected readonly dealRows = computed<DealRow[]>(() => {
    const r = this.dealsResponse();
    const all = r?.success ? (r.data ?? []) : [];
    const open = all.filter((d) => !isClosedDeal(d.status));
    // Чип «Ждут ваших действий» сужает и сделки — до тех, где мяч у агента.
    return this.awaitingOnly() ? open.filter((d) => !!d.actionRequired) : open;
  });

  openDeal(row: DealRow): void {
    void this.router.navigate(['/deals', row.id]);
  }

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
    this.awaitingOnly.set(false);
    this.searchControl.setValue('');
    this.fromControl.setValue('');
    this.toControl.setValue('');
  }
}
