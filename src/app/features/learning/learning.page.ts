import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';

const EDUCATION_URL = 'https://agentacademy.ru/education';

@Component({
  selector: 'app-learning-page',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="edu">
      <iframe
        class="edu__frame"
        [src]="url"
        title="Обучение Agent Academy"
        loading="lazy"
        referrerpolicy="no-referrer"
      ></iframe>
      <p class="edu__fallback">
        Не загрузилось?
        <a href="https://agentacademy.ru/education" target="_blank" rel="noopener noreferrer"
          >Открыть обучение в новой вкладке</a
        >
      </p>
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
        gap: 8px;
        height: calc(100vh - 112px);
      }

      .edu__frame {
        flex: 1;
        width: 100%;
        border: 1px solid var(--gray-200);
        border-radius: var(--radius-lg);
        background: #ffffff;
      }

      .edu__fallback {
        margin: 0;
        text-align: center;
        font-size: var(--text-sm);
        color: var(--gray-500);
      }

      .edu__fallback a {
        color: var(--accent-600);
      }

      @media (max-width: 1023px) {
        .edu {
          height: calc(100vh - 96px);
        }
      }
    `,
  ],
})
export class LearningPage {
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly url: SafeResourceUrl =
    this.sanitizer.bypassSecurityTrustResourceUrl(EDUCATION_URL);
}
