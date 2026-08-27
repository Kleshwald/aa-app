import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, startWith, switchMap } from 'rxjs';

import * as QRCode from 'qrcode';

import { ClientDetailService, type PolicyDetail } from '@core/services/client-detail.service';
import {
  PROCESS_KIND_LABEL,
  ProcessService,
  isCompletedProcess,
  processStatusLabel,
  reasonLabel,
  type PolicyProcess,
  type ProcessActor,
  type ProcessStatusEvent,
} from '@core/services/process.service';

// Одна хронологическая запись «Хода заявки»: событие статуса ИЛИ реплика.
// Журнал операции (как трекинг Госуслуг), НЕ чат-пузыри — судьба сообщения иная.
interface JournalEntry {
  at: string;
  author: ProcessActor;
  authorLabel: string;
  statusLabel?: string;
  text?: string;
}
import { type ApiResponse } from '@core/models';
import { BreadcrumbsComponent } from '@shared/breadcrumbs/breadcrumbs.component';
import { InsurerLogoComponent } from '@shared/insurer-logo/insurer-logo.component';

import { ChangeReasonDialogComponent } from './change-reason-dialog.component';

const STATUS_LABEL: Record<PolicyDetail['status'], string> = {
  active: 'Оформлен',
  expired: 'Истёк',
  cancelled: 'Расторгнут',
  pending: 'Черновик',
  processing: 'В обработке',
};

const PRODUCT_LABEL: Record<PolicyDetail['type'], string> = {
  OSAGO: 'ОСАГО',
  NS: 'НС при ДТП',
  TICK: 'Антиклещ',
  MORTGAGE: 'Ипотека',
};

