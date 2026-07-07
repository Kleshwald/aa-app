import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MaskitoDirective } from '@maskito/angular';
import type { MaskitoOptions } from '@maskito/core';

import { BackLinkComponent } from '@shared/back-link/back-link.component';
import { InsurerLogoComponent } from '@shared/insurer-logo/insurer-logo.component';
import {
  OnboardingProgressComponent,
  type OnboardingStep,
} from '@shared/onboarding-progress/onboarding-progress.component';

import { insuranceCompanies } from '@core/mock/fixtures/insurance-companies.fixture';

type Step = 'form' | 'sms' | 'status';
// Форма работы на лендинге — только ФЛ / ИП / ЮЛ. «Самозанятый» здесь НЕ выбирается:
// он доступен позже во флоу (после регистрации как ФЛ), не на этом экране.
type Employment = 'fl' | 'ip' | 'ul';

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
    '-',
    /\d/,
    /\d/,
    '-',
    /\d/,
    /\d/,
  ],
};
const CODE_MASK: MaskitoOptions = { mask: [/\d/, /\d/, /\d/, /\d/] };

const EMPLOYMENT: { value: Employment; label: string; hint: string }[] = [
  { value: 'fl', label: 'Физлицо', hint: 'обычный агент' },
  { value: 'ip', label: 'ИП', hint: 'предприниматель' },
  { value: 'ul', label: 'Юрлицо', hint: 'организация' },
];

// Демо-регистрация агента по ссылке (путь 2): лендинг → «вы в системе» → (по
// желанию) подпись оферты по SMS. Онбординг — предустановленный сценарий на моках,
// без бэкенда: считать можно сразу, оформлять — после подписи оферты (ОСАГО).
@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    BackLinkComponent,
    OnboardingProgressComponent,
    InsurerLogoComponent,
    MaskitoDirective,
  ],
  templateUrl: './register.page.html',
  styleUrl: './register.page.scss',
})
export class RegisterPage implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly employmentOptions = EMPLOYMENT;
  // Партнёрские страховые для полосы логотипов в промо-панели («много и надёжно»).
  protected readonly insurers = insuranceCompanies;
  protected readonly phoneMask = PHONE_MASK;
  protected readonly codeMask = CODE_MASK;

  protected readonly step = signal<Step>('form');
  protected readonly signed = signal(false);
  protected readonly codeError = signal(false);
  protected readonly resendIn = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  protected readonly form = this.fb.nonNullable.group({
    lastName: ['', [Validators.required]],
    firstName: ['', [Validators.required]],
    middleName: [''],
    // Адрес точки продаж — свободный ввод адреса. Дату рождения здесь НЕ спрашиваем —
    // переносится на более поздний шаг онбординга (подпись оферты / реквизиты).
    salesPoint: ['', [Validators.required]],
    employment: ['fl' as Employment, [Validators.required]],
    phone: ['', [Validators.required]],
  });

  protected readonly code = this.fb.nonNullable.control('');

  // Приветствие: Имя + Отчество (полное ФИО — доменный факт).
  protected readonly greetingName = computed(() => {
    const { firstName, middleName } = this.form.getRawValue();
    return [firstName, middleName].filter(Boolean).join(' ').trim();
  });

  // Телефон с показом последних 2 цифр (для экрана SMS).
  protected readonly maskedPhone = computed(() => {
    const p = this.form.getRawValue().phone.replace(/\D/g, '');
    if (p.length < 4) return this.form.getRawValue().phone;
    return `+7 (${p.slice(1, 4)}) •••-••-${p.slice(-2)}`;
  });

  protected readonly steps = computed<OnboardingStep[]>(() => {
    const s = this.signed();
    return [
      { label: 'Регистрация', sub: 'готово', state: 'done' },
      { label: 'Расчёты', sub: 'доступны', state: 'done' },
      {
        label: 'Подпись оферты',
        sub: s ? 'подписано' : 'чтобы оформлять',
        state: s ? 'done' : 'current',
      },
      { label: 'Активен', sub: s ? 'добавьте реквизиты' : 'после подписи', state: 'locked' },
    ];
  });

  setEmployment(value: Employment): void {
    this.form.controls.employment.setValue(value);
  }

  /** Показывать ли ошибку под полем: поле тронуто и невалидно. */
  protected isInvalid(ctrl: { touched: boolean; invalid: boolean }): boolean {
    return ctrl.touched && ctrl.invalid;
  }

  submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.step.set('status');
  }

  startSign(): void {
    this.code.reset('');
    this.codeError.set(false);
    this.step.set('sms');
    this.startResendTimer();
  }

  submitCode(): void {
    // Демо: любой 4-значный код принимается (для наглядности теста).
    if (this.code.value.replace(/\D/g, '').length < 4) {
      this.codeError.set(true);
      return;
    }
    this.signed.set(true);
    this.stopTimer();
    this.step.set('status');
  }

  resend(): void {
    this.startResendTimer();
  }

  backToStatus(): void {
    this.stopTimer();
    this.step.set('status');
  }

  goCalculate(): void {
    void this.router.navigate(['/osago']);
  }

  private startResendTimer(): void {
    this.stopTimer();
    this.resendIn.set(45);
    this.timer = setInterval(() => {
      const left = this.resendIn() - 1;
      this.resendIn.set(Math.max(0, left));
      if (left <= 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }
}
