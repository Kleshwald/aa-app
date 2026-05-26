import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  imports: [RouterLink, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex flex-col">
      <header class="bg-white border-b border-gray-200 px-6 h-16 flex items-center justify-between">
        <a routerLink="/dashboard" class="flex items-center gap-3">
          <span class="text-xl font-semibold text-brand-500">Agent Academy</span>
        </a>
        <nav class="flex items-center gap-6 text-sm">
          <a routerLink="/dashboard" class="text-gray-700 hover:text-brand-500">Главная</a>
          <a routerLink="/osago" class="text-gray-700 hover:text-brand-500">Расчёт ОСАГО</a>
          <a routerLink="/policies" class="text-gray-700 hover:text-brand-500">Полисы</a>
          <a routerLink="/profile" class="text-gray-700 hover:text-brand-500">Профиль</a>
          <button type="button" (click)="auth.logout()" class="text-gray-700 hover:text-error-600">
            Выйти
          </button>
        </nav>
      </header>
      <main class="flex-1 bg-gray-50">
        <router-outlet />
      </main>
    </div>
  `,
})
export class MainLayoutComponent {
  protected readonly auth = inject(AuthService);
}
