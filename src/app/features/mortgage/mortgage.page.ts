import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-mortgage-page',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-2">
      <h1 class="text-2xl font-semibold text-gray-900">Ипотека</h1>
      <p class="text-gray-700 mt-3">Эта страница будет реализована на следующем этапе.</p>
    </section>
  `,
})
export class MortgagePage {}
