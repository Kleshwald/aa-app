import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  type FormArray,
  FormBuilder,
  type FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import {
  type CreatePolicyPayload,
  ClientDetailService,
} from '@core/services/client-detail.service';
import { AddonIconComponent } from '@shared/addon-icon/addon-icon.component';
import { BackLinkComponent } from '@shared/back-link/back-link.component';
import { CalcLoaderComponent, type CalcStep } from '@shared/calc-loader/calc-loader.component';
import { FieldComponent } from '@shared/field/field.component';
import { InsurerLogoComponent } from '@shared/insurer-logo/insurer-logo.component';
import { IsoDayTransformer } from '@shared/iso-day.transformer';

import { MaskitoDirective } from '@maskito/angular';
import type { MaskitoOptions } from '@maskito/core';
import { TuiInput, TuiTextfield, tuiTextfieldOptionsProvider } from '@taiga-ui/core';
import { TuiInputDate, TuiSelect, tuiInputDateOptionsProvider } from '@taiga-ui/kit';

const VEHICLE_PURPOSES = [
  { value: 'personal', label: 'Личная' },
  { value: 'taxi', label: 'Такси' },
  { value: 'training', label: 'Учебная езда' },
  { value: 'rent', label: 'Прокат / аренда' },
  { value: 'emergency', label: 'Экстренные службы' },
] as const;

const VEHICLE_CATEGORIES = [
  { value: 'A', label: 'A — мотоциклы' },
  { value: 'B', label: 'B — легковые' },
  { value: 'C', label: 'C — грузовые' },
  { value: 'D', label: 'D — автобусы' },
  { value: 'E', label: 'E — прицепы' },
] as const;

const DOCUMENT_TYPES = [
  { value: 'passport-rf', label: 'Паспорт гражданина РФ' },
  { value: 'passport-foreign', label: 'Паспорт иностранного гражданина' },
  { value: 'birth-certificate', label: 'Свидетельство о рождении' },
  { value: 'temporary-id', label: 'Временное удостоверение' },
] as const;

const DRIVER_DOC_TYPES = [
  { value: 'license-rf', label: 'Водительское удостоверение РФ' },
  { value: 'license-foreign', label: 'Водительское удостоверение иностранного государства' },
  { value: 'tractor', label: 'Удостоверение тракториста-машиниста (тракториста)' },
  { value: 'temporary', label: 'Временное удостоверение на право управления самоходными машинами' },
] as const;

// Маска «серия + номер» (4 + 6 цифр) — для паспорта и В/У: «1234 567890».
const SERIES_NUMBER_MASK: MaskitoOptions = {
  mask: [/\d/, /\d/, /\d/, /\d/, ' ', /\d/, /\d/, /\d/, /\d/, /\d/, /\d/],
};

// Справочник марок/моделей (мок). Если марки нет в списке — агент ставит
// «Произвольная марка/модель» и вводит вручную.
const CAR_CATALOG: Record<string, readonly string[]> = {
  Lada: ['Granta', 'Vesta', 'Largus', 'Niva', 'XRAY'],
  Toyota: ['Camry', 'Corolla', 'RAV4', 'Land Cruiser', 'Highlander'],
  Kia: ['Rio', 'Sportage', 'Cerato', 'Sorento', 'K5'],
  Hyundai: ['Solaris', 'Creta', 'Tucson', 'Santa Fe', 'Elantra'],
  Volkswagen: ['Polo', 'Tiguan', 'Passat', 'Touareg'],
  Renault: ['Logan', 'Duster', 'Sandero', 'Kaptur'],
  Nissan: ['Almera', 'Qashqai', 'X-Trail', 'Terrano'],
  Skoda: ['Octavia', 'Rapid', 'Kodiaq', 'Karoq'],
  BMW: ['3 серии', '5 серии', 'X3', 'X5'],
  'Mercedes-Benz': ['C-класс', 'E-класс', 'GLC', 'GLE'],
  Ford: ['Focus', 'Mondeo', 'Kuga', 'Explorer'],
  Chevrolet: ['Niva', 'Cruze', 'Aveo', 'Captiva'],
};
const CAR_BRANDS: readonly string[] = Object.keys(CAR_CATALOG);

