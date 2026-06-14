import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { InsurerLogoComponent } from '@shared/insurer-logo/insurer-logo.component';

/** One status line of the calculation loader; carrier steps carry a logo. */
export interface CalcStep {
  text: string;
  carrierId?: string;
}

/**
 * Shared «расчёт» wait screen: eyebrow + large cycling phrase (with insurer logo
 * for carrier steps) + running line + hint + cancel, and a positive «Готово»
 * glow finish. Presentational — the parent drives `step`/`complete` over time.
 * Used by ОСАГО and «Здоровье».
 */
@Component({
  selector: 'app-calc-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InsurerLogoComponent],
  templateUrl: './calc-loader.component.html',
  styleUrl: './calc-loader.component.scss',
})
export class CalcLoaderComponent {
  readonly eyebrow = input.required<string>();
  readonly step = input<CalcStep | null>(null);
  readonly complete = input<boolean>(false);
  readonly hint = input<string>('');
  readonly cancelled = output<void>();
}
