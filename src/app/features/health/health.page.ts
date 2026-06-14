import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type FormArray, FormBuilder, type FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { startWith } from 'rxjs';

import { CalcLoaderComponent, type CalcStep } from '@shared/calc-loader/calc-loader.component';
import { InsurerLogoComponent } from '@shared/insurer-logo/insurer-logo.component';

type HealthProduct = 'accident' | 'sport' | 'tick';
type InsureType = 'individual' | 'group';
type Category = 'child' | 'adult';
type View = 'params' | 'loading' | 'quotes' | 'issue' | 'payment' | 'success';

interface Offer {
  id: string;
  carrierId: string;
  carrierName: string;
  carrierShort: string;
  basePrice: number; // полная цена (без скидки)
  rate: number; // тариф СК как доля страховой суммы (напр. 0.0078)
  discountable: boolean; // можно ли дать клиенту скидку (у части СК — фиксированная цена)
}

const PRODUCTS: { id: HealthProduct; label: string }[] = [
  { id: 'accident', label: 'Страхование от несчастного случая' },
  { id: 'sport', label: 'Страхование спортсменов' },
  { id: 'tick', label: 'Страхование от укуса клеща' },
];

const CARRIERS: Record<string, { name: string; short: string }> = {
  renessans: { name: 'Ренессанс страхование', short: 'Ренессанс' },
  soglasie: { name: 'Согласие', short: 'Согласие' },
  ugoria: { name: 'Югория', short: 'Югория' },
};

// Which carriers quote which product, their mock rate (share of the insured sum / year),
// and whether the agent may give the client a discount (часть СК продаёт по фикс-цене).
const PRODUCT_CARRIERS: Record<
  HealthProduct,
  { carrierId: string; rate: number; discountable: boolean }[]
> = {
  accident: [
    { carrierId: 'renessans', rate: 0.0078, discountable: true },
    { carrierId: 'soglasie', rate: 0.0085, discountable: true },
  ],
  sport: [
    { carrierId: 'renessans', rate: 0.011, discountable: true },
    { carrierId: 'soglasie', rate: 0.0125, discountable: true },
    { carrierId: 'ugoria', rate: 0.013, discountable: true },
  ],
  tick: [
    // По укусу клеща скидку даёт только Югория; у Ренессанса — один вариант цены.
    { carrierId: 'renessans', rate: 0.004, discountable: false },
    { carrierId: 'ugoria', rate: 0.0045, discountable: true },
  ],
};

const TERMS: { value: string; label: string; months: number }[] = [
  { value: 'year', label: 'Год', months: 12 },
  { value: '6m', label: '6 месяцев', months: 6 },
  { value: '3m', label: '3 месяца', months: 3 },
];

const SUMS = [50000, 100000, 150000, 300000, 500000, 1000000];

// Управление ценой: либо полная цена, либо цена со скидкой 15% для клиента.
const DISCOUNT_PCT = 15;
const DISCOUNT_TIERS = [0, DISCOUNT_PCT] as const;

// Тайминги лоадера «Здоровья»: фиксированная длительность фразы (читаемо),
// затем короткая выдержка на «Готово» перед переходом к предложениям.
const HL_STEP_MS = 1400;
const HL_DONE_HOLD_MS = 700;

