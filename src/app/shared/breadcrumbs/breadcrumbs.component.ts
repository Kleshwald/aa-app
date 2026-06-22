import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Единые хлебные крошки «← Родитель / Текущая» — навигация между роутами (тип A).
 * Семейство с `app-back-link`: та же стрелка, цвет, размер, фокус. Верх слева.
 */
@Component({
  selector: 'app-breadcrumbs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <nav class="crumbs" aria-label="Навигация по разделам">
      <a [routerLink]="parentLink()" class="crumbs__link">
        <span class="crumbs__arrow" aria-hidden="true">←</span>
        {{ parentLabel() }}
      </a>
      @if (current()) {
        <span class="crumbs__sep" aria-hidden="true">/</span>
        <span class="crumbs__current">{{ current() }}</span>
      }
    </nav>
  `,
  styles: `
    :host {
      display: block;
    }
    .crumbs {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      font-size: var(--text-base);
    }
    .crumbs__link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      color: var(--brand-500);
      font-weight: var(--weight-medium);
      text-decoration: none;
    }
    .crumbs__link:hover {
      color: var(--brand-600);
      text-decoration: underline;
    }
    .crumbs__link:focus-visible {
      outline: 2px solid var(--brand-500);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }
    .crumbs__arrow {
      font-size: var(--text-lg);
      line-height: 1;
    }
    .crumbs__sep {
      color: var(--gray-400);
    }
    .crumbs__current {
      color: var(--gray-700);
    }
  `,
})
export class BreadcrumbsComponent {
  readonly parentLabel = input.required<string>();
  readonly parentLink = input.required<string>();
  readonly current = input<string>('');
}
