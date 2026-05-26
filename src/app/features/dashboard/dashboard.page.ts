import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { DashboardService, type DashboardData } from '@core/services/dashboard.service';
import { type ApiResponse } from '@core/models';

// Placeholder dashboard — confirms the mock pipeline works end-to-end.
// Real UI lands in the next phase (metrics cards, urgent actions, recent policies).

@Component({
  selector: 'app-dashboard-page',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-8 max-w-7xl mx-auto">
      <h1 class="text-2xl font-semibold text-gray-900 mb-6">Главная</h1>
      @if (dashboard(); as response) {
        @if (response.success && response.data; as data) {
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-white p-6 rounded-lg border border-gray-200">
              <p class="text-sm text-gray-700 mb-1">Заработано в этом месяце</p>
              <p class="text-2xl font-semibold text-gray-900">
                {{ data.metrics.monthlyEarnings | number: '1.0-0' }} ₽
              </p>
            </div>
            <div class="bg-white p-6 rounded-lg border border-gray-200">
              <p class="text-sm text-gray-700 mb-1">Активных полисов</p>
              <p class="text-2xl font-semibold text-gray-900">{{ data.metrics.activePolicies }}</p>
            </div>
            <div class="bg-white p-6 rounded-lg border border-gray-200">
              <p class="text-sm text-gray-700 mb-1">Срочных пролонгаций</p>
              <p class="text-2xl font-semibold text-gray-900">{{ data.metrics.urgentRenewals }}</p>
            </div>
            <div class="bg-white p-6 rounded-lg border border-gray-200">
              <p class="text-sm text-gray-700 mb-1">Конверсия</p>
              <p class="text-2xl font-semibold text-gray-900">
                {{ data.metrics.conversionRate | number: '1.0-1' }}%
              </p>
            </div>
          </div>

          <h2 class="text-xl font-semibold text-gray-900 mb-4">Последние полисы</h2>
          <ul class="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
            @for (policy of data.recentPolicies; track policy.id) {
              <li class="p-4 flex justify-between items-center">
                <div>
                  <p class="font-medium text-gray-900">{{ policy.clientName }}</p>
                  <p class="text-sm text-gray-700">
                    {{ policy.number }} · {{ policy.insuranceCompanyName }}
                  </p>
                </div>
                <p class="text-gray-900 font-medium">{{ policy.premium | number: '1.0-0' }} ₽</p>
              </li>
            }
          </ul>
        } @else {
          <p class="text-error-600">Не удалось загрузить данные: {{ response.error?.message }}</p>
        }
      } @else {
        <p class="text-gray-700">Загружаем данные…</p>
      }
    </section>
  `,
  providers: [],
})
export class DashboardPage {
  private readonly service = inject(DashboardService);

  protected readonly dashboard = toSignal<ApiResponse<DashboardData> | undefined>(
    this.service.getDashboard(),
    { initialValue: undefined },
  );
}
