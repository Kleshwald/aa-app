import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div class="text-center">
        <h1 class="text-3xl font-semibold text-gray-900 mb-3">Страница не найдена</h1>
        <p class="text-gray-700 mb-6">Возможно, ссылка устарела или адрес введён с ошибкой.</p>
        <a
          routerLink="/clients"
          class="inline-block h-12 px-6 leading-[3rem] bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-md"
          >К моим клиентам</a
        >
      </div>
    </div>
  `,
})
export class NotFoundPage {}
