import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { type FinanceResults } from '@core/services/finance.service';

/**
 * Компактная полоса мотивации на экране котировок. Источник истины — те же
 * «Мои результаты» (FinanceResults), что и в «Моих финансах», чтобы цифры не
 * расходились. Показывает категорию и прогноз сборов на месяц; при наведении на
 * предложение прогноз растёт на премию сделки. КВ% и доход в рублях не показываем.
 */
@Component({
  selector: 'app-motivation-strip',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './motivation-strip.component.html',
  styleUrl: './motivation-strip.component.scss',
})
export class MotivationStripComponent {
  readonly results = input.required<FinanceResults>();
  readonly previewPremium = input<number>(0);

  protected readonly projection = computed(() => this.project(this.results().collected));
  protected readonly previewProjection = computed(() =>
    this.project(this.results().collected + Math.max(0, this.previewPremium())),
  );
  protected readonly hasPreview = computed(() => this.previewPremium() > 0);
  protected readonly monthPct = computed(() => {
    const r = this.results();
    return r.daysInMonth > 0 ? Math.min(100, Math.round((r.daysPassed / r.daysInMonth) * 100)) : 0;
  });

  private project(collected: number): number {
    const r = this.results();
    return r.daysPassed > 0 ? Math.round((collected / r.daysPassed) * r.daysInMonth) : collected;
  }
}
