import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { feedbackConfigured } from './feedback.config';
import { type FeedbackPost, FeedbackService } from './feedback.service';

interface Option {
  id: string;
  label: string;
}

const SECTIONS: Option[] = [
  { id: 'client', label: 'Клиентский путь, дизайн' },
  { id: 'arch', label: 'Архитектура, тех. вопросы' },
  { id: 'product', label: 'Продукт, роадмэп, бэклог' },
];

// Рубрикатор страниц — только для раздела «Клиентский путь».
const PAGES: Option[] = [
  { id: 'osago', label: 'ОСАГО' },
  { id: 'health', label: 'Здоровье' },
  { id: 'clients', label: 'Мои клиенты' },
  { id: 'prolongation', label: 'Пролонгация' },
  { id: 'mortgage', label: 'Ипотека' },
  { id: 'finance', label: 'Мои финансы' },
  { id: 'learning', label: 'Обучение' },
  { id: 'messages', label: 'Сообщения' },
  { id: 'login', label: 'Вход / регистрация' },
  { id: 'hub', label: 'Панель / доска' },
  { id: 'other', label: 'Общее / другое' },
];

const CATEGORIES: Option[] = [
  { id: 'idea', label: 'Идея' },
  { id: 'question', label: 'Вопрос' },
  { id: 'problem', label: 'Проблема' },
  { id: 'other', label: 'Другое' },
];

// Общий ключ имени с гейтом панели (/hub-unlock сохраняет сюда же).
const NAME_KEY = 'aa_user_name';
const LIKES_KEY = 'aa_feedback_likes';
const MOD_KEY = 'aa_feedback_mod';
const MAX_IMAGE_MB = 8;

@Component({
  selector: 'app-feedback-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feedback.page.html',
  styleUrl: './feedback.page.scss',
})
export class FeedbackPage {
  private readonly svc = inject(FeedbackService);

  protected readonly sections = SECTIONS;
  protected readonly pages = PAGES;
  protected readonly categories = CATEGORIES;
  protected readonly configured = feedbackConfigured();

  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly posts = signal<FeedbackPost[]>([]);

  // Навигация
  protected readonly activeSection = signal('client');
  protected readonly pageFilter = signal('all');

  // Форма нового поста
  protected readonly author = signal(localStorage.getItem(NAME_KEY) ?? '');
  protected readonly category = signal('idea');
  protected readonly newPage = signal('other');
  protected readonly message = signal('');
  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreview = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  // Ответы
  protected readonly openReplyId = signal<string | null>(null);
  protected readonly replyText = signal('');

  // Лайки (какие строки лайкнул этот браузер)
  protected readonly likedIds = signal<Set<string>>(this.readLiked());

  // Модерация: пароль (сервер сверяет, в бандле его нет) хранится на сессию.
  protected readonly modPass = signal(sessionStorage.getItem(MOD_KEY) ?? '');
  protected readonly modInput = signal('');
  protected readonly modOpen = signal(false);
  protected readonly pendingDeleteId = signal<string | null>(null);
  protected readonly isModerator = computed(() => this.modPass().length > 0);

  protected readonly canSubmit = computed(
    () => this.author().trim().length > 0 && this.message().trim().length > 0 && !this.submitting(),
  );

  protected readonly sectionCounts = computed(() => {
    const m: Record<string, number> = { client: 0, arch: 0, product: 0 };
    for (const p of this.posts()) if (!p.parent_id) m[p.section] = (m[p.section] ?? 0) + 1;
    return m;
  });

