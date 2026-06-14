import { DatePipe, DecimalPipe } from '@angular/common';
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

import { InsurerLogoComponent } from '@shared/insurer-logo/insurer-logo.component';

type HealthProduct = 'ns' | 'tick';
type InsureType = 'individual' | 'group';
type Category = 'child' | 'adult';
type View = 'params' | 'quotes' | 'issue' | 'payment' | 'success';

interface Offer {
  id: string;
  carrierId: string;
  carrierName: string;
  carrierShort: string;
  price: number;
  basePrice: number;
  kv: boolean;
  kvPercent: number;
}

const PRODUCTS: { id: HealthProduct; label: string; heading: string }[] = [
  { id: 'ns', label: 'НС', heading: 'Предложения по страхованию от НС:' },
  { id: 'tick', label: 'Антиклещ', heading: 'Предложения по страхованию от клеща:' },
];

const CARRIERS: Record<string, { name: string; short: string }> = {
  renessans: { name: 'Ренессанс страхование', short: 'Ренессанс' },
  soglasie: { name: 'Согласие', short: 'Согласие' },
  ugoria: { name: 'Югория', short: 'Югория' },
};

// Which carriers quote which product, and their mock rate (share of the insured sum / year).
const PRODUCT_CARRIERS: Record<HealthProduct, { carrierId: string; rate: number }[]> = {
  ns: [
    { carrierId: 'renessans', rate: 0.0078 },
    { carrierId: 'soglasie', rate: 0.0085 },
  ],
  tick: [
    { carrierId: 'renessans', rate: 0.004 },
    { carrierId: 'ugoria', rate: 0.0045 },
  ],
};

const TERMS: { value: string; label: string; months: number }[] = [
  { value: 'year', label: 'Год', months: 12 },
  { value: '6m', label: '6 месяцев', months: 6 },
  { value: '3m', label: '3 месяца', months: 3 },
];

const SUMS = [50000, 100000, 150000, 300000, 500000, 1000000];

const KV_PERCENT = 18;

@Component({
  selector: 'app-health-page',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, InsurerLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './health.page.html',
  styleUrl: './health.page.scss',
})
export class HealthPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly products = PRODUCTS;
  protected readonly terms = TERMS;
  protected readonly sums = SUMS;
  protected readonly today = new Date();

  protected readonly product = signal<HealthProduct>('ns');
  protected readonly insureType = signal<InsureType>('individual');
  protected readonly category = signal<Category>('child');
  protected readonly view = signal<View>('params');

  protected readonly offers = signal<Offer[]>([]);
  protected readonly showMore = signal(false);
  protected readonly selectedOfferId = signal<string | null>(null);

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

  // Cheapest first — base offers are ranked by price, the cheapest is the anchor
  // (and the default selection set in calculate()).
  protected readonly baseOffers = computed(() =>
    this.offers()
      .filter((o) => !o.kv)
      .sort((a, b) => a.price - b.price),
  );
  protected readonly kvOffers = computed(() =>
    this.offers()
      .filter((o) => o.kv)
      .sort((a, b) => a.price - b.price),
  );

  protected readonly selectedOffer = computed<Offer | null>(() => {
    const id = this.selectedOfferId();
    return id ? (this.offers().find((o) => o.id === id) ?? null) : null;
  });

  protected get insuredControls(): FormGroup[] {
    return (this.issueForm.controls.insured as FormArray<FormGroup>).controls;
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimer());
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
    this.offers.set(this.generateOffers());
    this.selectedOfferId.set(this.baseOffers()[0]?.id ?? null);
    this.showMore.set(false);
    this.view.set('quotes');
  }

  // ─── Quotes ───

  selectOffer(id: string): void {
    this.selectedOfferId.set(id);
  }

  toggleMore(): void {
    this.showMore.update((v) => !v);
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
    const list: Offer[] = [];
    for (const pc of PRODUCT_CARRIERS[this.product()]) {
      const c = CARRIERS[pc.carrierId];
      const sum = Number(v.sum) || 0;
      const base = Math.max(150, Math.round(sum * pc.rate * termFactor * catFactor * count));
      list.push({
        id: `${pc.carrierId}-base`,
        carrierId: pc.carrierId,
        carrierName: c.name,
        carrierShort: c.short,
        price: base,
        basePrice: base,
        kv: false,
        kvPercent: 0,
      });
      list.push({
        id: `${pc.carrierId}-kv`,
        carrierId: pc.carrierId,
        carrierName: c.name,
        carrierShort: c.short,
        price: Math.round(base * (1 - KV_PERCENT / 100)),
        basePrice: base,
        kv: true,
        kvPercent: KV_PERCENT,
      });
    }
    return list;
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

  private clearTimer(): void {
    if (this.paymentTimer) {
      clearTimeout(this.paymentTimer);
      this.paymentTimer = null;
    }
  }
}
