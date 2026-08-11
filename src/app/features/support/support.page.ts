import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { DOC_PRESETS } from '@core/mock/fixtures/support.fixture';
import {
  type ProcessStatus,
  PROCESS_KIND_LABEL,
  reasonLabel,
} from '@core/services/process.service';
import {
  CURRENT_OPERATOR,
  SECOND_LINE_TOPICS,
  SUPPORT_BALL_LABEL,
  SUPPORT_OPERATORS,
  SUPPORT_SOURCE_LABEL,
  humanAge,
  minutesSince,
  slaState,
  type SlaState,
  type SupportBall,
  type SupportChatThread,
  type SupportQueueItem,
  type SupportRequestDetail,
} from '@core/services/support.model';
import { SupportService } from '@core/services/support.service';

/** Вкладка очереди. Ось — «чей мяч», а не вид заявки: так строится рабочий день. */
type QueueTab = 'mine' | 'ours' | 'waiting' | 'all';

// Подписи вкладок — теми же словами, что и «чей мяч» в строке («У нас» / «У агента» /
// «У страховой»): одна ось не должна называться в двух местах по-разному.
const TAB_LABEL: Record<QueueTab, string> = {
  mine: 'Мои',
  ours: 'У нас',
  waiting: 'У других',
  all: 'Все',
};

/**
 * Кокпит поддержки — master-detail на одном экране.
 *
 * Почему одна страница, а не раздел с навигацией: оператор весь день живёт в одном
 * окне и меряет работу количеством закрытых дел. Каждый переход «список → карточка →
 * назад» — это потеря места в очереди. Слева очередь, справа дело, действия — в деле.
 *
 * Почему кокпит живёт внутри прототипа кабинета: заявки демо-агента здесь ЖИВЫЕ
 * (та же in-memory фикстура). «Запросить документы» отсюда зажигает у агента
 * «Ждут ваших действий» — петля показывается целиком.
 *
 * ⚠️ Моки живут в памяти ВКЛАДКИ: показывать петлю можно только переходом по
 * ссылкам внутри приложения (кокпит → /hub → вход в кабинет). F5 или вторая
 * вкладка создают отдельный набор фикстур, и действие поддержки «пропадёт».
 */
