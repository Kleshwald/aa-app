import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  type OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import {
  ChatService,
  type ChatAttachment,
  type ChatMessage,
  type ChatRole,
} from '@core/services/chat.service';

interface DayGroup {
  label: string;
  messages: ChatMessage[];
}

@Component({
  selector: 'app-messages-page',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './messages.page.html',
  styleUrl: './messages.page.scss',
})
export class MessagesPage implements OnInit {
  private readonly chat = inject(ChatService);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly inputEl = viewChild<ElementRef<HTMLTextAreaElement>>('input');

  protected readonly messages = this.chat.messages;
  protected readonly supportTyping = this.chat.supportTyping;
  protected readonly support = this.chat.support;

  protected readonly draft = signal('');
  protected readonly pendingFiles = signal<ChatAttachment[]>([]);

  protected readonly quickReplies = [
    'Не проходит котировка',
    'Подгрузить полис',
    'Вопрос по оплате',
  ];
  protected readonly showQuickReplies = computed(
    () => !this.messages().some((m) => m.author === 'agent'),
  );

  protected readonly canSend = computed(
    () => this.draft().trim().length > 0 || this.pendingFiles().length > 0,
  );

  protected readonly groups = computed<DayGroup[]>(() => {
    const out: DayGroup[] = [];
    for (const m of this.messages()) {
      const label = this.dayLabel(m.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.messages.push(m);
      else out.push({ label, messages: [m] });
    }
    return out;
  });

  constructor() {
    // Keep the conversation scrolled to the latest message.
    effect(() => {
      this.messages();
      this.supportTyping();
      const el = this.scroller()?.nativeElement;
      if (el) setTimeout(() => (el.scrollTop = el.scrollHeight), 0);
    });
    afterNextRender(() => this.inputEl()?.nativeElement.focus());
  }

  ngOnInit(): void {
    this.chat.markRead();
  }

  send(): void {
    if (!this.canSend()) return;
    this.chat.send(this.draft(), this.pendingFiles());
    this.draft.set('');
    this.pendingFiles.set([]);
    const el = this.inputEl()?.nativeElement;
    if (el) el.style.height = 'auto';
  }

  /** Чип-подсказка вставляет текст в поле (не отправляет молча) — агент дочитает и нажмёт сам. */
  quickFill(text: string): void {
    this.draft.set(text);
    const el = this.inputEl()?.nativeElement;
    if (el) {
      el.focus();
      this.autoGrow(el);
    }
  }

  /** Авто-рост textarea по строкам (до 140px), чтобы длинное сообщение было видно. */
  autoGrow(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).map<ChatAttachment>((f) => ({
      name: f.name,
      kind: f.type.startsWith('image/') ? 'image' : 'file',
    }));
    if (files.length) this.pendingFiles.update((list) => [...list, ...files]);
    input.value = '';
  }

  removeFile(name: string): void {
    this.pendingFiles.update((list) => list.filter((f) => f.name !== name));
  }

  initials(name: string | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  roleLabel(role: ChatRole): string {
    return role === 'curator' ? 'Куратор' : 'Поддержка';
  }

  private dayLabel(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
