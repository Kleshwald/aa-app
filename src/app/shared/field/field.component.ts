import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Единое поле формы (DESIGN.md §1, §3).
 *
 * - Подпись ВСЕГДА сверху и постоянна (не floating, не placeholder).
 * - Контрол проецируется через <ng-content> (Taiga `tui-textfield`); подпись —
 *   `<label>`, оборачивающий контрол, поэтому связь label↔input неявная (для
 *   аудитории 45+ и скринридеров) без ручных id.
 * - Под полем — СТАБИЛЬНЫЙ слот под подсказку/ошибку: высота зарезервирована
 *   всегда, поэтому layout не «прыгает» при появлении ошибки.
 * - Ошибка показывается текстом + иконкой + цветом (никогда только рамкой).
 *
 * Ширина в ряду задаётся через `width`: '' (по умолчанию, тянется), 'narrow'
 * (узкое — дата, серия), 'grow' (широкое — VIN, адрес).
 */
@Component({
  selector: 'app-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="field__top">
      <span class="field__label">{{ label() }}</span>
      <ng-content />
    </label>
    <span class="field__msg" [class.field__msg--error]="!!error()">
      @if (error()) {
        <svg
          class="field__msg-ico"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {{ error() }}
      } @else if (hint()) {
        {{ hint() }}
      }
    </span>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1 1 240px;
      min-width: 190px;
    }
    :host(.field--narrow) {
      flex: 0 0 190px;
      min-width: 0;
    }
    :host(.field--small) {
      flex: 1 1 150px;
      min-width: 140px;
    }
    :host(.field--grow) {
      flex: 2 1 340px;
    }
    :host(.field--wide) {
      flex: 5 1 520px;
    }
    .field__top {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0;
    }
    .field__label {
      font-size: var(--text-sm);
      line-height: 1.3;
      font-weight: var(--weight-medium);
      color: var(--gray-700);
    }
    .field__msg {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 18px;
      font-size: var(--text-xs);
      line-height: 1.25;
      color: var(--gray-600);
    }
    .field__msg--error {
      color: var(--error-600);
    }
    .field__msg-ico {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }
  `,
  host: {
    '[class.field--narrow]': "width() === 'narrow'",
    '[class.field--grow]': "width() === 'grow'",
    '[class.field--wide]': "width() === 'wide'",
  },
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly error = input('');
  readonly width = input<'narrow' | 'small' | 'grow' | 'wide' | ''>('');
}