// Пулы для «Ассистент, заполни!» — случайное правдоподобное заполнение (прототип).
const RANDOM_PEOPLE: readonly {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
}[] = [
  { lastName: 'Иванова', firstName: 'Мария', middleName: 'Сергеевна', birthDate: '1978-04-12' },
  { lastName: 'Петров', firstName: 'Алексей', middleName: 'Иванович', birthDate: '1985-09-30' },
  { lastName: 'Смирнова', firstName: 'Ольга', middleName: 'Викторовна', birthDate: '1969-02-17' },
  { lastName: 'Кузнецов', firstName: 'Дмитрий', middleName: 'Андреевич', birthDate: '1991-11-05' },
  { lastName: 'Новикова', firstName: 'Елена', middleName: 'Павловна', birthDate: '1974-07-23' },
  { lastName: 'Морозов', firstName: 'Сергей', middleName: 'Николаевич', birthDate: '1982-12-08' },
];
const RANDOM_ADDRESSES: readonly string[] = [
  'г. Минусинск, ул. Ленина, д. 14, кв. 7',
  'г. Абакан, ул. Щетинкина, д. 32, кв. 15',
  'г. Красноярск, пр. Мира, д. 90, кв. 41',
  'г. Кызыл, ул. Кочетова, д. 5, кв. 23',
];

// Экран ожидания — сменяющаяся строка статуса (формулировки из первой версии).
// У шагов с компанией показываем логотип (фиксированный список, не «кто ответил»).
const CALC_STEPS: readonly CalcStep[] = [
  { text: 'Направляем информацию в страховые компании' },
  { text: 'Ренессанс', carrierId: 'renessans' },
  { text: 'Югория', carrierId: 'ugoria' },
  { text: 'Согласие', carrierId: 'soglasie' },
  { text: 'Зетта', carrierId: 'zetta' },
  { text: 'СОГАЗ', carrierId: 'sogaz' },
  { text: 'Росгосстрах', carrierId: 'rosgosstrah' },
  { text: 'Евроинс', carrierId: 'euroins' },
  { text: 'Проверка НСИС' },
];

const CALC_TOTAL_MS = 40_000; // переход на результаты
const CALC_COMPLETE_AT_MS = CALC_TOTAL_MS - 300; // лоадер плавно гаснет перед переходом

// Quote type: a regular "segment" quote, or a "reinsurance pool" quote that
// typically forces a mandatory МиниКАСКО add-on.
type QuoteType = 'segment' | 'pool';

// Carriers participating in the quote — drawn from insurance-companies fixture.
const CARRIERS: readonly {
  id: string;
  name: string;
  shortName: string;
  quoteType: QuoteType;
}[] = [
  { id: 'zetta', name: 'Зетта страхование', shortName: 'Зетта', quoteType: 'segment' },
  { id: 'soglasie', name: 'Согласие', shortName: 'Согласие', quoteType: 'pool' },
  { id: 'renessans', name: 'Ренессанс страхование', shortName: 'Ренессанс', quoteType: 'segment' },
  { id: 'ugoria', name: 'Югория', shortName: 'Югория', quoteType: 'segment' },
  { id: 'sogaz', name: 'СОГАЗ', shortName: 'СОГАЗ', quoteType: 'segment' },
  { id: 'rosgosstrah', name: 'Росгосстрах', shortName: 'РГС', quoteType: 'segment' },
  { id: 'euroins', name: 'Евроинс', shortName: 'Евроинс', quoteType: 'pool' },
];

// Add-on services offered on the quote-result row (modal opens to pick details).
export interface AddOnPreset {
  id: 'mini-kasko' | 'legal' | 'ns-dtp' | 'off';
  name: string;
  description?: string;
  defaultPrice: number;
  priceOptions: number[];
  required?: boolean; // some carriers force MiniKASKO
}

const ADD_ON_PRESETS: AddOnPreset[] = [
  { id: 'mini-kasko', name: 'МиниКАСКО', defaultPrice: 2450, priceOptions: [2450] },
  {
    id: 'legal',
    name: 'Юрист поможет',
    defaultPrice: 1000,
    priceOptions: [500, 800, 1000, 1300, 1500, 1990, 2200, 2500, 2990],
  },
  {
    id: 'ns-dtp',
    name: 'НС при ДТП',
    description: 'Защита водителя и пассажиров от НС на сумму 100 000 ₽',
    defaultPrice: 1000,
    priceOptions: [800, 1000, 1200, 1500, 1800, 2000],
  },
  { id: 'off', name: 'Отключить сервис', defaultPrice: 0, priceOptions: [0] },
];

export interface Quote {
  id: string;
  carrierId: string;
  carrierName: string;
  carrierShortName: string;
  quoteType: QuoteType;
  osagoPrice: number;
  effectiveDate: string; // "9 июня"
  addOn: { presetId: AddOnPreset['id']; price: number; required: boolean };
}

type View = 'form' | 'loading' | 'results' | 'payment';

// One coefficient line in the "how the ОСАГО price is built" popover.
interface CoefRow {
  code: string;
  label: string;
  value: number;
}

