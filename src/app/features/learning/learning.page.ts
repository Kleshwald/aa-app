import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';

interface EduProduct {
  id: string;
  title: string;
  description: string;
  url: string;
  image: string;
}

// Source: agentacademy.ru/education (разводящая). Our hub links straight to the detail pages.
// Cover images pulled from each product's detail page (og:image / hero).
const PRODUCTS: EduProduct[] = [
  {
    id: 'ns-dtp',
    title: 'НС при ДТП',
    description: 'Защита водителя и пассажиров при ДТП.',
    url: 'https://kleshwald.github.io/AgentAcademy/ns-pri-dtp/',
    image: 'https://kleshwald.github.io/AgentAcademy/ns-pri-dtp/img/hero.png',
  },
  {
    id: 'health',
    title: 'Здоровье',
    description: 'Линейка продуктов страхования здоровья.',
    url: 'https://agentacademy.ru/health',
    image:
      'https://static.tildacdn.com/tild3035-6264-4463-a461-646239633534/freepik__background_.png',
  },
  {
    id: 'lawyer',
    title: 'Юрист поможет',
    description: 'Юридическая поддержка автовладельца.',
    url: 'https://agentacademy.ru/lawyer',
    image: 'https://static.tildacdn.com/tild3866-3130-4534-a532-326561636464/2.png',
  },
  {
    id: 'minikasko',
    title: 'МиниКАСКО',
    description: 'Защита авто от основных рисков по доступной цене.',
    url: 'https://agentacademy.ru/minikasko',
    image: 'https://static.tildacdn.com/tild6261-6331-4136-b337-313433343265/20945733.jpg',
  },
  {
    id: 'pul-osago',
    title: 'ОСАГО в Перестраховочном Пуле',
    description: 'Оформление ОСАГО через перестраховочный пул.',
    url: 'https://agentacademy.ru/pul_osago',
    image: 'https://static.tildacdn.com/tild3166-3566-4037-a632-623138653936/Group_1565_6.png',
  },
  {
    id: 'accident',
    title: 'Защита от ДТП',
    description: 'Выплаты при ДТП; на части территорий — «Защита при ДТП +».',
    url: 'https://agentacademy.ru/accident_protection',
    image: 'https://static.tildacdn.com/tild3436-3563-4462-a334-336138636262/43055.jpg',
  },
];

@Component({
  selector: 'app-learning-page',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="edu">
      @if (selected(); as product) {
        <div class="edu__bar">
          <button type="button" class="edu__btn" (click)="backToHub()">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            К обучению
          </button>
          <span class="edu__title">{{ product.title }}</span>
          <a
            class="edu__btn edu__btn--ghost"
            [href]="product.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            В новой вкладке
          </a>
        </div>
        <iframe
          class="edu__frame"
          [src]="safeUrl()"
          [title]="product.title"
          loading="lazy"
          referrerpolicy="no-referrer"
        ></iframe>
      } @else {
        <header class="edu__head">
          <h1 class="edu__heading">Обучение</h1>
          <p class="edu__intro">Учебные материалы по продуктам — выберите раздел.</p>
        </header>

        <div class="edu__grid">
          @for (p of products; track p.id) {
            <button type="button" class="edu__card" (click)="open(p)">
              <span class="edu__card-cover">
                <img
                  [src]="p.image"
                  alt=""
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  (error)="$any($event.target).style.display = 'none'"
                />
              </span>
              <span class="edu__card-body">
                <span class="edu__card-title">{{ p.title }}</span>
                <span class="edu__card-desc">{{ p.description }}</span>
              </span>
            </button>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .edu {
        display: flex;
        flex-direction: column;
        gap: 16px;
        height: calc(100vh - 112px);
      }

      /* Hub */

      .edu__head {
        text-align: center;
      }

      .edu__heading {
        margin: 0;
        font-size: var(--text-2xl);
        line-height: var(--leading-2xl);
        font-weight: var(--weight-semibold);
        color: var(--brand-700);
      }

      .edu__intro {
        margin: 4px 0 0;
        font-size: var(--text-base);
        color: var(--gray-600);
      }

      .edu__grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        overflow-y: auto;
        padding-bottom: 4px;
      }

      .edu__card {
        display: flex;
        flex-direction: column;
        padding: 0;
        overflow: hidden;
        text-align: left;
        background: #ffffff;
        border: 1px solid var(--gray-200);
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition:
          border-color 120ms ease-out,
          box-shadow 120ms ease-out;
      }

      .edu__card:hover {
        border-color: var(--accent-300);
        box-shadow: var(--shadow-md);
      }

      .edu__card:focus-visible {
        outline: none;
        border-color: var(--brand-500);
        box-shadow: 0 0 0 3px var(--brand-100);
      }

      .edu__card-cover {
        display: block;
        width: 100%;
        height: 180px;
        background: var(--brand-50);
        overflow: hidden;
      }

      .edu__card-cover img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
      }

      .edu__card-body {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 16px 18px 20px;
        flex: 1;
        min-width: 0;
      }

      .edu__card-title {
        font-size: var(--text-lg);
        font-weight: var(--weight-semibold);
        color: var(--gray-900);
      }

      .edu__card-desc {
        font-size: var(--text-sm);
        line-height: var(--leading-sm);
        color: var(--gray-600);
      }

      /* Detail (iframe) */

      .edu__bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: #ffffff;
        border: 1px solid var(--gray-200);
        border-radius: var(--radius-base);
        flex-shrink: 0;
      }

      .edu__btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 40px;
        padding: 0 14px;
        font-size: var(--text-sm);
        font-family: inherit;
        font-weight: var(--weight-medium);
        color: var(--gray-700);
        background: transparent;
        border: 1px solid var(--gray-300);
        border-radius: var(--radius-base);
        cursor: pointer;
        text-decoration: none;
        transition:
          background 120ms ease-out,
          color 120ms ease-out;
      }

      .edu__btn:hover {
        background: var(--gray-100);
        color: var(--gray-900);
      }

      .edu__btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--brand-100);
      }

      .edu__btn--ghost {
        margin-left: auto;
        border-color: transparent;
        color: var(--accent-600);
      }

      .edu__title {
        margin-left: 4px;
        font-size: var(--text-base);
        font-weight: var(--weight-semibold);
        color: var(--brand-700);
      }

      .edu__frame {
        flex: 1;
        width: 100%;
        border: 1px solid var(--gray-200);
        border-radius: var(--radius-lg);
        background: #ffffff;
      }

      @media (max-width: 1279px) {
        .edu__grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 1023px) {
        .edu {
          height: calc(100vh - 96px);
        }
        .edu__grid {
          grid-template-columns: 1fr;
        }
        .edu__title {
          display: none;
        }
      }
    `,
  ],
})
export class LearningPage {
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly products = PRODUCTS;
  protected readonly selected = signal<EduProduct | null>(null);

  protected readonly safeUrl = computed<SafeResourceUrl | null>(() => {
    const p = this.selected();
    return p ? this.sanitizer.bypassSecurityTrustResourceUrl(p.url) : null;
  });

  open(product: EduProduct): void {
    this.selected.set(product);
  }

  backToHub(): void {
    this.selected.set(null);
  }
}
