import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';

import { CHANGE_REASONS } from '@core/services/process.service';

/**
 * Модалка «Укажите причину, по которой необходимо внести изменения в договор».
 * Мульти-выбор причин (как в 1С) → передаёт коды выбранных причин наверх.
 */
@Component({
  selector: 'app-change-reason-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cancelled.emit()' },
  template: `
    <button
      type="button"
      class="crd-backdrop"
      aria-label="Закрыть"
      (click)="cancelled.emit()"
    ></button>
    <div class="crd" role="dialog" aria-modal="true" aria-labelledby="crd-title">
      <h2 class="crd__title" id="crd-title">
        Укажите причину, по которой необходимо внести изменения в договор
      </h2>

      <ul class="crd__list">
        @for (r of reasons; track r.code) {
          <li>
            <label class="crd__item">
              <input
                type="checkbox"
                class="crd__check"
                [checked]="isSelected(r.code)"
                (change)="toggle(r.code)"
              />
              <span class="crd__label">{{ r.label }}</span>
            </label>
          </li>
        }
      </ul>

      <footer class="crd__foot">
        <button type="button" class="crd__btn crd__btn--ghost" (click)="cancelled.emit()">
          Назад
        </button>
        <button
          type="button"
          class="crd__btn crd__btn--primary"
          [disabled]="!canProceed()"
          (click)="proceed()"
        >
          Далее
        </button>
      </footer>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .crd-backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
      padding: 0;
      border: none;
      background: rgba(15, 23, 42, 0.45);
      cursor: pointer;
    }
    .crd {
      position: fixed;
      z-index: 41;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: min(640px, calc(100vw - 32px));
      max-height: calc(100vh - 64px);
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border-radius: var(--radius-lg);
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
    }
    .crd__title {
      margin: 0;
      padding: 24px 28px 16px;
      font-size: var(--text-lg);
      font-weight: var(--weight-semibold);
      color: var(--brand-700);
    }
    .crd__list {
      margin: 0;
      padding: 0 12px;
      list-style: none;
      overflow-y: auto;
    }
    .crd__item {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 48px;
      padding: 6px 16px;
      border-radius: var(--radius-base);
      cursor: pointer;
    }
    .crd__item:hover {
      background: var(--gray-50);
    }
    .crd__check {
      flex: 0 0 auto;
      width: 22px;
      height: 22px;
      accent-color: var(--brand-500);
      cursor: pointer;
    }
    .crd__label {
      font-size: var(--text-base);
      color: var(--gray-900);
    }
    .crd__foot {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 28px 24px;
      border-top: 1px solid var(--gray-100);
    }
    .crd__btn {
      min-height: 48px;
      padding: 0 28px;
      font-family: inherit;
      font-size: var(--text-base);
      font-weight: var(--weight-medium);
      border-radius: var(--radius-base);
      cursor: pointer;
      transition:
        background 120ms ease-out,
        border-color 120ms ease-out;
    }
    .crd__btn:focus-visible {
      outline: 2px solid var(--brand-500);
      outline-offset: 2px;
    }
    .crd__btn--ghost {
      color: var(--brand-600);
      background: #ffffff;
      border: 1.5px solid var(--gray-300);
    }
    .crd__btn--ghost:hover {
      border-color: var(--brand-400);
    }
    .crd__btn--primary {
      color: #ffffff;
      background: var(--brand-500);
      border: 1.5px solid var(--brand-500);
    }
    .crd__btn--primary:hover:not(:disabled) {
      background: var(--brand-600);
      border-color: var(--brand-600);
    }
    .crd__btn--primary:disabled {
      background: var(--gray-300);
      border-color: var(--gray-300);
      cursor: not-allowed;
    }
  `,
})
export class ChangeReasonDialogComponent {
  readonly cancelled = output<void>();
  readonly next = output<string[]>();

  protected readonly reasons = CHANGE_REASONS;
  private readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly canProceed = computed(() => this.selected().size > 0);

  isSelected(code: string): boolean {
    return this.selected().has(code);
  }

  toggle(code: string): void {
    const next = new Set(this.selected());
    if (next.has(code)) next.delete(code);
    else next.add(code);
    this.selected.set(next);
  }

  proceed(): void {
    if (this.canProceed()) this.next.emit([...this.selected()]);
  }
}
