import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly currentYear = new Date().getFullYear();

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

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
          this.error.set(response.error?.message ?? 'Не удалось войти. Проверьте логин и пароль.');
        }
      },
      error: (err: { error?: { error?: { message?: string } } }) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Не удалось войти. Проверьте логин и пароль.');
      },
    });
  }
}
