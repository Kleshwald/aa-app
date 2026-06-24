import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { BackLinkComponent } from '@shared/back-link/back-link.component';
import { InsurerLogoComponent } from '@shared/insurer-logo/insurer-logo.component';

/** One status line of the calculation loader; carrier steps carry a logo. */
export interface CalcStep {
  text: string;
  carrierId?: string;
}

/**
 * Shared «расчёт» wait screen — минимализм: центрированная сменяющаяся надпись
 * с крупным лого СК, бегущая линия загрузки и тихий выход внизу. Завершение —
 * без текста и галочки: линия заполняется до 100% и зеленеет, затем родитель
 * переключает экран на котировки. Presentational. ОСАГО и «Здоровье».
 */
@Component({
  selector: 'app-calc-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InsurerLogoComponent, BackLinkComponent],
  templateUrl: './calc-loader.component.html',
  styleUrl: './calc-loader.component.scss',
})
export class CalcLoaderComponent {
  readonly step = input<CalcStep | null>(null);
  readonly complete = input<boolean>(false);
  readonly cancelled = output<void>();
}
