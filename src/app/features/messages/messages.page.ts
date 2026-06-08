import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-messages-page',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-2">
      <h1 class="text-2xl font-semibold text-gray-900">Сообщения</h1>
      <p class="text-gray-700 mt-3">Чат с поддержкой и страховыми компаниями появится здесь.</p>
    </section>
  `,
})
export class MessagesPage {}
