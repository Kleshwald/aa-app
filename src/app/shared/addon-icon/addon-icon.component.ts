import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Thin line-icon for an ОСАГО add-on service. Stroke-based (currentColor) so the
 * parent controls size and colour. Matches the chevron's light aesthetic.
 *   mini-kasko → car · ns-dtp → heart · legal → scales · off/default → plus
 */
@Component({
  selector: 'app-addon-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (id()) {
      @case ('mini-kasko') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"
          />
          <circle cx="7" cy="17" r="2" />
          <path d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      }
      @case ('ns-dtp') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
          />
        </svg>
      }
      @case ('legal') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      }
      @default {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      }
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      svg {
        width: 20px;
        height: 20px;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    `,
  ],
})
export class AddonIconComponent {
  readonly id = input.required<string>();
}