@Component({
  selector: 'app-osago-page',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    DecimalPipe,
    InsurerLogoComponent,
    AddonIconComponent,
    BackLinkComponent,
    CalcLoaderComponent,
    FieldComponent,
    TuiTextfield,
    TuiInput,
    TuiInputDate,
    TuiSelect,
    MaskitoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './osago.page.html',
  styleUrl: './osago.page.scss',
  host: { '(document:keydown.escape)': 'onEscape()' },
  providers: [
    tuiInputDateOptionsProvider({ valueTransformer: new IsoDayTransformer() }),
    // Убираем «крестик» очистки (tuiButtonX) из полей — он отвлекал агентов.
    tuiTextfieldOptionsProvider({ cleaner: signal(false) }),
  ],
})
export class OsagoPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly policyService = inject(ClientDetailService);

  protected readonly purposes = VEHICLE_PURPOSES;
  protected readonly categories = VEHICLE_CATEGORIES;
  protected readonly documentTypes = DOCUMENT_TYPES;
  protected readonly addOnPresets = ADD_ON_PRESETS;

  // Для Taiga select: списки кодов + «stringify» (код → подпись). Значение
  // контрола остаётся кодом, в поле показывается человеческая подпись.
  protected readonly purposeItems = VEHICLE_PURPOSES.map((p) => p.value);
  protected readonly categoryItems = VEHICLE_CATEGORIES.map((c) => c.value);
  protected readonly docTypeItems = DOCUMENT_TYPES.map((d) => d.value);
  protected readonly stringifyPurpose = (v: string): string =>
    VEHICLE_PURPOSES.find((p) => p.value === v)?.label ?? v;
  protected readonly stringifyCategory = (v: string): string =>
    VEHICLE_CATEGORIES.find((c) => c.value === v)?.label ?? v;
  protected readonly stringifyDocType = (v: string): string =>
    DOCUMENT_TYPES.find((d) => d.value === v)?.label ?? v;

  protected readonly insurerType = signal<'individual' | 'ip' | 'legal'>('individual');

  protected readonly identifierTypes = [
    { value: 'vin', label: 'VIN' },
    { value: 'body', label: '№ кузова' },
    { value: 'chassis', label: '№ шасси' },
  ] as const;

  protected readonly documentSubTypes = [
    { value: 'sts', label: 'СТС' },
    { value: 'pts', label: 'ПТС' },
    { value: 'epts', label: 'ЭПТС' },
  ] as const;

  // ─── Поиск ТС / справочник марок ───
  protected readonly vehicleSearchBy = signal<'plate' | 'vin' | 'body'>('plate');
  protected readonly searchPlaceholder = computed(() => {
    switch (this.vehicleSearchBy()) {
      case 'vin':
        return 'Укажите VIN';
      case 'body':
        return 'Укажите номер кузова';
      default:
        return 'Укажите гос. номер ТС';
    }
  });

  protected readonly brandItems = CAR_BRANDS;
  protected readonly stringifySelf = (v: string): string => v;
  protected readonly seriesNumberMask = SERIES_NUMBER_MASK;

  // Тип документа водителя (В/У РФ / иностранное / тракторист / временное).
  protected readonly driverDocTypeItems = DRIVER_DOC_TYPES.map((d) => d.value);
  protected readonly stringifyDriverDocType = (v: string): string =>
    DRIVER_DOC_TYPES.find((d) => d.value === v)?.label ?? v;
  /** Модели выбранной марки (справочник); пусто, пока марка не выбрана. */
  modelItems(): readonly string[] {
    return CAR_CATALOG[this.form.controls.vehicle.controls.make.value] ?? [];
  }

  /** Мок поиска ТС: подставляем данные (как будто нашли по номеру/VIN/кузову). */
  findVehicle(): void {
    this.form.controls.vehicle.patchValue({
      licensePlate: 'А123БС777',
      category: 'B',
      make: 'Toyota',
      model: 'Camry',
      year: 2018,
      power: 181,
      identifierType: 'vin',
      identifierValue: 'JTNB11HJ8K0123456',
      documentSubType: 'sts',
      documentSeries: '99 ОВ 123456',
      documentDate: '2018-05-10',
    });
  }

  protected readonly driversMode = signal<'limited' | 'unlimited'>('limited');
  protected readonly maxDrivers = 5;
  protected readonly today = new Date();

  // ─── Flow state ───
  protected readonly view = signal<View>('form');

  // Показ ошибок включается после первой попытки расчёта (или по touched поля).
  protected readonly submitted = signal(false);

  // Экран ожидания — крупная сменяющаяся строка статуса (вариант «минимал»).
  protected readonly steps = CALC_STEPS;
  protected readonly stepIndex = signal<number>(0);
  protected readonly calcComplete = signal<boolean>(false);

  // «Магия» автозаполнения: волна подсветки секций после «Ассистент, заполни!».
  protected readonly fillPulse = signal(false);

  protected readonly quotes = signal<Quote[]>([]);
  protected readonly selectedQuoteId = signal<string | null>(null);
  protected readonly selectedQuote = computed<Quote | null>(() => {
    const id = this.selectedQuoteId();
    return id ? (this.quotes().find((q) => q.id === id) ?? null) : null;
  });

  // Modal for add-on editing
  protected readonly addOnModalQuoteId = signal<string | null>(null);
  protected readonly addOnModalPreset = signal<AddOnPreset['id']>('off');
  protected readonly addOnModalPrice = signal<number>(0);

  // Which quote's "how the price is built" popover is open (null = none).
  protected readonly priceInfoQuoteId = signal<string | null>(null);

  // ОСАГО coefficients — same for all carriers (depend on driver/vehicle, not
  // the company); the per-carrier base tariff is what makes prices differ.
  protected readonly osagoCoefs = computed<CoefRow[]>(() => {
    const power = this.form.controls.vehicle.controls.power.value ?? 100;
    const km = power >= 150 ? 1.4 : power >= 120 ? 1.2 : power >= 100 ? 1.1 : 1.0;
    const hasTrailer = this.form.controls.vehicle.controls.hasTrailer.value;
    const rows: CoefRow[] = [
      { code: 'КТ', label: 'Территория', value: 1.64 },
      { code: 'КБМ', label: 'Бонус-малус', value: 0.78 },
      { code: 'КВС', label: 'Возраст и стаж', value: 1.04 },
      { code: 'КМ', label: 'Мощность двигателя', value: km },
      {
        code: 'КО',
        label: 'Ограничение по водителям',
        value: this.driversMode() === 'unlimited' ? 1.94 : 1.0,
      },
    ];
    if (hasTrailer) rows.push({ code: 'КПр', label: 'Прицеп', value: 1.0 });
    return rows;
  });

  // Whether the quote being edited in the modal forces a mandatory add-on
  // (reinsurance-pool quotes) — used to hide the "Отключить сервис" option.
  protected readonly addOnModalRequired = computed<boolean>(() => {
    const id = this.addOnModalQuoteId();
    const q = id ? this.quotes().find((x) => x.id === id) : null;
    return q?.addOn.required ?? false;
  });

  // Timers for the loading animation
  private calcTimers: ReturnType<typeof setTimeout>[] = [];
  private stepTimer: ReturnType<typeof setInterval> | null = null;
  private paymentTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private fillPulseTimer: ReturnType<typeof setTimeout> | null = null;

  readonly form = this.fb.nonNullable.group({
    base: this.fb.nonNullable.group({
      startDate: [this.toDateInput(this.today), Validators.required],
      endDate: [this.toDateInput(this.plusYear(this.today))],
      purpose: ['personal' as const, Validators.required],
      clientPhone: ['', Validators.required],
      email: [''],
    }),

    vehicle: this.fb.nonNullable.group({
      hasTrailer: [false],
      customMakeModel: [false],
      licensePlate: [''],
      noLicensePlate: [false],
      category: ['B' as const],
      make: [''],
      model: [''],
      year: [null as number | null],
      power: [null as number | null],
      identifierType: ['vin' as 'vin' | 'body' | 'chassis'],
      identifierValue: [''],
      documentSubType: ['sts' as const],
      documentSeries: [''],
      documentDate: [''],
    }),

    policyholder: this.makePersonGroup(),
    owner: this.fb.nonNullable.group({
      isSameAsPolicyholder: [true],
      person: this.makePersonGroup(),
    }),

    drivers: this.fb.nonNullable.array([this.makeDriverGroup()]),
  });

  // Реактивно следим за тумблером (value формы — не сигнал, поэтому через toSignal,
  // иначе computed «застывает» на начальном значении и поля не раскрываются).
  protected readonly ownerSameAsPolicyholder = toSignal(
    this.form.controls.owner.controls.isSameAsPolicyholder.valueChanges,
    { initialValue: this.form.controls.owner.controls.isSameAsPolicyholder.value },
  );

  // Payment method is derived from the payer type chosen on the form:
  // individuals/ИП pay by card, legal entities pay by invoice.
  protected readonly paymentKind = computed<'card' | 'invoice'>(() =>
    this.insurerType() === 'legal' ? 'invoice' : 'card',
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimers());

    // Смена шага (форма → расчёт → котировки) прокручивает контент наверх,
    // иначе новый экран открывается «в середине» (скролл от предыдущего).
    effect(() => {
      this.view();
      setTimeout(() => document.querySelector('.app-content')?.scrollTo({ top: 0 }), 0);
    });

    // Смена марки сбрасывает модель (если она не из справочника новой марки).
    // В режиме «Произвольная марка/модель» не трогаем — там свободный ввод.
    this.form.controls.vehicle.controls.make.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((make) => {
        if (this.form.controls.vehicle.controls.customMakeModel.value) return;
        const modelCtrl = this.form.controls.vehicle.controls.model;
        if (modelCtrl.value && !(CAR_CATALOG[make] ?? []).includes(modelCtrl.value)) {
          modelCtrl.setValue('');
        }
      });

    // Собственник = страхователь: поля собственника сворачиваем (скрываем).
    // Группу отключаем, чтобы её required-поля не держали форму невалидной.
    const ownerSame = this.form.controls.owner.controls.isSameAsPolicyholder;
    const ownerPerson = this.form.controls.owner.controls.person;
    const syncOwner = (same: boolean): void =>
      same ? ownerPerson.disable({ emitEvent: false }) : ownerPerson.enable({ emitEvent: false });
    syncOwner(ownerSame.value);
    ownerSame.valueChanges.pipe(takeUntilDestroyed()).subscribe(syncOwner);
  }

  /** Плейсхолдер поля идентификатора по выбранному типу (VIN / кузов / шасси). */
  identPlaceholder(): string {
    switch (this.form.controls.vehicle.controls.identifierType.value) {
      case 'body':
        return 'Номер кузова';
      case 'chassis':
        return 'Номер шасси';
      default:
        return '17 символов';
    }
  }

  // ─── Form helpers ───

  protected get driversArray(): FormArray<FormGroup> {
    return this.form.controls.drivers as FormArray<FormGroup>;
  }

  // ─── Индикатор заполнения секции (галочка vs пустой кружок) ───
  // Геттеры пересчитываются на CD (ввод в поля внутри компонента её запускает).
  get baseFilled(): boolean {
    const b = this.form.controls.base.getRawValue();
    return !!(b.startDate && b.clientPhone);
  }
  get vehicleFilled(): boolean {
    const v = this.form.controls.vehicle.getRawValue();
    return !!(v.licensePlate && v.make && v.model);
  }
  get policyholderFilled(): boolean {
    const p = this.form.controls.policyholder.getRawValue();
    return !!(p.lastName && p.firstName);
  }
  get ownerFilled(): boolean {
    // «Совпадает» считается заполненным только если заполнен сам страхователь.
    if (this.ownerSameAsPolicyholder()) return this.policyholderFilled;
    const o = this.form.controls.owner.controls.person.getRawValue();
    return !!(o.lastName && o.firstName);
  }
  get driversFilled(): boolean {
    if (this.driversMode() === 'unlimited') return true;
    const d = this.driversArray.at(0)?.getRawValue() as Record<string, unknown> | undefined;
    return !!d?.['licenseSeriesNumber'];
  }

  /** Текст ошибки для обязательного поля — показываем после touch или попытки расчёта. */
  err(control: AbstractControl, message: string): string {
    return control.invalid && (control.touched || this.submitted()) ? message : '';
  }

  setInsurerType(type: 'individual' | 'ip' | 'legal'): void {
    this.insurerType.set(type);
  }

  setDriversMode(mode: 'limited' | 'unlimited'): void {
    this.driversMode.set(mode);
    if (mode === 'unlimited') {
      while (this.driversArray.length > 0) this.driversArray.removeAt(0);
    } else if (this.driversArray.length === 0) {
      this.driversArray.push(this.makeDriverGroup());
    }
  }

  get canAddDriver(): boolean {
    return this.driversArray.length < this.maxDrivers;
  }

  addDriver(): void {
    if (this.canAddDriver) this.driversArray.push(this.makeDriverGroup());
  }

  removeDriver(index: number): void {
    if (this.driversArray.length > 1) this.driversArray.removeAt(index);
  }

  /** Текущий источник данных водителя (страхователь/собственник/иное лицо). */
  isDriverSource(index: number, source: string): boolean {
    return this.driversArray.at(index)?.get('source')?.value === source;
  }

  /**
   * Показывать ли пилюлю источника для водителя №index. «Иное лицо» — всегда.
   * Текущий источник — всегда (как активный). Страхователь — всегда, если не занят
   * другим водителем. Собственник — так же, но скрыт, если совпадает со страхователем.
   */
  canPickSource(index: number, source: 'policyholder' | 'owner' | 'other'): boolean {
    if (source === 'other') return true;
    if (this.isDriverSource(index, source)) return true;
    if (source === 'owner' && this.ownerSameAsPolicyholder()) return false;
    return !this.driversArray.controls.some(
      (c, i) => i !== index && c.get('source')?.value === source,
    );
  }

  /** Водитель — иное лицо: снимаем привязку к источнику (поля остаются для правки). */
  setDriverOther(driver: FormGroup): void {
    driver.patchValue({ source: 'other' }, { emitEvent: false });
  }

  /** Предзаполнить водителя данными страхователя/собственника (ФИО + дата). */
  fillDriverFrom(driver: FormGroup, source: 'policyholder' | 'owner'): void {
    const src =
      source === 'owner'
        ? this.form.controls.owner.controls.person.getRawValue()
        : this.form.controls.policyholder.getRawValue();
    driver.patchValue({
      source,
      lastName: src.lastName,
      firstName: src.firstName,
      middleName: src.middleName,
      noMiddleName: src.noMiddleName,
      birthDate: src.birthDate,
    });
  }

  // ─── Ассистент: случайное заполнение (прототип) ───

  fillRandom(): void {
    const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const L = 'АВЕКМНОРСТУХ';
    const ru = (): string => L[Math.floor(Math.random() * L.length)];
    const num = (min: number, max: number): number =>
      min + Math.floor(Math.random() * (max - min + 1));

    const plate = `${ru()}${num(100, 999)}${ru()}${ru()}${num(1, 99)}`;
    const brand = pick(CAR_BRANDS);
    const model = pick(CAR_CATALOG[brand] ?? ['—']);
    const person = pick(RANDOM_PEOPLE);
    const phone = `+7 (9${pick(['16', '03', '25', '62', '99'])}) ${num(100, 999)}-${num(10, 99)}-${num(10, 99)}`;

    // Сначала режим справочника, чтобы марка/модель встали из каталога.
    this.form.controls.vehicle.controls.customMakeModel.setValue(false);
    this.form.patchValue({
      base: { clientPhone: phone, email: '', purpose: 'personal' },
      vehicle: {
        licensePlate: plate,
        category: 'B',
        make: brand,
        model,
        year: num(2008, 2023),
        power: num(70, 300),
        identifierType: 'vin',
        identifierValue: this.randomVin(),
        documentSubType: 'sts',
        documentSeries: `${num(10, 99)} ${ru()}${ru()} ${num(100000, 999999)}`,
        documentDate: '2019-06-14',
      },
      policyholder: {
        lastName: person.lastName,
        firstName: person.firstName,
        middleName: person.middleName,
        birthDate: person.birthDate,
        docType: 'passport-rf',
        docSeriesNumber: `${num(1000, 9999)} ${num(100000, 999999)}`,
        docDate: '2008-05-20',
        address: pick(RANDOM_ADDRESSES),
      },
      owner: { isSameAsPolicyholder: true },
    });

    this.setDriversMode('limited');
    const driver0 = this.driversArray.at(0) as FormGroup | null;
    if (driver0) {
      driver0.patchValue({
        licenseDocType: 'license-rf',
        licenseSeriesNumber: `${num(1000, 9999)} ${num(100000, 999999)}`,
        licenseDate: '2012-08-15',
        startExperienceDate: '2012-08-15',
      });
      // Первый водитель — страхователь (ФИО подставляются из него).
      this.fillDriverFrom(driver0, 'policyholder');
    }

    this.runFillMagic();
  }

  /** Волна подсветки секций сверху вниз — «магия» заполнения (дофамин, тонко). */
  private runFillMagic(): void {
    // reduced-motion → данные уже подставлены, без анимации.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (this.fillPulseTimer) clearTimeout(this.fillPulseTimer);
    this.fillPulse.set(false);
    // rAF: снять класс, затем поставить заново — перезапуск волны при повторном клике.
    requestAnimationFrame(() => {
      this.fillPulse.set(true);
      // 5 секций × 120мс стаггер + 600мс анимация ≈ 1.3 c.
      this.fillPulseTimer = setTimeout(() => this.fillPulse.set(false), 1300);
    });
  }

  private randomVin(): string {
    const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    let vin = '';
    for (let i = 0; i < 17; i++) vin += chars[Math.floor(Math.random() * chars.length)];
    return vin;
  }

  // ─── Calculation flow ───

  calculate(): void {
    // Обязательные поля должны быть заполнены — иначе показываем ошибки и не идём дальше.
    if (this.form.invalid) {
      this.submitted.set(true);
      this.form.markAllAsTouched();
      return;
    }
    this.clearTimers();
    // Котировки считаются сразу, но НЕ показываются до экрана результатов
    // (алгоритм вывода СК скрыт).
    this.quotes.set(this.generateQuotes());
    this.stepIndex.set(0);
    this.calcComplete.set(false);
    this.view.set('loading');

    // Крупная строка статуса сменяется по очереди.
    const stepMs = CALC_TOTAL_MS / CALC_STEPS.length;
    this.stepTimer = setInterval(() => {
      this.stepIndex.update((i) => Math.min(i + 1, CALC_STEPS.length - 1));
    }, stepMs);

    // Короткий момент завершения → переход на результаты.
    this.calcTimers.push(setTimeout(() => this.calcComplete.set(true), CALC_COMPLETE_AT_MS));
    this.calcTimers.push(setTimeout(() => this.view.set('results'), CALC_TOTAL_MS));
  }

  cancelCalculation(): void {
    this.clearTimers();
    this.stepIndex.set(0);
    this.calcComplete.set(false);
    this.view.set('form');
  }

  backToForm(): void {
    this.view.set('form');
    this.selectedQuoteId.set(null);
    this.addOnModalQuoteId.set(null);
  }

  // ─── Price-breakdown popover ───

  togglePriceInfo(quoteId: string): void {
    this.priceInfoQuoteId.update((id) => (id === quoteId ? null : quoteId));
  }

  closePriceInfo(): void {
    this.priceInfoQuoteId.set(null);
  }

  /** Per-carrier base tariff (ТБ) implied by the row price and the shared coefficients. */
  baseTariff(quote: Quote): number {
    const product = this.osagoCoefs().reduce((acc, r) => acc * r.value, 1);
    return Math.round(quote.osagoPrice / product);
  }

  onEscape(): void {
    this.closePriceInfo();
    this.closeAddOnModal();
  }

  // ─── Add-on modal ───

  openAddOnModal(quoteId: string): void {
    this.closePriceInfo();
    const q = this.quotes().find((x) => x.id === quoteId);
    if (!q) return;
    this.addOnModalQuoteId.set(quoteId);
    this.addOnModalPreset.set(q.addOn.presetId);
    this.addOnModalPrice.set(q.addOn.price);
  }

  closeAddOnModal(): void {
    this.addOnModalQuoteId.set(null);
  }

  isAddOnSelected(id: AddOnPreset['id']): boolean {
    return this.addOnModalPreset() === id;
  }

  selectAddOnPreset(id: AddOnPreset['id']): void {
    this.addOnModalPreset.set(id);
    const preset = ADD_ON_PRESETS.find((p) => p.id === id);
    if (preset) this.addOnModalPrice.set(preset.defaultPrice);
  }

  selectAddOnPrice(price: number): void {
    this.addOnModalPrice.set(price);
  }

  applyAddOnChoice(): void {
    const quoteId = this.addOnModalQuoteId();
    if (!quoteId) return;
    const presetId = this.addOnModalPreset();
    const preset = ADD_ON_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const price = presetId === 'off' ? 0 : this.addOnModalPrice();

    this.quotes.update((list) =>
      list.map((q) =>
        q.id === quoteId
          ? {
              ...q,
              addOn: { presetId, price, required: q.addOn.required && presetId !== 'off' },
            }
          : q,
      ),
    );
    this.closeAddOnModal();
  }

  totalFor(quote: Quote): number {
    return quote.osagoPrice + (quote.addOn?.price ?? 0);
  }

  /** Display name of an add-on preset (used in chip, total caption, payment screen). */
  addOnName(id: AddOnPreset['id']): string {
    return ADD_ON_PRESETS.find((p) => p.id === id)?.name ?? '';
  }

  // ─── Issue / payment flow ───

  issue(quoteId: string): void {
    this.selectedQuoteId.set(quoteId);
    this.view.set('payment');
    // Имитация эквайринга — 3 сек, затем оформляем договор и открываем его страницу.
    this.paymentTimeoutId = setTimeout(() => this.finalizeIssue(), 3000);
  }

  cancelPayment(): void {
    if (this.paymentTimeoutId) clearTimeout(this.paymentTimeoutId);
    this.paymentTimeoutId = null;
    this.view.set('results');
  }

  private finalizeIssue(): void {
    const q = this.selectedQuote();
    if (!q) return;
    const b = this.form.controls.base.getRawValue();
    const v = this.form.controls.vehicle.getRawValue();
    const ph = this.form.controls.policyholder.getRawValue();
    const payload: CreatePolicyPayload = {
      type: 'OSAGO',
      productName: 'ОСАГО',
      premium: this.totalFor(q),
      startDate: b.startDate,
      endDate: b.endDate,
      clientName: [ph.lastName, ph.firstName, ph.middleName].filter(Boolean).join(' '),
      clientPhone: b.clientPhone,
      insuranceCompanyId: q.carrierId,
      insuranceCompanyName: q.carrierName,
      vehicleBrand: v.make,
      vehicleModel: v.model,
      vehicleYear: v.year ?? undefined,
      vehicleVin: v.identifierType === 'vin' ? v.identifierValue : '',
      vehicleLicensePlate: v.licensePlate,
    };
    this.policyService.create(payload).subscribe((res) => {
      const id = res.success && res.data ? res.data.id : null;
      void this.router.navigate(id ? ['/clients', id] : ['/clients'], {
        queryParams: id ? { issued: '1' } : undefined,
      });
    });
  }

  saveDraft(): void {
    alert('Черновик сохранён (заглушка)');
  }

  // ─── Internals ───

  private generateQuotes(): Quote[] {
    const startDate = this.form.controls.base.controls.startDate.value;
    const effective = this.formatRussianDate(startDate);
    const power = this.form.controls.vehicle.controls.power.value ?? 100;
    const basePrice = Math.round(2500 + power * 30);

    // Алгоритм вывода СК «под капотом»: на результатах показываем подобранную
    // выборку (4–6 компаний), а не весь опрошенный рынок.
    const sample = [...CARRIERS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 4 + Math.floor(Math.random() * 3));

    const quotes = sample.map((c, idx) => {
      const variance = Math.round((Math.random() - 0.3) * 1500);
      const osagoPrice = Math.max(3500, basePrice + variance);
      // Every quote ships with a pre-selected add-on. Reinsurance-pool quotes
      // force a mandatory МиниКАСКО; segment quotes get an optional service the
      // agent can remove (then the chip becomes "Добавить сервис").
      const requiresAddOn = c.quoteType === 'pool';
      const addOnPresetId: AddOnPreset['id'] = requiresAddOn
        ? 'mini-kasko'
        : idx % 2 === 0
          ? 'ns-dtp'
          : 'legal';
      const preset = ADD_ON_PRESETS.find((p) => p.id === addOnPresetId)!;

      return {
        id: `${c.id}-${idx}`,
        carrierId: c.id,
        carrierName: c.name,
        carrierShortName: c.shortName,
        quoteType: c.quoteType,
        osagoPrice,
        effectiveDate: effective,
        addOn: {
          presetId: addOnPresetId,
          price: preset.defaultPrice,
          required: requiresAddOn,
        },
      };
    });

    // Segment quotes always on top, reinsurance-pool always below; within each
    // group rank by ОСАГО price ascending (cheapest first = the anchor).
    return quotes.sort((a, b) => {
      if (a.quoteType !== b.quoteType) return a.quoteType === 'segment' ? -1 : 1;
      return a.osagoPrice - b.osagoPrice;
    });
  }

  private formatRussianDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const months = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря',
    ];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }

  private makePersonGroup() {
    return this.fb.nonNullable.group({
      lastName: ['', Validators.required],
      firstName: ['', Validators.required],
      middleName: [''],
      noMiddleName: [false],
      birthDate: [''],
      docType: ['passport-rf' as const],
      docSeriesNumber: [''],
      docDate: [''],
      address: [''],
    });
  }

  private makeDriverGroup(): FormGroup {
    return this.fb.nonNullable.group({
      source: ['other' as 'policyholder' | 'owner' | 'other'],
      lastName: [''],
      firstName: [''],
      middleName: [''],
      noMiddleName: [false],
      birthDate: [''],
      licenseDocType: ['license-rf' as 'license-rf' | 'license-foreign' | 'tractor' | 'temporary'],
      licenseSeriesNumber: [''],
      licenseDate: [''],
      startExperienceDate: [''],
      hasPreviousLicense: [false],
    });
  }

  private toDateInput(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private plusYear(d: Date): Date {
    const next = new Date(d);
    next.setFullYear(next.getFullYear() + 1);
    next.setDate(next.getDate() - 1);
    return next;
  }

  private clearTimers(): void {
    this.calcTimers.forEach((t) => clearTimeout(t));
    this.calcTimers = [];
    if (this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.paymentTimeoutId) {
      clearTimeout(this.paymentTimeoutId);
      this.paymentTimeoutId = null;
    }
    if (this.fillPulseTimer) {
      clearTimeout(this.fillPulseTimer);
      this.fillPulseTimer = null;
    }
  }
}
