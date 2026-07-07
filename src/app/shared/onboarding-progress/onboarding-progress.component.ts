import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Один шаг онбординга агента. Состояние показываем НЕ только цветом (иконка+подпись). */
export interface OnboardingStep {
  label: string;
  sub?: string;
  state: 'done' | 'current' | 'locked';
}

/**
 * Индикатор прогресса онбординга агента (общий, DESIGN.md §5 «не только цветом»).
 * Горизонтальный степпер на десктопе → вертикальный список на узком/мобильном.
 * Каждый шаг = маркер (галочка / точка / замок) + подпись + под-текст.
 */
@Component({
  selector: 'app-onboarding-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="ob" role="list">
      @for (s of steps(); track s.label; let last = $last) {
        <li class="ob__step" [attr.data-state]="s.state">
          @if (!last) {
            <span class="ob__bar" aria-hidden="true"></span>
          }
          <span class="ob__marker" aria-hidden="true">
            @switch (s.state) {
              @case ('done') {
                <svg class="ob__ico" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              }
              @case ('current') {
                <span class="ob__pulse"></span>
              }
              @default {
                <svg class="ob__ico" viewBox="0 0 24 24">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              }
            }
          </span>
          <span class="ob__text">
            <span class="ob__label">{{ s.label }}</span>
            @if (s.sub) {
              <span class="ob__sub">{{ s.sub }}</span>
            }
          </span>
        </li>
      }
    </ol>
  `,
  styles: `
    :host {
      display: block;
    }
    .ob {
      display: flex;
      align-items: flex-start;
      gap: 0;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .ob__step {
      position: relative;
      flex: 1 1 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 8px;
      min-width: 0;
    }
    // Соединитель к следующему шагу — от центра этого маркера вправо.
    .ob__bar {
      position: absolute;
      top: 17px;
      left: 50%;
      width: 100%;
      height: 3px;
      background: var(--gray-200);
      border-radius: var(--radius-full);
    }
    .ob__step[data-state='done'] .ob__bar {
      background: var(--success-500);
    }
    .ob__marker {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-full);
      background: var(--gray-100);
      color: var(--gray-500);
      border: 2px solid var(--gray-200);
    }
    .ob__step[data-state='done'] .ob__marker {
      background: var(--success-50);
      color: var(--success-700);
      border-color: var(--success-500);
    }
    .ob__step[data-state='current'] .ob__marker {
      background: var(--brand-50);
      color: var(--brand-600);
      border-color: var(--brand-500);
    }
    .ob__ico {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .ob__pulse {
      width: 12px;
      height: 12px;
      border-radius: var(--radius-full);
      background: var(--brand-500);
    }
    .ob__text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .ob__label {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      color: var(--gray-900);
    }
    .ob__step[data-state='locked'] .ob__label {
      color: var(--gray-600);
    }
    .ob__sub {
      font-size: var(--text-xs);
      color: var(--gray-600);
    }

    // Узкий/мобильный — вертикальный список (соединители убираем, порядок и
    // маркеры несут последовательность; так честнее и читабельнее для 45+).
    @media (max-width: 640px) {
      .ob {
        flex-direction: column;
        align-items: stretch;
        gap: 14px;
      }
      .ob__step {
        flex-direction: row;
        align-items: center;
        text-align: left;
        gap: 12px;
      }
      .ob__bar {
        display: none;
      }
      .ob__text {
        align-items: flex-start;
      }
    }
  `,
})
export class OnboardingProgressComponent {
  readonly steps = input.required<OnboardingStep[]>();
}
