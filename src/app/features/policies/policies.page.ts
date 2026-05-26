import { ChangeDetectionStrategy, Component } from '@angular/core';

// Placeholder — full policies list lands in the next phase.
@Component({
  selector: 'app-policies-page',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-8 max-w-7xl mx-auto">
      <h1 class="text-2xl font-semibold text-gray-900">Мои полисы</h1>
      <p class="text-gray-700 mt-3">Эта страница будет реализована на следующем этапе.</p>
    </section>
  `,
})
export class PoliciesPage {}
