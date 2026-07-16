import { DatePipe, NgTemplateOutlet } from '@angular/common';
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
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, merge, of, switchMap, timer } from 'rxjs';

import {
  ChatService,
  type ChatAttachment,
  type ChatMessage,
  type ChatRole,
} from '@core/services/chat.service';
import {
  PROCESS_KIND_LABEL,
  PROCESS_STATUS_LABEL,
  ProcessService,
  processStatusLabel,
  type ActiveProcess,
  type PolicyProcess,
  type ProcessActor,
  type ProcessKind,
  type ProcessStatus,
} from '@core/services/process.service';
import { UxVariantService } from '@core/services/ux-variant.service';

interface DayGroup {
  label: string;
  messages: ChatMessage[];
}

/** Одна реплика в ленте заявки (V3): комментарий или значимое статус-событие. */
interface ThreadEntry {
  key: string;
  at: string;
  author: ProcessActor;
  authorName: string;
  text: string;
}

const SUPPORT_LABEL = 'Поддержка Agent Academy';

type MsgTab = 'dialogs' | 'processes';

@Component({
  selector: 'app-messages-page',
  imports: [DatePipe, NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './messages.page.html',
  styleUrl: './messages.page.scss',
})
export class MessagesPage implements OnInit {
  private readonly chat = inject(ChatService);
  private readonly processService = inject(ProcessService);
  private readonly route = inject(ActivatedRoute);
  private readonly ux = inject(UxVariantService);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly threadScroller = viewChild<ElementRef<HTMLElement>>('threadScroller');
  private readonly inputEl = viewChild<ElementRef<HTMLTextAreaElement>>('input');

  protected readonly messages = this.chat.messages;
  protected readonly supportTyping = this.chat.supportTyping;
  protected readonly support = this.chat.support;
  protected readonly curator = this.chat.curator;

  // ─── Хаб «Сообщения» = Диалоги + Процессы (владелец 2026-07-15, вариант B) ───
  // «Процессы» — СПИСОК-УКАЗАТЕЛЬ: клик ведёт на страницу договора, где живёт
  // единственный дом переписки заявки (вторая дверь, не копия — лок process_visibility).
  protected readonly tab = signal<MsgTab>('dialogs');
  protected readonly dialogsUnread = this.chat.unread;

  private readonly activeResponse = toSignal(
    timer(0, 5000).pipe(switchMap(() => this.processService.listActive())),
    { initialValue: undefined },
  );
  protected readonly activeProcesses = computed<ActiveProcess[]>(() => {
    const r = this.activeResponse();
    return r?.success ? (r.data ?? []) : [];
  });
  /** Заявки, где мяч у агента — тот же счётчик, что «Ждут ваших действий» в шапке. */
  protected readonly awaitingCount = computed(
    () => this.activeProcesses().filter((p) => p.awaiting).length,
  );

  protected setTab(t: MsgTab): void {
    this.tab.set(t);
  }

  protected kindLabel(kind: ProcessKind): string {
    return PROCESS_KIND_LABEL[kind];
  }

  protected stateLabel(status: ProcessStatus): string {
    return PROCESS_STATUS_LABEL[status];
  }

  // ─── Активный UX-вариант (переключатель с /hub) ───
  protected readonly variant = this.ux.variant;

  // ═══ V3 «Переписка в Сообщениях»: единый список бесед + тред заявки ═══
  // Отдельный чат на клиента: чат поддержки + по беседе на активную заявку. Клик по
  // заявке открывает её переписку ПРЯМО здесь (не уводя на договор) — это и есть
  // «синхронизация в Сообщения», которую владелец хочет сравнить с v1/v2.
  protected readonly v3View = signal<'list' | 'support' | 'process'>('list');
  protected readonly v3Process = signal<ActiveProcess | null>(null);

  /** Беседы-заявки: ждущие агента — сверху (туда и ведёт сигнал из шапки). */
  protected readonly processConvos = computed<ActiveProcess[]>(() =>
    [...this.activeProcesses()].sort(
      (a, b) => Number(b.awaiting) - Number(a.awaiting) || b.since.localeCompare(a.since),
    ),
  );

  /** Снимок последней реплики чата — подпись под беседой поддержки в списке. */
  protected readonly lastChatText = computed(() => {
    const list = this.messages();
    const last = list[list.length - 1];
    if (!last) return 'Напишите в поддержку или куратору';
    return last.text || 'Вложение';
  });

  openSupportConvo(): void {
    this.v3View.set('support');
    this.chat.markRead();
  }
  openProcessConvo(p: ActiveProcess): void {
    this.v3Process.set(p);
    this.v3View.set('process');
    this.threadDraft.set('');
    this.threadSendFailed.set(false);
  }
  backToConvos(): void {
    this.v3View.set('list');
    this.v3Process.set(null);
  }

  // Тред открытой заявки: тянем заявки полиса, находим нужную. Poll + ручной толчок
  // после отправки (иначе своя реплика видна лишь через тик). Мок процессов всегда успешен.
  private readonly threadReload$ = new Subject<void>();
  private readonly threadResponse = toSignal(
    toObservable(this.v3Process).pipe(
      switchMap((p) =>
        p
          ? merge(timer(0, 5000), this.threadReload$).pipe(
              switchMap(() => this.processService.listForPolicy(p.policyId)),
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  private readonly threadProc = computed<PolicyProcess | null>(() => {
    const p = this.v3Process();
    const r = this.threadResponse();
    if (!p || !r || !r.success || !r.data) return null;
    return r.data.find((x) => x.id === p.processId) ?? null;
  });

  /** Переписка заявки как лента чата: комментарии + значимые статус-события по времени. */
  protected readonly threadEntries = computed<ThreadEntry[]>(() => {
    const proc = this.threadProc();
    if (!proc) return [];
    const out: ThreadEntry[] = [];
    proc.statusHistory.forEach((e, i) => {
      if (e.comment) {
        out.push({
          key: `s${i}`,
          at: e.at,
          author: e.author,
          authorName: e.author === 'agent' ? 'Вы' : SUPPORT_LABEL,
          text: e.comment,
        });
      }
    });
    proc.comments.forEach((c, i) => {
      out.push({
        key: `c${i}`,
        at: c.at,
        author: c.author,
        authorName: c.authorName,
        text: c.text,
      });
    });
    return out.sort((a, b) => a.at.localeCompare(b.at));
  });

  protected readonly threadStatusLabel = computed(() => {
    const proc = this.threadProc();
    return proc ? processStatusLabel(proc.status, proc.kind) : '';
  });
  protected readonly threadAwaiting = computed(() => this.threadProc()?.status === 'awaiting-docs');
  protected readonly threadLoading = computed(
    () => this.v3Process() !== null && this.threadEntries().length === 0,
  );

  protected readonly threadDraft = signal('');
  protected readonly threadSending = signal(false);
  protected readonly threadSendFailed = signal(false);
  protected readonly canSendThread = computed(() => this.threadDraft().trim().length > 0);

  /** Ответ по заявке. Черновик чистим ТОЛЬКО при успехе + видимая ошибка (правило 3G). */
  sendThread(): void {
    const p = this.v3Process();
    const text = this.threadDraft().trim();
    if (!p || !text || this.threadSending()) return;
    this.threadSending.set(true);
    this.threadSendFailed.set(false);
    this.processService.addComment(p.processId, text).subscribe({
      next: (r) => {
        this.threadSending.set(false);
        if (r?.success) {
          this.threadDraft.set('');
          this.threadReload$.next();
        } else {
          this.threadSendFailed.set(true);
        }
      },
      error: () => {
        this.threadSending.set(false);
        this.threadSendFailed.set(true);
      },
    });
  }

  onThreadKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendThread();
    }
  }

  /**
   * Время реплики в треде заявки: ЧЧ:ММ для сегодняшних, иначе с датой. События заявки
   * могут быть давними (заявку открыли недели назад) — голое «12:30» после «12:55»
   * читалось бы как сбой; дата снимает вопрос.
   */
  entryTime(at: string): string {
    const d = new Date(at);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return time;
    return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}, ${time}`;
  }

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
    // V3: тред заявки тоже держим прокрученным к последней реплике.
    effect(() => {
      this.threadEntries();
      const el = this.threadScroller()?.nativeElement;
      if (el) setTimeout(() => (el.scrollTop = el.scrollHeight), 0);
    });
    afterNextRender(() => this.inputEl()?.nativeElement.focus());
  }

  ngOnInit(): void {
    // Сигнал в шапке (v1) ведёт сюда с ?tab=processes — открываем нужную вкладку сразу.
    if (this.route.snapshot.queryParamMap.get('tab') === 'processes') {
      this.tab.set('processes');
    }
    // Чат «прочитан» только когда он и есть открытая поверхность: v2 всегда, v1 на
    // вкладке «Диалоги». В v3 сверху список бесед — чат читаем при открытии его беседы.
    if (this.variant() !== 'v3' && this.tab() === 'dialogs') {
      this.chat.markRead();
    }
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

  /** «Имя Отчество» без фамилии — тёплое обращение к куратору в шапке (ФИО — в ленте). */
  givenName(name: string | undefined): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.length > 1 ? parts.slice(1).join(' ') : (parts[0] ?? '');
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
