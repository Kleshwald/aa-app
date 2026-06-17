import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { HUB_PASSWORD, HUB_UNLOCK_KEY } from '@core/guards/hub.guard';

/**
 * Гейт для технической панели /hub. Оформлен как вход в платформу:
 * логин — любой телефон (форма его не сверяет), пароль — точное совпадение.
 */
@Component({
  selector: 'app-hub-unlock-page',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hu-shell">
      <main class="hu-card">
        <img src="images/logo.png" alt="Agent Academy" class="hu-logo" />

        <h1 class="hu-title">Панель управления</h1>
        <p class="hu-subtitle">Доступ для команды проекта</p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="hu-form" novalidate>
          <label class="hu-field">
            <span class="hu-field__label">Номер телефона</span>
            <input
              type="tel"
              autocomplete="tel"
              inputmode="tel"
              formControlName="login"
              placeholder="+7 (___) ___-__-__"
              class="hu-field__input"
            />
          </label>

          <label class="hu-field">
            <span class="hu-field__label">Пароль</span>
            <span class="hu-field__input-wrap">
              <input
                [type]="showPassword() ? 'text' : 'password'"
                autocomplete="current-password"
                formControlName="password"
                (input)="error.set(false)"
                class="hu-field__input hu-field__input--with-action"
              />
              <button
                type="button"
                class="hu-field__toggle"
                (click)="togglePassword()"
                [attr.aria-label]="showPassword() ? 'Скрыть пароль' : 'Показать пароль'"
                [attr.aria-pressed]="showPassword()"
              >
                @if (showPassword()) {
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path
                      d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
                    />
                    <path
                      d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
                    />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                } @else {
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                }
              </button>
            </span>
          </label>

          @if (error()) {
            <div class="hu-error" role="alert">Неверный пароль</div>
          }

          <button type="submit" [disabled]="form.invalid" class="hu-submit">Войти</button>
        </form>
      </main>

      <footer class="hu-footer">
        <p>Техническая панель проекта Agent Academy</p>
      </footer>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .hu-shell {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      min-height: 100vh;
      width: 100%;
      padding: 48px 16px 24px;
      background: var(--gray-50);
    }
    .hu-card {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      width: 100%;
      max-width: 480px;
      margin-top: auto;
      padding: 40px 32px;
      background: #ffffff;
      border: 1px solid var(--gray-200);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
    }
    .hu-logo {
      display: block;
      height: 48px;
      width: auto;
      max-width: 220px;
      margin: 0 auto 28px;
      object-fit: contain;
    }
    .hu-title {
      font-size: var(--text-2xl);
      line-height: var(--leading-2xl);
      font-weight: var(--weight-semibold);
      color: var(--gray-900);
      text-align: center;
      margin: 0 0 8px;
    }
    .hu-subtitle {
      font-size: var(--text-base);
      line-height: var(--leading-base);
      color: var(--gray-700);
      text-align: center;
      margin: 0 0 32px;
    }
    .hu-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .hu-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .hu-field__label {
      font-size: var(--text-sm);
      line-height: var(--leading-sm);
      font-weight: var(--weight-medium);
      color: var(--gray-700);
    }
    .hu-field__input {
      height: 48px;
      padding: 0 14px;
      font-family: inherit;
      font-size: var(--text-sm);
      line-height: var(--leading-sm);
      color: var(--gray-900);
      background: #ffffff;
      border: 2px solid var(--gray-300);
      border-radius: var(--radius-base);
      transition:
        border-color 120ms ease-out,
        box-shadow 120ms ease-out;
      appearance: none;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    .hu-field__input::placeholder {
      color: var(--gray-500);
    }
    .hu-field__input:hover:not(:disabled) {
      border-color: var(--gray-400);
    }
    .hu-field__input:focus {
      border-color: var(--brand-500);
      box-shadow: 0 0 0 4px var(--brand-100);
    }
    .hu-field__input--with-action {
      padding-right: 48px;
    }
    .hu-field__input-wrap {
      position: relative;
      display: block;
    }
    .hu-field__toggle {
      position: absolute;
      top: 50%;
      right: 8px;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: var(--radius-base);
      color: var(--gray-500);
      cursor: pointer;
      transition:
        color 120ms ease-out,
        background 120ms ease-out;
    }
    .hu-field__toggle:hover {
      color: var(--gray-700);
      background: var(--gray-100);
    }
    .hu-field__toggle:focus-visible {
      outline: none;
      color: var(--brand-500);
      box-shadow: 0 0 0 3px var(--brand-100);
    }
    .hu-error {
      padding: 12px 16px;
      border-radius: var(--radius-base);
      background: var(--error-50);
      border: 1px solid var(--error-100);
      color: var(--error-700);
      font-size: var(--text-sm);
      line-height: var(--leading-sm);
    }
    .hu-submit {
      height: 56px;
      margin-top: 4px;
      padding: 0 24px;
      font-family: inherit;
      font-size: var(--text-base);
      font-weight: var(--weight-medium);
      color: #ffffff;
      background: var(--brand-500);
      border: none;
      border-radius: var(--radius-base);
      cursor: pointer;
      transition: background 120ms ease-out;
      width: 100%;
    }
    .hu-submit:hover:not(:disabled) {
      background: var(--brand-600);
    }
    .hu-submit:active:not(:disabled) {
      background: var(--brand-700);
    }
    .hu-submit:disabled {
      background: var(--gray-300);
      color: var(--gray-600);
      cursor: not-allowed;
    }
    .hu-footer {
      margin-top: auto;
      padding-top: 32px;
      width: 100%;
      max-width: 480px;
      text-align: center;
    }
    .hu-footer p {
      margin: 0;
      font-size: var(--text-xs);
      line-height: var(--leading-xs);
      color: var(--gray-500);
    }
    @media (max-width: 639px) {
      .hu-shell {
        padding: 24px 16px 16px;
      }
      .hu-card {
        padding: 32px 24px;
      }
      .hu-logo {
        height: 40px;
        margin-bottom: 24px;
      }
      .hu-title {
        font-size: var(--text-xl);
        line-height: var(--leading-xl);
      }
    }
  `,
})
export class HubUnlockPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly error = signal(false);
  protected readonly showPassword = signal(false);

  // Логин — любой телефон (только непустой), пароль сверяем точно.
  protected readonly form = this.fb.nonNullable.group({
    login: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    if (this.form.getRawValue().password === HUB_PASSWORD) {
      sessionStorage.setItem(HUB_UNLOCK_KEY, '1');
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/hub';
      void this.router.navigateByUrl(returnUrl);
    } else {
      this.error.set(true);
    }
  }
}
