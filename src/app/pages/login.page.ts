import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '@core/services/auth.service';

// Minimal placeholder login form — full UI implementation lands in a later phase.
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border border-gray-200">
      <h1 class="text-2xl font-semibold mb-6 text-gray-900">Вход в Agent Academy</h1>
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">Логин (ИКП или email)</span>
          <input
            type="text"
            formControlName="login"
            class="h-12 px-3 border-2 border-gray-300 rounded-md focus:border-brand-500 outline-none"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">Пароль</span>
          <input
            type="password"
            formControlName="password"
            class="h-12 px-3 border-2 border-gray-300 rounded-md focus:border-brand-500 outline-none"
          />
        </label>
        @if (error()) {
          <p class="text-error-600 text-sm">{{ error() }}</p>
        }
        <button
          type="submit"
          [disabled]="form.invalid || loading()"
          class="h-12 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-md disabled:opacity-50"
        >
          {{ loading() ? 'Входим…' : 'Войти' }}
        </button>
      </form>
    </div>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    login: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.success) {
          void this.router.navigate(['/dashboard']);
        } else {
          this.error.set(response.error?.message ?? 'Ошибка входа');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Не удалось войти. Проверьте данные.');
      },
    });
  }
}
