import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-learning-page',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-2">
      <h1 class="text-2xl font-semibold text-gray-900">Обучение</h1>
      <p class="text-gray-700 mt-3">Эта страница будет реализована на следующем этапе.</p>
    </section>
  `,
})
export class LearningPage {}