@Component({
  selector: 'app-health-page',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    DecimalPipe,
    NgTemplateOutlet,
    InsurerLogoComponent,
    CalcLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './health.page.html',
  styleUrl: './health.page.scss',
  host: { '(document:keydown.escape)': 'closePriceInfo()' },
})
export class HealthPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly products = PRODUCTS;
  protected readonly terms = TERMS;
  protected readonly sums = SUMS;
  protected readonly today = new Date();

  protected readonly product = signal<HealthProduct>('accident');
  protected readonly insureType = signal<InsureType>('individual');
  protected readonly category = signal<Category>('child');
  protected readonly view = signal<View>('params');

  protected readonly offers = signal<Offer[]>([]);
  protected readonly selectedOfferId = signal<string | null>(null);

  // Управление ценой: скидка клиенту по каждому офферу (offerId → %).
  protected readonly discountTiers = DISCOUNT_TIERS;
  protected readonly discounts = signal<Record<string, number>>({});

  // Which offer's "how the price is built" popover is open (null = none).
  protected readonly priceInfoOfferId = signal<string | null>(null);

  // Экран расчёта (общий лоадер).
  protected readonly stepIndex = signal<number>(0);
  protected readonly calcComplete = signal<boolean>(false);

  private stepTimer: ReturnType<typeof setInterval> | null = null;
  private calcTimers: ReturnType<typeof setTimeout>[] = [];
  private paymentTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly params = this.fb.nonNullable.group({
    term: ['year'],
    sum: [50000],
    startDate: [this.toDateInput(this.today)],
    count: [2],
  });

  protected readonly issueForm = this.fb.nonNullable.group({
    sameAsInsured: [false],
    policyholder: this.fb.nonNullable.group({
      lastName: [''],
      firstName: [''],
      middleName: [''],
      birthDate: [''],
      passport: [''],
      passportDate: [''],
      passportDept: [''],
      phone: [''],
      email: [''],
    }),
    insured: this.fb.nonNullable.array([this.makeInsured()]),
  });

  private readonly paramsValue = toSignal(
    this.params.valueChanges.pipe(startWith(this.params.getRawValue())),
    { initialValue: this.params.getRawValue() },
  );

  protected readonly productMeta = computed(
    () => PRODUCTS.find((p) => p.id === this.product()) ?? PRODUCTS[0],
  );

  protected readonly count = computed(() =>
    this.insureType() === 'group' ? Math.max(2, this.paramsValue().count || 2) : 1,
  );

  protected readonly endDate = computed(() => {
    const v = this.paramsValue();
    const months = TERMS.find((t) => t.value === v.term)?.months ?? 12;
    const end = new Date(v.startDate || this.toDateInput(this.today));
    end.setMonth(end.getMonth() + months);
    end.setDate(end.getDate() - 1);
    return end;
  });

  protected readonly selectedOffer = computed<Offer | null>(() => {
    const id = this.selectedOfferId();
    return id ? (this.offers().find((o) => o.id === id) ?? null) : null;
  });
  protected readonly selectedPrice = computed(() => {
    const o = this.selectedOffer();
    return o ? this.offerPrice(o) : 0;
  });

  // Самая выгодная сейчас (по текущей цене с учётом скидки) — «Лучшая цена».
  protected readonly bestOfferId = computed<string | null>(() => {
    const list = this.offers();
    if (list.length === 0) return null;
    return list.reduce((min, o) => (this.offerPrice(o) < this.offerPrice(min) ? o : min)).id;
  });

  // Шаги лоадера зависят от продукта (его СК), с логотипами.
  protected readonly calcSteps = computed<CalcStep[]>(() => [
    { text: 'Отправляем данные в страховые компании' },
    ...PRODUCT_CARRIERS[this.product()].map((pc) => ({
      text: CARRIERS[pc.carrierId].short,
      carrierId: pc.carrierId,
    })),
    { text: 'Получаем ответы' },
  ]);

  // Цена и скидка по офферу (управление ценой). У неразрешённых к скидке СК — всегда 0.
  offerDiscount(offer: Offer): number {
    if (!offer.discountable) return 0;
    return this.discounts()[offer.id] ?? 0;
  }
  offerPrice(offer: Offer): number {
    return Math.round(offer.basePrice * (1 - this.offerDiscount(offer) / 100));
  }
  setDiscount(offerId: string, pct: number): void {
    const offer = this.offers().find((o) => o.id === offerId);
    if (!offer?.discountable) return;
    this.discounts.update((d) => ({ ...d, [offerId]: pct }));
  }

  // Labels/factors for the price-breakdown popover.
  protected readonly termLabel = computed(
    () => TERMS.find((t) => t.value === this.paramsValue().term)?.label ?? 'Год',
  );
  protected readonly termFactor = computed(
    () => (TERMS.find((t) => t.value === this.paramsValue().term)?.months ?? 12) / 12,
  );
  protected readonly catLabel = computed(() =>
    this.category() === 'adult' ? 'Взрослый' : 'Ребёнок',
  );
  protected readonly catFactor = computed(() => (this.category() === 'adult' ? 1.1 : 1));

  protected get insuredControls(): FormGroup[] {
    return (this.issueForm.controls.insured as FormArray<FormGroup>).controls;
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimers());
  }

  // ─── Params ───

  setProduct(p: HealthProduct): void {
    this.product.set(p);
  }

  setInsureType(t: InsureType): void {
    this.insureType.set(t);
  }

  setCategory(c: Category): void {
    this.category.set(c);
  }

  calculate(): void {
    this.clearTimers();
    const list = this.generateOffers();
    this.offers.set(list);
    this.discounts.set({});
    this.selectedOfferId.set(list[0]?.id ?? null); // самый дешёвый по базе
    this.stepIndex.set(0);
    this.calcComplete.set(false);
    this.view.set('loading');

    // Лоадер: каждая фраза держится HL_STEP_MS (читаемо), затем «Готово» → предложения.
    const steps = this.calcSteps().length;
    const totalMs = HL_STEP_MS * steps;
    this.stepTimer = setInterval(() => {
      this.stepIndex.update((i) => Math.min(i + 1, steps - 1));
    }, HL_STEP_MS);
    this.calcTimers.push(setTimeout(() => this.calcComplete.set(true), totalMs));
    this.calcTimers.push(setTimeout(() => this.view.set('quotes'), totalMs + HL_DONE_HOLD_MS));
  }

  cancelCalculation(): void {
    this.clearTimers();
    this.calcComplete.set(false);
    this.view.set('params');
  }

  // ─── Quotes ───

  selectOffer(id: string): void {
    this.selectedOfferId.set(id);
  }

  // Выбор предложения по кнопке на карточке (как «Оформить» в ОСАГО — без radio).
  chooseOffer(id: string): void {
    this.selectOffer(id);
    this.continueToIssue();
  }

  togglePriceInfo(id: string): void {
    this.priceInfoOfferId.update((v) => (v === id ? null : id));
  }

  closePriceInfo(): void {
    this.priceInfoOfferId.set(null);
  }

  continueToIssue(): void {
    if (!this.selectedOffer()) return;
    this.syncInsured();
    this.view.set('issue');
  }

  backToParams(): void {
    this.view.set('params');
  }

  backToQuotes(): void {
    this.view.set('quotes');
  }

  // ─── Issue ───

  onSameAsInsured(): void {
    const same = this.issueForm.controls.sameAsInsured.value;
    if (!same) return;
    const ph = this.issueForm.controls.policyholder.getRawValue();
    this.insuredControls[0]?.patchValue({
      lastName: ph.lastName,
      firstName: ph.firstName,
      middleName: ph.middleName,
      birthDate: ph.birthDate,
    });
  }

  pay(): void {
    this.view.set('payment');
    this.paymentTimer = setTimeout(() => this.view.set('success'), 3000);
  }

  saveDraft(): void {
    alert('Черновик сохранён (заглушка)');
  }

  newCalculation(): void {
    this.selectedOfferId.set(null);
    this.offers.set([]);
    this.view.set('params');
  }

  goToClients(): void {
    void this.router.navigate(['/clients']);
  }

  // ─── Internals ───

  private generateOffers(): Offer[] {
    const v = this.paramsValue();
    const termFactor = (TERMS.find((t) => t.value === v.term)?.months ?? 12) / 12;
    const catFactor = this.category() === 'adult' ? 1.1 : 1;
    const count = this.count();
    const sum = Number(v.sum) || 0;
    // Один оффер на компанию (скидка теперь — управление ценой на карточке).
    return PRODUCT_CARRIERS[this.product()]
      .map((pc) => {
        const c = CARRIERS[pc.carrierId];
        const base = Math.max(150, Math.round(sum * pc.rate * termFactor * catFactor * count));
        return {
          id: pc.carrierId,
          carrierId: pc.carrierId,
          carrierName: c.name,
          carrierShort: c.short,
          basePrice: base,
          rate: pc.rate,
          discountable: pc.discountable,
        };
      })
      .sort((a, b) => a.basePrice - b.basePrice);
  }

  private syncInsured(): void {
    const arr = this.issueForm.controls.insured as FormArray<FormGroup>;
    const target = this.count();
    while (arr.length < target) arr.push(this.makeInsured());
    while (arr.length > target) arr.removeAt(arr.length - 1);
  }

  private makeInsured(): FormGroup {
    return this.fb.nonNullable.group({
      lastName: [''],
      firstName: [''],
      middleName: [''],
      birthDate: [''],
    });
  }

  private toDateInput(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private clearTimers(): void {
    if (this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    this.calcTimers.forEach((t) => clearTimeout(t));
    this.calcTimers = [];
    if (this.paymentTimer) {
      clearTimeout(this.paymentTimer);
      this.paymentTimer = null;
    }
  }
}