@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './support.page.html',
  styleUrl: './support.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportPage {
  private readonly api = inject(SupportService);
  private readonly destroyRef = inject(DestroyRef);

  readonly operators = SUPPORT_OPERATORS;
  readonly secondLineTopics = SECOND_LINE_TOPICS;
  readonly tabs: QueueTab[] = ['mine', 'ours', 'waiting', 'all'];
  readonly tabLabel = TAB_LABEL;
  readonly ballLabel = SUPPORT_BALL_LABEL;
  readonly sourceLabel = SUPPORT_SOURCE_LABEL;
  readonly kindLabel = PROCESS_KIND_LABEL;
  readonly humanAge = humanAge;
  readonly reasonLabel = reasonLabel;

  /** Кто за пультом. В демо переключается — видно, как «Мои» меняет состав. */
  readonly operator = signal<string>(CURRENT_OPERATOR);

  readonly items = signal<SupportQueueItem[]>([]);
  readonly tab = signal<QueueTab>('ours');
  readonly search = signal('');
  readonly selectedId = signal<string | null>(null);
  readonly loadingQueue = signal(false);
  readonly loadingCard = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly request = signal<SupportRequestDetail | null>(null);
  readonly thread = signal<SupportChatThread | null>(null);

  /** Черновики: ответ агенту и внутренняя заметка живут раздельно — это разные адресаты. */
  readonly replyDraft = signal('');
  readonly noteDraft = signal('');
  readonly docPicks = signal<string[]>([]);
  readonly docFormOpen = signal(false);
  readonly escalateTopic = signal('');

  constructor() {
    this.reloadQueue();
    // Поллинг вместо push — как в кабинете агента. 15 с: очередь поддержки живёт
    // медленнее, чем чат, а лишние запросы на демо-стенде ни к чему.
    const timer = setInterval(() => this.reloadQueue(true), 15_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  // ─── Очередь ───────────────────────────────────────────────────────────────

  readonly filtered = computed(() => {
    const tab = this.tab();
    const me = this.operator();
    const q = this.search().trim().toLowerCase();
    return this.items().filter((item) => {
      if (tab === 'mine' && item.assignee !== me) return false;
      if (tab === 'ours' && item.ball !== 'support') return false;
      if (tab === 'waiting' && item.ball === 'support') return false;
      if (!q) return true;
      return [item.agentName, item.topic, item.detail, item.requestNumber ?? '', item.agentIkp]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  });

  /** Счётчики на вкладках — иначе непонятно, куда смотреть первым. */
  readonly counts = computed(() => {
    const me = this.operator();
    const all = this.items();
    return {
      mine: all.filter((i) => i.assignee === me).length,
      ours: all.filter((i) => i.ball === 'support').length,
      waiting: all.filter((i) => i.ball !== 'support').length,
      all: all.length,
    } as Record<QueueTab, number>;
  });

  /** Просрочка по SLA — единственное «красное» на экране, поэтому считаем честно. */
  readonly overdueCount = computed(
    () => this.items().filter((i) => slaState(i) === 'overdue').length,
  );

  readonly unassignedCount = computed(
    () => this.items().filter((i) => i.assignee === null && i.ball === 'support').length,
  );

  sla(item: SupportQueueItem): SlaState {
    return slaState(item);
  }

  ageMinutes(iso: string): number {
    return minutesSince(iso);
  }

  reloadQueue(silent = false): void {
    if (!silent) this.loadingQueue.set(true);
    this.api.queue().subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loadingQueue.set(false);
        // Первое дело выбираем сами: пустая правая половина на входе выглядит поломкой.
        if (!this.selectedId()) {
          const first = this.filtered()[0] ?? this.items()[0];
          if (first) this.select(first);
        }
      },
      error: () => {
        this.loadingQueue.set(false);
        this.error.set('Не удалось обновить очередь. Попробуйте ещё раз.');
      },
    });
  }

  select(item: SupportQueueItem): void {
    this.selectedId.set(item.id);
    this.replyDraft.set('');
    this.noteDraft.set('');
    this.docPicks.set([]);
    this.docFormOpen.set(false);
    this.error.set(null);
    if (item.source === '1c') this.loadRequest(item.id);
    else this.loadThread(item.id);
  }

  private loadRequest(id: string): void {
    this.thread.set(null);
    this.loadingCard.set(true);
    this.api.request(id).subscribe({
      next: (res) => {
        this.request.set(res.data ?? null);
        this.loadingCard.set(false);
      },
      error: () => {
        this.loadingCard.set(false);
        this.error.set('Дело не открылось. Обновите очередь.');
      },
    });
  }

  private loadThread(id: string): void {
    this.request.set(null);
    this.loadingCard.set(true);
    this.api.thread(id).subscribe({
      next: (res) => {
        this.thread.set(res.data ?? null);
        this.escalateTopic.set(res.data?.escalatedTo ?? '');
        this.loadingCard.set(false);
      },
      error: () => {
        this.loadingCard.set(false);
        this.error.set('Диалог не открылся. Обновите очередь.');
      },
    });
  }

  // ─── Действия по заявке ────────────────────────────────────────────────────
  // Общее правило (закон переписки, `project_process_visibility`): черновик чистим
  // ТОЛЬКО после успеха, ошибку показываем словами, кнопку блокируем на время
  // запроса. Оператор набирает ответ в чужом деле — потерять его недопустимо.

  private applyRequest(next: SupportRequestDetail | null, onSuccess?: () => void): void {
    if (next) this.request.set(next);
    this.busy.set(false);
    onSuccess?.();
    this.reloadQueue(true);
  }

  private failed(message: string): void {
    this.busy.set(false);
    this.error.set(message);
  }

  takeRequest(): void {
    const req = this.request();
    if (!req || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const next = req.assignee === this.operator() ? null : this.operator();
    this.api.assign(req.id, next).subscribe({
      next: (res) => this.applyRequest(res.data),
      error: () => this.failed('Не удалось сменить ответственного.'),
    });
  }

  sendReply(): void {
    const req = this.request();
    const text = this.replyDraft().trim();
    if (!req || !text || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.reply(req.id, text).subscribe({
      next: (res) => this.applyRequest(res.data, () => this.replyDraft.set('')),
      error: () => this.failed('Ответ не ушёл. Текст сохранён — попробуйте ещё раз.'),
    });
  }

  sendNote(): void {
    const req = this.request();
    const text = this.noteDraft().trim();
    if (!req || !text || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.note(req.id, text, this.operator()).subscribe({
      next: (res) => this.applyRequest(res.data, () => this.noteDraft.set('')),
      error: () => this.failed('Заметка не сохранилась. Текст сохранён — попробуйте ещё раз.'),
    });
  }

  /** Пресеты документов по виду заявки — оператор не печатает одно и то же руками. */
  docPresets(): string[] {
    const req = this.request();
    return req ? DOC_PRESETS[req.kind] : [];
  }

  toggleDoc(item: string): void {
    const picks = this.docPicks();
    this.docPicks.set(picks.includes(item) ? picks.filter((p) => p !== item) : [...picks, item]);
  }

  requestDocs(): void {
    const req = this.request();
    const items = this.docPicks();
    if (!req || items.length === 0 || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api
      .setStatus(req.id, 'awaiting-docs', {
        comment: 'Приложите документы, и мы продолжим работу по заявке.',
        docItems: items,
      })
      .subscribe({
        next: (res) =>
          this.applyRequest(res.data, () => {
            this.docPicks.set([]);
            this.docFormOpen.set(false);
          }),
        error: () => this.failed('Запрос документов не отправился.'),
      });
  }

  setStatus(status: ProcessStatus, options: { comment?: string; atInsurer?: boolean } = {}): void {
    const req = this.request();
    if (!req || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.setStatus(req.id, status, options).subscribe({
      next: (res) => this.applyRequest(res.data),
      error: () => this.failed('Статус не сохранился.'),
    });
  }

  /** Итог завершения зависит от вида — «Изменения внесены» для убытка было бы ложью. */
  finishLabel(): string {
    const kind = this.request()?.kind;
    if (kind === 'cancel') return 'Договор расторгнут';
    if (kind === 'loss') return 'Убыток урегулирован';
    return 'Изменения внесены';
  }

  // ─── Действия по диалогу ───────────────────────────────────────────────────

  private applyThread(next: SupportChatThread | null, onSuccess?: () => void): void {
    if (next) this.thread.set(next);
    this.busy.set(false);
    onSuccess?.();
    this.reloadQueue(true);
  }

  takeThread(): void {
    const t = this.thread();
    if (!t || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const next = t.assignee === this.operator() ? null : this.operator();
    this.api.assignThread(t.id, next).subscribe({
      next: (res) => this.applyThread(res.data),
      error: () => this.failed('Не удалось сменить ответственного.'),
    });
  }

  sendThreadReply(): void {
    const t = this.thread();
    const text = this.replyDraft().trim();
    if (!t || !text || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.replyToThread(t.id, text, this.operator()).subscribe({
      next: (res) => this.applyThread(res.data, () => this.replyDraft.set('')),
      error: () => this.failed('Ответ не ушёл. Текст сохранён — попробуйте ещё раз.'),
    });
  }

  escalate(): void {
    const t = this.thread();
    const topic = this.escalateTopic();
    if (!t || !topic || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.escalate(t.id, topic).subscribe({
      next: (res) => this.applyThread(res.data),
      error: () => this.failed('Не удалось передать во вторую линию.'),
    });
  }

  // ─── Мелочи для шаблона ────────────────────────────────────────────────────

  ballOf(item: SupportQueueItem): SupportBall {
    return item.ball;
  }

  isSelected(item: SupportQueueItem): boolean {
    return item.id === this.selectedId();
  }

  trackById(_: number, item: SupportQueueItem): string {
    return item.id;
  }
}
