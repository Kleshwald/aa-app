import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { MotivationService, type MotivationSnapshot } from '@core/services/motivation.service';

/**
 * Компактная полоса прогресса по системе мотивации на экране котировок.
 * Показывает категорию месяца, сборы/прогноз и «сколько до следующей категории».
 * НЕ показывает КВ% и доход в рублях по сделке (залоченное правило котировок).
 * `previewPremium` — премия предложения под курсором: полоса «дорастает», показывая,
 * как сделка двигает прогноз.
 */
@Component({
  selector: 'app-motivation-strip',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './motivation-strip.component.html',
  styleUrl: './motivation-strip.component.scss',
})
export class MotivationStripComponent {
  private readonly motivation = inject(MotivationService);

  readonly snapshot = input.required<MotivationSnapshot>();
  readonly previewPremium = input<number>(0);

  protected readonly base = computed(() => this.motivation.progress(this.snapshot()));
  protected readonly preview = computed(() =>
    this.motivation.progress(this.snapshot(), this.previewPremium()),
  );
  protected readonly hasPreview = computed(
    () => this.previewPremium() > 0 && this.preview().projection > this.base().projection,
  );
}
