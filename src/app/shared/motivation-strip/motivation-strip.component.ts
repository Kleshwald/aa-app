import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { type FinanceResults } from '@core/services/finance.service';

/**
 * Компактная полоса прогресса по системе мотивации на экране котировок.
 * Источник истины — те же «Мои результаты» (FinanceResults), что и в «Моих финансах»,
 * чтобы цифры не расходились. Показывает категорию, сборы за период и «сколько до
 * следующей категории». НЕ показывает КВ% и доход в рублях (правило котировок).
 * `previewPremium` — премия предложения под курсором: полоса «дорастает», показывая,
 * как сделка двигает сборы к следующей категории.
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

  protected readonly basePct = computed(() => this.pct(this.results().collected));
  protected readonly previewCollected = computed(
    () => this.results().collected + Math.max(0, this.previewPremium()),
  );
  protected readonly previewPct = computed(() => this.pct(this.previewCollected()));
  protected readonly previewToNext = computed(() =>
    Math.max(0, this.results().nextThreshold - this.previewCollected()),
  );
  protected readonly hasPreview = computed(
    () => this.previewPremium() > 0 && !!this.results().nextCategory,
  );

  private pct(collected: number): number {
    const threshold = this.results().nextThreshold;
    if (threshold <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((collected / threshold) * 100)));
  }
}
