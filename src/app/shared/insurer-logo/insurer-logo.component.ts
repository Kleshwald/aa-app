import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * Square insurer logo with a graceful monogram fallback.
 * Looks for /images/insurers/{id}.png; if missing/broken, shows a brand-tinted
 * monogram (first letter of the name). Shared by ОСАГО and «Здоровье» quote screens.
 */
@Component({
  selector: 'app-insurer-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (failed()) {
      <span class="ins-logo ins-logo--fallback" aria-hidden="true">{{ letter() }}</span>
    } @else {
      <span class="ins-logo">
        <img [src]="src()" [alt]="name()" loading="lazy" (error)="failed.set(true)" />
      </span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex-shrink: 0;
      }

      .ins-logo {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        padding: 6px;
        background: #ffffff;
        border: 1px solid var(--gray-200);
        border-radius: var(--radius-md);
        box-sizing: border-box;
        overflow: hidden;
      }

      .ins-logo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .ins-logo--fallback {
        padding: 0;
        background: var(--brand-50);
        color: var(--header-bg);
        font-size: var(--text-lg);
        font-weight: var(--weight-semibold);
      }
    `,
  ],
})
export class InsurerLogoComponent {
  readonly id = input.required<string>();
  readonly name = input.required<string>();

  protected readonly failed = signal(false);

  protected readonly src = computed(() => `/images/insurers/${this.id()}.png`);
  protected readonly letter = computed(() => (this.name().trim()[0] ?? '?').toUpperCase());
}
