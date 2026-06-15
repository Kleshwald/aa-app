import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Заглушка самостоятельной регистрации агента — реализуется отдельно. */
@Component({
  selector: 'app-register-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="reg">
      <div class="reg__card">
        <h1 class="reg__title">Регистрация агента</h1>
        <p class="reg__text">
          Самостоятельная регистрация будет реализована отдельным этапом: анкета, проверка данных и
          подписание документов электронной подписью.
        </p>
        <div class="reg__actions">
          <a class="reg__btn reg__btn--primary" routerLink="/login">Войти</a>
          <a class="reg__btn reg__btn--secondary" routerLink="/hub">Панель проекта</a>
        </div>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: var(--brand-50);
    }
    .reg {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .reg__card {
      max-width: 480px;
      padding: 36px;
      background: #ffffff;
      border: 1px solid var(--gray-200);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      text-align: center;
    }
    .reg__title {
      margin: 0 0 12px;
      font-size: var(--text-2xl);
      font-weight: var(--weight-semibold);
      color: var(--header-bg);
    }
    .reg__text {
      margin: 0 0 24px;
      font-size: var(--text-base);
      color: var(--gray-700);
      line-height: 1.5;
    }
    .reg__actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .reg__btn {
      height: 48px;
      display: inline-flex;
      align-items: center;
      padding: 0 24px;
      font-size: var(--text-base);
      font-weight: var(--weight-medium);
      border-radius: var(--radius-base);
      text-decoration: none;
      border: 1px solid transparent;
    }
    .reg__btn--primary {
      color: #ffffff;
      background: var(--header-bg);
    }
    .reg__btn--primary:hover {
      background: var(--header-bg-hover);
    }
    .reg__btn--secondary {
      color: var(--header-bg);
      background: #ffffff;
      border-color: var(--gray-300);
    }
    .reg__btn--secondary:hover {
      border-color: var(--header-bg);
    }
  `,
})
export class RegisterPage {}
