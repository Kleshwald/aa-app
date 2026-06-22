import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Единая ссылка «← Назад» — шаг назад внутри флоу (тип B: один роут, view-сигнал).
 * Семейство с `app-breadcrumbs`: та же стрелка, цвет, размер, фокус. Верх слева.
 */
@Component({
  selector: 'app-back-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="back" (click)="back.emit()">
      <span class="back__arrow" aria-hidden="true">←</span>
      {{ label() }}
    </button>
  `,
  styles: `
    :host {
      display: block;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      padding: 10px 8px;
      background: transparent;
      border: none;
      font-family: inherit;
      font-size: var(--text-base);
      font-weight: var(--weight-medium);
      color: var(--brand-500);
      cursor: pointer;
      transition: color 120ms ease;
    }
    .back:hover {
      color: var(--brand-600);
      text-decoration: underline;
    }
    .back:focus-visible {
      outline: 2px solid var(--brand-500);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }
    .back__arrow {
      font-size: var(--text-lg);
      line-height: 1;
    }
  `,
})
export class BackLinkComponent {
  readonly label = input<string>('Назад');
  readonly back = output<void>();
}