  /** Чипы рубрикатора страниц (только client, только страницы с записями). */
  protected readonly pageChips = computed(() => {
    if (this.activeSection() !== 'client') return [];
    const counts = new Map<string, number>();
    for (const p of this.posts()) {
      if (p.parent_id || p.section !== 'client') continue;
      const key = p.page ?? 'other';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const chips: { id: string; label: string; count: number }[] = [
      { id: 'all', label: 'Все страницы', count: total },
    ];
    for (const pg of PAGES) {
      const c = counts.get(pg.id) ?? 0;
      if (c > 0) chips.push({ id: pg.id, label: pg.label, count: c });
    }
    return chips;
  });

  protected readonly visiblePosts = computed(() => {
    const s = this.activeSection();
    const pf = this.pageFilter();
    return this.posts()
      .filter(
        (p) =>
          !p.parent_id &&
          p.section === s &&
          (s !== 'client' || pf === 'all' || (p.page ?? 'other') === pf),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  });

  protected readonly repliesByParent = computed(() => {
    const map = new Map<string, FeedbackPost[]>();
    for (const p of this.posts()) {
      if (!p.parent_id) continue;
      const arr = map.get(p.parent_id) ?? [];
      arr.push(p);
      map.set(p.parent_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return map;
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

  // ─── Навигация ───
  protected pickSection(id: string): void {
    this.activeSection.set(id);
    this.pageFilter.set('all');
  }

  protected setPageFilter(id: string): void {
    this.pageFilter.set(id);
  }

  protected sectionLabel(id: string): string {
    return SECTIONS.find((s) => s.id === id)?.label ?? id;
  }

  // ─── Форма ───
  protected setAuthor(value: string): void {
    this.author.set(value);
  }

  protected setMessage(value: string): void {
    this.message.set(value);
  }

  protected pickCategory(id: string): void {
    this.category.set(id);
  }

  protected setNewPage(value: string): void {
    this.newPage.set(value);
  }

  protected onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.attach(input.files?.[0] ?? null);
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
    const section = this.activeSection();
    try {
      const post = await this.svc.create({
        author: this.author(),
        section,
        category: this.category(),
        message: this.message(),
        page: section === 'client' ? this.newPage() : null,
        image: this.imageFile(),
      });
      localStorage.setItem(NAME_KEY, this.author().trim());
      this.posts.update((list) => [...list, post]);
      this.message.set('');
      this.removeImage();
    } catch {
      this.formError.set('Не удалось отправить. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      this.submitting.set(false);
    }
  }

  // ─── Ответы ───
  protected toggleReply(postId: string): void {
    this.openReplyId.set(this.openReplyId() === postId ? null : postId);
    this.replyText.set('');
    this.formError.set(null);
  }

  protected setReplyText(value: string): void {
    this.replyText.set(value);
  }

  protected async submitReply(post: FeedbackPost): Promise<void> {
    const text = this.replyText().trim();
    const name = this.author().trim();
    if (!text || !name || this.submitting()) return;
    this.submitting.set(true);
    try {
      const reply = await this.svc.create({
        author: name,
        section: post.section,
        category: 'other',
        message: text,
        page: post.page,
        parentId: post.id,
      });
      localStorage.setItem(NAME_KEY, name);
      this.posts.update((list) => [...list, reply]);
      this.replyText.set('');
      this.openReplyId.set(null);
    } catch {
      this.formError.set('Не удалось отправить ответ.');
    } finally {
      this.submitting.set(false);
    }
  }

  // ─── Лайки ───
  protected isLiked(id: string): boolean {
    return this.likedIds().has(id);
  }

  protected async toggleLike(row: FeedbackPost): Promise<void> {
    const liked = this.likedIds().has(row.id);
    const delta = liked ? -1 : 1;
    // оптимистично
    this.patchPost(row.id, { likes: Math.max(0, row.likes + delta) });
    this.setLiked(row.id, !liked);
    try {
      const next = await this.svc.like(row.id, delta);
      this.patchPost(row.id, { likes: next });
    } catch {
      // откат
      this.patchPost(row.id, { likes: row.likes });
      this.setLiked(row.id, liked);
    }
  }

  private patchPost(id: string, patch: Partial<FeedbackPost>): void {
    this.posts.update((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  private setLiked(id: string, liked: boolean): void {
    const next = new Set(this.likedIds());
    if (liked) next.add(id);
    else next.delete(id);
    this.likedIds.set(next);
    localStorage.setItem(LIKES_KEY, JSON.stringify([...next]));
  }

  private readLiked(): Set<string> {
    try {
      const raw = localStorage.getItem(LIKES_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  }

  // ─── Модерация ───
  protected toggleModPanel(): void {
    this.modOpen.update((v) => !v);
    this.modInput.set('');
  }

  protected setModInput(value: string): void {
    this.modInput.set(value);
  }

  protected enableModeration(): void {
    const pass = this.modInput().trim();
    if (!pass) return;
    sessionStorage.setItem(MOD_KEY, pass);
    this.modPass.set(pass);
    this.modOpen.set(false);
    this.modInput.set('');
  }

  protected disableModeration(): void {
    sessionStorage.removeItem(MOD_KEY);
    this.modPass.set('');
    this.pendingDeleteId.set(null);
  }

  protected askDelete(id: string): void {
    this.pendingDeleteId.set(id);
  }

  protected cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  protected async confirmDelete(row: FeedbackPost): Promise<void> {
    this.pendingDeleteId.set(null);
    try {
      const ok = await this.svc.remove(row.id, this.modPass());
      if (ok) {
        // убираем сам пост и его ответы
        this.posts.update((list) => list.filter((p) => p.id !== row.id && p.parent_id !== row.id));
      } else {
        this.formError.set('Неверный пароль модерации.');
        this.disableModeration();
      }
    } catch {
      this.formError.set('Не удалось удалить. Попробуйте ещё раз.');
    }
  }

  // ─── Хелперы отображения ───
  protected categoryLabel(id: string): string {
    return CATEGORIES.find((c) => c.id === id)?.label ?? 'Другое';
  }

  protected pageLabel(id: string | null): string {
    if (!id) return '';
    return PAGES.find((p) => p.id === id)?.label ?? id;
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
