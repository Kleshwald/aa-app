import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { DealService } from '@core/services/deal.service';
import { MaskitoDirective } from '@maskito/angular';
import type { MaskitoOptions } from '@maskito/core';
import { BreadcrumbsComponent } from '@shared/breadcrumbs/breadcrumbs.component';
import { FieldComponent } from '@shared/field/field.component';
import { IsoDayTransformer } from '@shared/iso-day.transformer';
import { TuiInput, TuiTextfield, tuiTextfieldOptionsProvider } from '@taiga-ui/core';
import { TuiInputDate, TuiSelect, tuiInputDateOptionsProvider } from '@taiga-ui/kit';

const PHONE_MASK: MaskitoOptions = {
  mask: [
    '+',
    '7',
    ' ',
    '(',
    /\d/,
    /\d/,
    /\d/,
    ')',
    ' ',
    /\d/,
    /\d/,
    /\d/,
    ' ',
    /\d/,
    /\d/,
    ' ',
    /\d/,
    /\d/,
  ],
};

/**
 * Опросник — вход в сделку «Согласование». Продукты, которые агент НЕ может
 * посчитать сам (нестандарт, ЮЛ, КАСКО, имущество, спецтехника): данные уходят
 * поддержке, она идёт в СК за тарифом.
 *
 * Опросник СОЗНАТЕЛЬНО минимальный и УНИВЕРСАЛЬНЫЙ (решение владельца: не
 * проектировать 10 форм под 10 продуктов). Специфику дособерёт поддержка в
 * переписке по сделке — это дешевле, чем год проектировать формы, и честнее:
 * мы не знаем заранее, что спросит конкретная СК.
 */
const PRODUCTS = [
  'КАСКО',
  'Ипотека',
  'Имущество',
  'Спецтехника',
  'Страхование юридических лиц',
  'Другое',
] as const;

@Component({
  selector: 'app-new-deal-page',
  imports: [
    ReactiveFormsModule,
    BreadcrumbsComponent,
    FieldComponent,
    TuiTextfield,
    TuiInput,
    TuiInputDate,
    TuiSelect,
    MaskitoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-deal.page.html',
  styleUrl: './new-deal.page.scss',
  providers: [
    tuiInputDateOptionsProvider({ valueTransformer: new IsoDayTransformer() }),
    tuiTextfieldOptionsProvider({ cleaner: signal(false) }),
  ],
})
export class NewDealPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(DealService);
  private readonly router = inject(Router);

  protected readonly phoneMask = PHONE_MASK;
  protected readonly productItems = [...PRODUCTS];

  protected readonly sending = signal(false);
  protected readonly failed = signal(false);
  /** Показывать ошибки только после попытки отправки — не ругаемся заранее. */
  protected readonly submitted = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    clientName: ['', [Validators.required, Validators.minLength(3)]],
    clientPhone: ['', [Validators.required, Validators.minLength(18)]],
    productLabel: ['', Validators.required],
    objectLabel: ['', Validators.required],
    desiredStart: [''],
    request: ['', [Validators.required, Validators.minLength(10)]],
  });

  protected error(control: keyof typeof this.form.controls, message: string): string {
    const c = this.form.controls[control];
    return this.submitted() && c.invalid ? message : '';
  }

  send(): void {
    this.submitted.set(true);
    this.failed.set(false);
    if (this.form.invalid || this.sending()) return;

    this.sending.set(true);
    const v = this.form.getRawValue();
    this.service
      .create({
        clientName: v.clientName.trim(),
        clientPhone: v.clientPhone.trim(),
        productLabel: v.productLabel,
        objectLabel: v.objectLabel.trim(),
        request: v.request.trim(),
        desiredStart: v.desiredStart || undefined,
      })
      .subscribe({
        next: (res) => {
          this.sending.set(false);
          if (res.success && res.data) {
            void this.router.navigate(['/deals', res.data.id]);
          } else {
            this.failed.set(true);
          }
        },
        error: () => {
          this.sending.set(false);
          this.failed.set(true);
        },
      });
  }
}