@Component({
  selector: 'app-client-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    NgTemplateOutlet,
    RouterLink,
    InsurerLogoComponent,
    BreadcrumbsComponent,
    ChangeReasonDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-detail.page.html',
  styleUrl: './client-detail.page.scss',
})
export class ClientDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ClientDetailService);
  private readonly processService = inject(ProcessService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly productLabel = PRODUCT_LABEL;
  protected readonly processKindLabel = PROCESS_KIND_LABEL;

  /** Пришли сюда сразу после оформления (горячий сценарий). */
  protected readonly justIssued = signal(this.route.snapshot.queryParamMap.get('issued') === '1');
  /** Только что отправили заявку на внесение изменений (баннер успеха). */
  protected readonly changed = signal(this.route.snapshot.queryParamMap.get('changed') === '1');

  protected readonly showMore = signal(false);

  // Выбор документов: null = «выбраны все» (дефолт — агент отдаёт клиенту всё).
  // Список виден сразу; отмечать ничего не нужно, чтобы отправить/скачать.
  private readonly docSel = signal<ReadonlySet<string> | null>(null);

  // QR: клиент наводит телефон → скачивает полис → шлёт себе в мессенджер.
  protected readonly showQr = signal(false);
  protected readonly qrUrl = signal<string>('');

  /** Плитки-старт процессов — термины из 1С + выгода подписью. */
  protected readonly processTiles = [
    { kind: 'change', label: 'Внести изменения', benefit: 'данные, водители, авто' },
    { kind: 'cancel', label: 'Расторгнуть', benefit: 'вернём часть премии клиенту' },
    { kind: 'loss', label: 'Сообщить об убытке', benefit: 'ДТП или страховой случай' },
  ] as const;

  // ─── Заявки по договору (лента статусов / история / комментарии) ───
  private readonly refresh$ = new Subject<void>();

  protected readonly processesResponse = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id') ?? '';
        return this.refresh$.pipe(
          startWith(void 0),
          switchMap(() => this.processService.listForPolicy(id)),
        );
      }),
    ),
    { initialValue: undefined },
  );

  protected readonly processes = computed<PolicyProcess[]>(() => {
    const r = this.processesResponse();
    return r?.success ? (r.data ?? []) : [];
  });

  /** Активные заявки — только они «висят» на договоре и ждут кого-то из сторон. */
  protected readonly activeProcesses = computed(() =>
    this.processes().filter((p) => !isCompletedProcess(p.status)),
  );

  /**
   * Завершённые заявки — след операции. Маркера в строке «Мои клиенты» у них уже нет,
   * но история обязана остаться здесь: иначе закрытая заявка выглядит как потерянная.
   * Свежие сверху.
   */
  protected readonly completedProcesses = computed(() =>
    this.processes()
      .filter((p) => isCompletedProcess(p.status))
      .sort((a, b) => this.closedAt(b).localeCompare(this.closedAt(a))),
  );

  protected readonly completedOpen = signal(false);

  toggleCompleted(): void {
    this.completedOpen.update((v) => !v);
  }

  /** Когда заявку закрыли (последнее событие истории) — для сортировки и подписи. */
  private closedAt(proc: PolicyProcess): string {
    return proc.statusHistory[proc.statusHistory.length - 1]?.at ?? proc.createdAt;
  }

  /** Статус заявки с учётом её вида: у убытка `done` — «Убыток урегулирован», не «Изменения внесены». */
  protected reqStatusLabel(proc: PolicyProcess): string {
    return processStatusLabel(proc.status, proc.kind);
  }

  // Диалог выбора причин + окно заявки + черновик ответа.
  protected readonly reasonDialogOpen = signal(false);
  protected readonly historyProcessId = signal<string | null>(null);

  /**
   * Открытая заявка — СНИМОК, а не производная от опрашиваемого списка.
   *
   * Раньше здесь стоял computed над `processes()`, а `processes()` при неудачном ответе
   * отдаёт []. Поллинг раз в 5 сек → ОДИН провалившийся запрос на 3G закрывал открытое
   * окно заявки прямо под руками агента. Фон обновляет ДАННЫЕ, но не имеет права
   * разрушать ПОВЕРХНОСТЬ, в которой человек работает.
   * Снимок обновляется только при успехе (см. effect ниже); при сбое просто живёт дальше.
   */
  private readonly historySnapshot = signal<PolicyProcess | null>(null);
  protected readonly historyProcess = this.historySnapshot.asReadonly();

  protected readonly commentDraft = signal('');
  /** Идёт отправка ответа — блокирует кнопку (защита от двойного тапа на 3G). */
  protected readonly sending = signal(false);
  /** Ответ не ушёл. Черновик при этом ЦЕЛ — см. submitComment(). */
  protected readonly sendFailed = signal(false);

  /** «Ход заявки» — события статуса + реплики в одной хронологии (по времени). */
  protected readonly journal = computed<JournalEntry[]>(() => {
    const proc = this.historyProcess();
    if (!proc) return [];
    const fromStatus: JournalEntry[] = proc.statusHistory.map((ev) => ({
      at: ev.at,
      author: ev.author,
      authorLabel: ev.author === 'agent' ? 'Вы' : 'Поддержка',
      statusLabel: processStatusLabel(ev.status, proc.kind),
      text: ev.comment,
    }));
    const fromComments: JournalEntry[] = proc.comments.map((c) => ({
      at: c.at,
      author: c.author,
      authorLabel: c.author === 'agent' ? 'Вы' : 'Поддержка',
      text: c.text,
    }));
    return [...fromStatus, ...fromComments].sort((a, b) => a.at.localeCompare(b.at));
  });

  constructor() {
    // Model A: лёгкий поллинг, чтобы «поддержка» продвинула статус/ответила без F5.
    // НО: пока агент набирает ответ, фон молчит — перерисовка списка не должна дёргать
    // каретку в поле ввода. Пишущий человек важнее свежести на 5 секунд.
    const poll = setInterval(() => {
      if (this.historyProcessId() && this.commentDraft().trim()) return;
      this.refresh$.next();
    }, 5000);
    this.destroyRef.onDestroy(() => clearInterval(poll));

    // Снимок открытой заявки обновляем ТОЛЬКО когда пришли годные данные.
    // Пришёл сбой (processes() === []) — снимок остаётся прежним, окно не схлопывается.
    effect(() => {
      const id = this.historyProcessId();
      if (!id) return;
      const fresh = this.processes().find((p) => p.id === id);
      if (fresh) this.historySnapshot.set(fresh);
    });
  }

  protected readonly response = toSignal<ApiResponse<PolicyDetail | null> | undefined>(
    this.route.paramMap.pipe(switchMap((params) => this.service.get(params.get('id') ?? ''))),
    { initialValue: undefined },
  );

  protected readonly policy = computed<PolicyDetail | null>(() => {
    const r = this.response();
    return r?.success ? (r.data ?? null) : null;
  });

  protected readonly isLoading = computed(() => this.response() === undefined);
  protected readonly hasError = computed(() => {
    const r = this.response();
    return r !== undefined && (!r.success || !r.data);
  });

  /** id выбранных документов (с учётом дефолта «все»). */
  protected readonly selectedDocIds = computed<string[]>(() => {
    const docs = this.policy()?.documents ?? [];
    const sel = this.docSel();
    return sel === null
      ? docs.map((d) => d.id)
      : docs.filter((d) => sel.has(d.id)).map((d) => d.id);
  });

  protected readonly selectedCount = computed(() => this.selectedDocIds().length);
  protected readonly hasAnyDocs = computed(() => this.selectedCount() > 0);
  protected readonly allDocsSelected = computed(() => {
    const docs = this.policy()?.documents ?? [];
    return docs.length > 0 && this.selectedCount() === docs.length;
  });

  /** Сколько допов уже добавлено к договору (0..3) — для подписи «Добавлено N из 3». */
  protected readonly addedAddOns = computed(() => {
    const p = this.policy();
    return Math.min(3, Math.max(0, p?.addOns.length ?? 0));
  });

  /** Итого, оплаченное клиентом: премия полиса + все допы. */
  protected readonly totalPaid = computed(() => {
    const p = this.policy();
    if (!p) return 0;
    return p.premium + p.addOns.reduce((sum, a) => sum + a.premium, 0);
  });

  /** Телефон для атрибута tel: — только цифры и ведущий «+». */
  telHref(phone: string): string {
    return 'tel:' + phone.replace(/[^\d+]/g, '');
  }

  isDocSelected(id: string): boolean {
    const sel = this.docSel();
    return sel === null ? true : sel.has(id);
  }

  toggleAllDocs(): void {
    // Выбраны все → снять всё; иначе вернуть «все» (null = все).
    this.docSel.set(this.allDocsSelected() ? new Set<string>() : null);
  }

  toggleDoc(id: string): void {
    const docs = this.policy()?.documents ?? [];
    const next = new Set(this.docSel() ?? docs.map((d) => d.id));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.docSel.set(next);
  }

  /** Скачать выбранные документы (по умолчанию — все). Тянет демо-PDF из public/docs. */
  downloadDocs(): void {
    const docs = this.policy()?.documents ?? [];
    const ids = new Set(this.selectedDocIds());
    const urls = [...new Set(docs.filter((d) => ids.has(d.id)).map((d) => d.url))];
    for (const url of urls) {
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      a.rel = 'noopener';
      a.click();
    }
  }

  /** QR со ссылкой на полис: клиент сканирует телефоном и забирает документ. */
  toggleQr(): void {
    if (this.showQr()) {
      this.showQr.set(false);
      return;
    }
    const p = this.policy();
    if (!p) return;
    // Абсолютная ссылка на демо-PDF (в прототипе — тестовый файл; в бою — защищённый PDF).
    const rel = p.documents[0]?.url ?? 'docs/polis-osago-demo.pdf';
    const link = new URL(rel, document.baseURI).href;
    void QRCode.toDataURL(link, { width: 240, margin: 1, errorCorrectionLevel: 'M' }).then(
      (url) => {
        this.qrUrl.set(url);
        this.showQr.set(true);
      },
    );
  }

  // ─── Процессы по договору ───

  /**
   * Клик по плитке процесса. У изменений причин 12 (мультивыбор из 1С) — их выбирают в
   * мастере; у расторжения причина одна и живёт первым полем формы, поэтому лишней
   * модалки нет. Убыток — пока заглушка (интейк следующим шагом).
   */
  startTile(kind: 'change' | 'cancel' | 'loss', label: string): void {
    const id = this.policy()?.id;
    if (kind === 'change') {
      this.reasonDialogOpen.set(true);
    } else if (kind === 'cancel' && id) {
      void this.router.navigate(['/clients', id, 'cancel']);
    } else {
      alert(`Проведём по шагам: ${label}`);
    }
  }

  /** Выбраны причины → открываем предзаполненную форму изменений. */
  onReasonsNext(codes: string[]): void {
    this.reasonDialogOpen.set(false);
    const id = this.policy()?.id;
    if (id) {
      void this.router.navigate(['/clients', id, 'change'], {
        queryParams: { reasons: codes.join(',') },
      });
    }
  }

  refreshProcesses(): void {
    this.refresh$.next();
  }

  /** Последнее событие статуса заявки (для ленты). */
  lastEvent(proc: PolicyProcess): ProcessStatusEvent | null {
    return proc.statusHistory[proc.statusHistory.length - 1] ?? null;
  }

  /** Причины заявки одной строкой (человеческие подписи). */
  reasonList(proc: PolicyProcess): string {
    return proc.reasons.map((c) => reasonLabel(c)).join(', ');
  }

  openHistory(proc: PolicyProcess): void {
    this.historyProcessId.set(proc.id);
    this.historySnapshot.set(proc);
    this.commentDraft.set('');
    this.sendFailed.set(false);
  }

  closeHistory(): void {
    this.historyProcessId.set(null);
    this.historySnapshot.set(null);
    this.sendFailed.set(false);
  }

  /**
   * Ответ по заявке.
   *
   * БЫЛО: `commentDraft.set('')` ДО ответа сервера и `subscribe(() => …)` без обработки
   * ошибки. На нестабильном 3G это значило: отправка упала → черновик УЖЕ стёрт →
   * ошибки нет → агент уверена, что написала страховой. Молчаливая потеря ответа —
   * самый дорогой из возможных отказов: один раз потеряв ответ по убытку, агент
   * навсегда возвращается в почту и звонок куратору. И не жалуется — просто перестаёт.
   *
   * СТАЛО: черновик чистим ТОЛЬКО после успеха; отказ показываем словами; кнопка
   * заблокирована на время отправки — это же и защита от двойного тапа (дубль реплики).
   */
  submitComment(): void {
    const proc = this.historyProcess();
    const text = this.commentDraft().trim();
    if (!proc || !text || this.sending()) return;

    this.sending.set(true);
    this.sendFailed.set(false);
    this.processService.addComment(proc.id, text).subscribe({
      next: (res) => {
        this.sending.set(false);
        if (res.success) {
          this.commentDraft.set(''); // ← только здесь, и никогда раньше
          this.refreshProcesses();
        } else {
          this.sendFailed.set(true);
        }
      },
      error: () => {
        this.sending.set(false);
        this.sendFailed.set(true);
      },
    });
  }

  /** Приложить документ к заявке (заглушка: берём имя выбранного файла). */
  uploadProcessDoc(proc: PolicyProcess, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.processService.uploadDoc(proc.id, file.name).subscribe(() => this.refreshProcesses());
  }

  /** Перевыпустить ссылку на оплату (доплата ВИ): поддержка выдаёт новую по запросу. */
  reissuePaymentLink(proc: PolicyProcess): void {
    this.processService.reissuePaymentLink(proc.id).subscribe(() => this.refreshProcesses());
  }

  /** Сумма доплаты человеческой строкой (₽ добавляет шаблон). */
  payAmount(proc: PolicyProcess): string {
    return (proc.paymentAmount ?? 0).toLocaleString('ru-RU');
  }

  /** Добавить кросс-продукт клиенту. Заглушка — реальный флоу появится позже. */
  addCrossSell(name: string): void {
    alert(`Добавим клиенту: ${name}`);
  }
}
