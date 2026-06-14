import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  type FormArray,
  FormBuilder,
  type FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import { AddonIconComponent } from '@shared/addon-icon/addon-icon.component';
import { InsurerLogoComponent } from '@shared/insurer-logo/insurer-logo.component';

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

// Loading animation steps shown while we "fetch" quotes from carriers.
// Real backend takes ~60s for all 7 carriers; we keep visible motion for the agent.
const LOADING_STEPS = [
  'Скоринг Agent Academy…',
  'Направляем информацию в страховые компании…',
  'Ренессанс…',
  'Югория…',
  'Согласие…',
  'Зетта…',
  'СОГАЗ…',
  'Росгосстрах…',
  'Евроинс…',
  'Сегментация…',
  'Скоринг…',
  'Получаем ответы от страховых компаний…',
  'Подождите ещё несколько секунд…',
] as const;

const LOADING_TOTAL_MS = 40_000;

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
  { id: 'mini-kasko', name: 'МиниКАСКО', defaultPrice: 2190, priceOptions: [2190] },
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
  paymentMethod: string; // "Банковская карта"
}

type View = 'form' | 'loading' | 'results' | 'payment' | 'success';

@Component({
  selector: 'app-osago-page',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, InsurerLogoComponent, AddonIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './osago.page.html',
  styleUrl: './osago.page.scss',
})
export class OsagoPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly purposes = VEHICLE_PURPOSES;
  protected readonly categories = VEHICLE_CATEGORIES;
  protected readonly documentTypes = DOCUMENT_TYPES;
  protected readonly addOnPresets = ADD_ON_PRESETS;

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

  protected readonly driversMode = signal<'limited' | 'unlimited'>('limited');
  protected readonly driverCount = signal<number>(1);
  protected readonly today = new Date();

  // ─── Flow state ───
  protected readonly view = signal<View>('form');
  protected readonly loadingStep = signal<number>(0);
  protected readonly loadingProgress = signal<number>(0); // 0..100
  protected readonly loadingSteps = LOADING_STEPS;

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

  // Whether the quote being edited in the modal forces a mandatory add-on
  // (reinsurance-pool quotes) — used to hide the "Отключить сервис" option.
  protected readonly addOnModalRequired = computed<boolean>(() => {
    const id = this.addOnModalQuoteId();
    const q = id ? this.quotes().find((x) => x.id === id) : null;
    return q?.addOn.required ?? false;
  });

  // Timers for the loading animation
  private loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private loadingIntervalId: ReturnType<typeof setInterval> | null = null;
  private progressIntervalId: ReturnType<typeof setInterval> | null = null;
  private paymentTimeoutId: ReturnType<typeof setTimeout> | null = null;

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
      identifierType: ['vin' as const],
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

  protected readonly ownerSameAsPolicyholder = computed(
    () => this.form.controls.owner.controls.isSameAsPolicyholder.value,
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimers());
  }

  // ─── Form helpers ───

  protected get driversArray(): FormArray<FormGroup> {
    return this.form.controls.drivers as FormArray<FormGroup>;
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
      this.driverCount.set(1);
    }
  }

  setDriverCount(n: number): void {
    if (this.driversMode() !== 'limited') return;
    this.driverCount.set(n);
    while (this.driversArray.length < n) this.driversArray.push(this.makeDriverGroup());
    while (this.driversArray.length > n) this.driversArray.removeAt(this.driversArray.length - 1);
  }

  isActiveDriverTab(n: number): boolean {
    return this.driversMode() === 'limited' && this.driverCount() === n;
  }

  // ─── Test data pre-fill (for the prototype) ───

  fillTestData(): void {
    this.form.patchValue({
      base: {
        clientPhone: '+7 (916) 555-12-34',
        email: 'klient@example.ru',
        purpose: 'personal',
      },
      vehicle: {
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
      },
      policyholder: {
        lastName: 'Иванов',
        firstName: 'Иван',
        middleName: 'Иванович',
        birthDate: '1985-03-15',
        docType: 'passport-rf',
        docSeries: '4509',
        docNumber: '123456',
        docDate: '2005-04-20',
        address: 'г. Москва, ул. Ленина, д. 10, кв. 5',
      },
      owner: { isSameAsPolicyholder: true },
    });

    this.driversArray.at(0)?.patchValue({
      source: 'policyholder',
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Иванович',
      birthDate: '1985-03-15',
      licenseSeries: '7723',
      licenseNumber: '456789',
      licenseDate: '2010-08-15',
      startExperienceDate: '2010-08-15',
    });
  }

  // ─── Calculation flow ───

  calculate(): void {
    this.clearTimers();
    this.view.set('loading');
    this.loadingStep.set(0);
    this.loadingProgress.set(0);

    const stepMs = LOADING_TOTAL_MS / LOADING_STEPS.length;

    this.loadingIntervalId = setInterval(() => {
      this.loadingStep.update((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, stepMs);

    // Smoother progress bar (updates every 200 ms).
    const tickMs = 200;
    const start = performance.now();
    this.progressIntervalId = setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, (elapsed / LOADING_TOTAL_MS) * 100);
      this.loadingProgress.set(pct);
    }, tickMs);

    this.loadingTimeoutId = setTimeout(() => {
      this.clearTimers();
      this.loadingProgress.set(100);
      this.quotes.set(this.generateQuotes());
      this.view.set('results');
    }, LOADING_TOTAL_MS);
  }

  cancelCalculation(): void {
    this.clearTimers();
    this.view.set('form');
  }

  backToForm(): void {
    this.view.set('form');
    this.selectedQuoteId.set(null);
    this.addOnModalQuoteId.set(null);
  }

  // ─── Add-on modal ───

  openAddOnModal(quoteId: string): void {
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

  /** "5 предложений" / "2 предложения" — Russian plural for the results subtitle. */
  offersCountLabel(): string {
    const n = this.quotes().length;
    const mod10 = n % 10;
    const mod100 = n % 100;
    let word: string;
    if (mod10 === 1 && mod100 !== 11) word = 'предложение';
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'предложения';
    else word = 'предложений';
    return `${n} ${word}`;
  }

  // ─── Issue / payment flow ───

  issue(quoteId: string): void {
    this.selectedQuoteId.set(quoteId);
    this.view.set('payment');
    // Simulate payment processing — 3 sec then jump to success → detail page.
    this.paymentTimeoutId = setTimeout(() => {
      this.view.set('success');
      // After short success state, route to a detail page (using first policy id).
      setTimeout(() => {
        void this.router.navigate(['/clients']);
      }, 1500);
    }, 3000);
  }

  cancelPayment(): void {
    if (this.paymentTimeoutId) clearTimeout(this.paymentTimeoutId);
    this.paymentTimeoutId = null;
    this.view.set('results');
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

    // Pick 2-5 carriers for the quote panel.
    const sample = [...CARRIERS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 2 + Math.floor(Math.random() * 4));

    const quotes = sample.map((c, idx) => {
      const variance = Math.round((Math.random() - 0.3) * 1500);
      const osagoPrice = Math.max(3500, basePrice + variance);
      // Reinsurance-pool quotes force a mandatory МиниКАСКО; segment quotes
      // start with no add-on so the headline price equals the quoted price.
      const requiresAddOn = c.quoteType === 'pool';
      const addOnPresetId: AddOnPreset['id'] = requiresAddOn ? 'mini-kasko' : 'off';
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
          price: addOnPresetId === 'off' ? 0 : preset.defaultPrice,
          required: requiresAddOn,
        },
        paymentMethod: 'Банковская карта',
      };
    });

    // Rank by base OSAGO premium, ascending — cheapest first (the anchor).
    return quotes.sort((a, b) => a.osagoPrice - b.osagoPrice);
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
      docSeries: [''],
      docNumber: [''],
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
      licenseSeries: [''],
      licenseNumber: [''],
      isForeignLicense: [false],
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
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = null;
    }
    if (this.loadingIntervalId) {
      clearInterval(this.loadingIntervalId);
      this.loadingIntervalId = null;
    }
    if (this.progressIntervalId) {
      clearInterval(this.progressIntervalId);
      this.progressIntervalId = null;
    }
    if (this.paymentTimeoutId) {
      clearTimeout(this.paymentTimeoutId);
      this.paymentTimeoutId = null;
    }
  }
}
