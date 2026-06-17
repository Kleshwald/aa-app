import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { feedbackConfigured } from './feedback.config';
import { type FeedbackPost, FeedbackService } from './feedback.service';

interface Category {
  id: string;
  label: string;
}

const CATEGORIES: Category[] = [
  { id: 'idea', label: 'Идея' },
  { id: 'question', label: 'Вопрос' },
  { id: 'problem', label: 'Проблема' },
  { id: 'other', label: 'Другое' },
];

const NAME_KEY = 'aa_feedback_name';
const MAX_IMAGE_MB = 8;

@Component({
  selector: 'app-feedback-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feedback.page.html',
  styleUrl: './feedback.page.scss',
})
export class FeedbackPage {
  private readonly svc = inject(FeedbackService);

  protected readonly categories = CATEGORIES;
  protected readonly configured = feedbackConfigured();

  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly posts = signal<FeedbackPost[]>([]);

  protected readonly author = signal(localStorage.getItem(NAME_KEY) ?? '');
  protected readonly category = signal('idea');
  protected readonly message = signal('');
  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreview = signal<string | null>(null);

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly canSubmit = computed(
    () => this.author().trim().length > 0 && this.message().trim().length > 0 && !this.submitting(),
  );

  // Фильтр ленты по типу (read-only, форму публикации не трогает).
  protected readonly activeFilter = signal<string>('all');

  protected readonly filters = computed(() => {
    const list = this.posts();
    return [
      { id: 'all', label: 'Все', count: list.length },
      ...CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        count: list.filter((p) => p.category === c.id).length,
      })),
    ];
  });

  protected readonly visiblePosts = computed(() => {
    const f = this.activeFilter();
    const list = this.posts();
    return f === 'all' ? list : list.filter((p) => p.category === f);
  });

  constructor() {
    if (this.configured) {
      void this.load();
    } else {
      this.status.set('ready');
    }
  }

  private async load(): Promise<void> {
    this.status.set('loading');
    try {
      this.posts.set(await this.svc.list());
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  protected retry(): void {
    void this.load();
  }

  protected setAuthor(value: string): void {
    this.author.set(value);
  }

  protected setMessage(value: string): void {
    this.message.set(value);
  }

  protected pickCategory(id: string): void {
    this.category.set(id);
  }

  protected setFilter(id: string): void {
    this.activeFilter.set(id);
  }

  protected onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.attach(file);
  }

  protected onPaste(event: ClipboardEvent): void {
    const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
      i.type.startsWith('image/'),
    );
    const file = item?.getAsFile() ?? null;
    if (file) {
      event.preventDefault();
      this.attach(file);
    }
  }

  private attach(file: File | null): void {
    this.formError.set(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.formError.set('Можно прикрепить только изображение.');
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      this.formError.set(`Файл больше ${MAX_IMAGE_MB} МБ — выберите скриншот поменьше.`);
      return;
    }
    const prev = this.imagePreview();
    if (prev) URL.revokeObjectURL(prev);
    this.imageFile.set(file);
    this.imagePreview.set(URL.createObjectURL(file));
  }

  protected removeImage(): void {
    const prev = this.imagePreview();
    if (prev) URL.revokeObjectURL(prev);
    this.imageFile.set(null);
    this.imagePreview.set(null);
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.formError.set(null);
    try {
      const post = await this.svc.create({
        author: this.author(),
        category: this.category(),
        message: this.message(),
        image: this.imageFile(),
      });
      localStorage.setItem(NAME_KEY, this.author().trim());
      this.posts.update((list) => [post, ...list]);
      this.message.set('');
      this.removeImage();
    } catch {
      this.formError.set('Не удалось отправить. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected categoryLabel(id: string): string {
    return CATEGORIES.find((c) => c.id === id)?.label ?? 'Другое';
  }

  protected initials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected timeAgo(iso: string): string {
    const then = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - then);
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min} мин назад`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн назад`;
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
