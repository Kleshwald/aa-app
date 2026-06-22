import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { InsurerLogoComponent } from '@shared/insurer-logo/insurer-logo.component';

/** One status line of the calculation loader; carrier steps carry a logo. */
export interface CalcStep {
  text: string;
  carrierId?: string;
}

/**
 * Shared «расчёт» wait screen — минимализм: центрированная сменяющаяся надпись
 * с крупным лого СК на их шагах, мягкий fade-up, бегущая линия загрузки и тихий
 * выход. Финал — фраза «Готово». Presentational: родитель ведёт `step`/`complete`.
 * Используется ОСАГО и «Здоровьем».
 */
@Component({
  selector: 'app-calc-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InsurerLogoComponent],
  templateUrl: './calc-loader.component.html',
  styleUrl: './calc-loader.component.scss',
})
export class CalcLoaderComponent {
  readonly step = input<CalcStep | null>(null);
  readonly complete = input<boolean>(false);
  readonly cancelled = output<void>();
}
