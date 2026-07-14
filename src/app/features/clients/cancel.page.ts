import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { TuiInput, TuiTextfield, tuiTextfieldOptionsProvider } from '@taiga-ui/core';
import { TuiInputDate, TuiSelect, tuiInputDateOptionsProvider } from '@taiga-ui/kit';

import { ClientDetailService, type PolicyDetail } from '@core/services/client-detail.service';
import { ProcessService } from '@core/services/process.service';
import {
  CANCEL_APPLICANTS,
  CANCEL_REASONS,
  CANCEL_WITHHOLD_RATE,
  cancelReason,
  estimateRefund,
  type CancelPayload,
  type RefundEstimate,
} from '@core/services/cancel.model';
import { BackLinkComponent } from '@shared/back-link/back-link.component';
import { FieldComponent } from '@shared/field/field.component';
import { InsurerLogoComponent } from '@shared/insurer-logo/insurer-logo.component';
import { IsoDayTransformer } from '@shared/iso-day.transformer';

const PRODUCT_LABEL: Record<PolicyDetail['type'], string> = {
  OSAGO: 'ОСАГО',
  NS: 'НС при ДТП',
  TICK: 'Антиклещ',
  MORTGAGE: 'Ипотека',
};

function isoDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Заявка на расторжение договора — [Р-ФТ-1] легаси-спеки: кто заявитель + причина +
 * документы + комментарий, плюс калькулятор возврата [Р-ФТ-4].
 *
 * Осознанно НЕ переиспользуем форму ОСАГО (в отличие от «внесения изменений»): там
 * правда редактируются те же поля полиса, а здесь предмет другой — деньги и дата
 * прекращения. Заставлять агента проверять VIN и водителей ради расторжения — налог
 * на внимание.
 */
@Component({
  selector: 'app-cancel-page',
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    TuiTextfield,
    TuiInput,
    TuiSelect,
    TuiInputDate,
    FieldComponent,
    BackLinkComponent,
    InsurerLogoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cancel.page.html',
  styleUrl: './cancel.page.scss',
  providers: [
    tuiInputDateOptionsProvider({ valueTransformer: new IsoDayTransformer() }),
    tuiTextfieldOptionsProvider({ cleaner: signal(false) }),
  ],
})
export class CancelPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ClientDetailService);
  private readonly processService = inject(ProcessService);

  protected readonly productLabel = PRODUCT_LABEL;
  protected readonly withholdPercent = Math.round(CANCEL_WITHHOLD_RATE * 100);

  // Taiga select: список значений + stringify (код → подпись).
  protected readonly applicantItems = CANCEL_APPLICANTS.map((a) => a.code);
  protected readonly stringifyApplicant = (code: string): string =>
    CANCEL_APPLICANTS.find((a) => a.code === code)?.label ?? code;
  protected readonly reasonItems = CANCEL_REASONS.map((r) => r.code);
  protected readonly stringifyReason = (code: string): string =>
    CANCEL_REASONS.find((r) => r.code === code)?.label ?? code;

  private readonly policyId = this.route.snapshot.paramMap.get('id') ?? '';

  private readonly response = toSignal(
    this.route.paramMap.pipe(switchMap((p) => this.service.get(p.get('id') ?? ''))),
    { initialValue: undefined },
  );

  protected readonly policy = computed<PolicyDetail | null>(() => {
    const r = this.response();
    return r?.success ? (r.data ?? null) : null;
  });
  protected readonly isLoading = computed(() => this.response() === undefined);

  protected readonly submitting = signal(false);
  protected readonly submitError = signal('');

  protected readonly form = new FormGroup({
    applicant: new FormControl<string>('policyholder', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    reason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    // Для оснований «по событию» агент вводит дату сам; для остальных — день подачи.
    eventDate: new FormControl<string>('', { nonNullable: true }),
    comment: new FormControl<string>('', { nonNullable: true }),
  });

  // computed над form.value не реактивен → тянем через toSignal (грабля из памяти).
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly selectedReason = computed(() => cancelReason(this.formValue().reason ?? ''));

  /** Дату события агент вводит только там, где она правда определяет прекращение. */
  protected readonly needsEventDate = computed(() => this.selectedReason()?.dateBasis === 'event');

  /** Заявитель не страхователь → деньги всё равно вернут страхователю. */
  protected readonly applicantIsNotPolicyholder = computed(
    () => (this.formValue().applicant ?? 'policyholder') !== 'policyholder',
  );

  /** Дата прекращения: день события (если основание «по событию») либо день подачи. */
  protected readonly terminationDate = computed<string>(() => {
    const today = isoDay(new Date());
    if (!this.needsEventDate()) return today;
    return this.formValue().eventDate || today;
  });

  protected readonly refund = computed<RefundEstimate | null>(() => {
    const p = this.policy();
    const reason = this.selectedReason();
    if (!p || !reason || !reason.refund) return null;
    return estimateRefund(p.premium, p.startDate, p.endDate, this.terminationDate());
  });

  /** Срок полиса вышел — возвращать нечего, и об этом честнее сказать заранее. */
  protected readonly nothingToRefund = computed(() => {
    const r = this.refund();
    return !!r && r.remainingDays === 0;
  });

  protected readonly canSubmit = computed(() => {
    if (this.submitting() || !this.policy()) return false;
    if (!this.formValue().reason) return false;
    if (this.needsEventDate() && !this.formValue().eventDate) return false;
    return true;
  });

  backToContract(): void {
    void this.router.navigate(['/clients', this.policyId]);
  }

  submit(): void {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: CancelPayload = {
      applicant: v.applicant,
      reason: v.reason,
      terminationDate: this.terminationDate(),
      comment: v.comment || undefined,
      refundEstimate: this.refund()?.amount,
    };

    this.submitting.set(true);
    this.submitError.set('');
    this.processService
      .create(this.policyId, { kind: 'cancel', reasons: [v.reason], formSnapshot: payload })
      .subscribe({
        next: (r) => {
          this.submitting.set(false);
          if (!r.success) {
            // [ФТ-3] ошибка отправки → предложить повторить, НЕ теряя форму (3G рвётся).
            this.submitError.set(
              'Не удалось отправить заявку. Проверьте связь и попробуйте ещё раз.',
            );
            return;
          }
          void this.router.navigate(['/clients', this.policyId], {
            queryParams: { requested: 'cancel' },
          });
        },
        error: () => {
          this.submitting.set(false);
          this.submitError.set(
            'Не удалось отправить заявку. Проверьте связь и попробуйте ещё раз.',
          );
        },
      });
  }
}
