import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { HUB_PASSWORD, HUB_UNLOCK_KEY } from '@core/guards/hub.guard';

/** Пароль-гейт для технической панели /hub. */
@Component({
  selector: 'app-hub-unlock-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hu">
      <form class="hu__card" (submit)="submit($event)">
        <h1 class="hu__title">Панель проекта</h1>
        <p class="hu__text">Введите пароль для доступа к технической панели.</p>
        <input
          class="hu__input"
          type="password"
          [value]="value()"
          (input)="onInput($event)"
          placeholder="Пароль"
          aria-label="Пароль"
        />
        @if (error()) {
          <p class="hu__error">Неверный пароль</p>
        }
        <button type="submit" class="hu__btn">Войти</button>
      </form>
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: var(--brand-50);
    }
    .hu {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .hu__card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      max-width: 380px;
      padding: 32px;
      background: #ffffff;
      border: 1px solid var(--gray-200);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }
    .hu__title {
      margin: 0;
      font-size: var(--text-xl);
      font-weight: var(--weight-semibold);
      color: var(--header-bg);
    }
    .hu__text {
      margin: 0 0 4px;
      font-size: var(--text-sm);
      color: var(--gray-600);
    }
    .hu__input {
      height: 48px;
      padding: 0 14px;
      font-family: inherit;
      font-size: var(--text-base);
      color: var(--gray-900);
      background: #ffffff;
      border: 1px solid var(--gray-300);
      border-radius: var(--radius-base);
      outline: none;
    }
    .hu__input:focus {
      border-color: var(--header-bg);
      box-shadow: 0 0 0 3px var(--brand-100);
    }
    .hu__error {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--error-600);
    }
    .hu__btn {
      height: 48px;
      font-family: inherit;
      font-size: var(--text-base);
      font-weight: var(--weight-medium);
      color: #ffffff;
      background: var(--header-bg);
      border: none;
      border-radius: var(--radius-base);
      cursor: pointer;
    }
    .hu__btn:hover {
      background: var(--header-bg-hover);
    }
  `,
})
export class HubUnlockPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly value = signal('');
  protected readonly error = signal(false);

  onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
    this.error.set(false);
  }

  submit(event: Event): void {
    event.preventDefault();
    if (this.value() === HUB_PASSWORD) {
      sessionStorage.setItem(HUB_UNLOCK_KEY, '1');
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/hub';
      void this.router.navigateByUrl(returnUrl);
    } else {
      this.error.set(true);
    }
  }
}
