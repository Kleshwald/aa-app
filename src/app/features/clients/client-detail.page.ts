import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, startWith, switchMap } from 'rxjs';

import * as QRCode from 'qrcode';

import { ClientDetailService, type PolicyDetail } from '@core/services/client-detail.service';
import { ChatService } from '@core/services/chat.service';
import {
  PROCESS_KIND_LABEL,
  PROCESS_STATUS_LABEL,
  ProcessService,
  reasonLabel,
  type PolicyProcess,
  type ProcessStatusEvent,
} from '@core/services/process.service';
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
  private readonly chat = inject(ChatService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly productLabel = PRODUCT_LABEL;
  protected readonly processStatusLabel = PROCESS_STATUS_LABEL;
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

  // Диалог выбора причин + модалка истории статусов + черновик комментария.
  protected readonly reasonDialogOpen = signal(false);
  protected readonly historyProcessId = signal<string | null>(null);
  protected readonly historyProcess = computed<PolicyProcess | null>(
    () => this.processes().find((p) => p.id === this.historyProcessId()) ?? null,
  );
  protected readonly commentDraft = signal('');

  constructor() {
    // Model A: лёгкий поллинг, чтобы «поддержка» продвинула статус/ответила без F5.
    const poll = setInterval(() => this.refresh$.next(), 5000);
    this.destroyRef.onDestroy(() => clearInterval(poll));
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

  /** Клик по плитке: изменения → мастер причин; расторжение/убыток — заглушка (та же инфра позже). */
  startTile(kind: 'change' | 'cancel' | 'loss', label: string): void {
    if (kind === 'change') {
      this.reasonDialogOpen.set(true);
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
    this.commentDraft.set('');
  }

  closeHistory(): void {
    this.historyProcessId.set(null);
  }

  submitComment(): void {
    const proc = this.historyProcess();
    const text = this.commentDraft().trim();
    if (!proc || !text) return;
    this.commentDraft.set('');
    this.processService.addComment(proc.id, text).subscribe(() => this.refreshProcesses());
  }

  /** Приложить документ к заявке (заглушка: берём имя выбранного файла). */
  uploadProcessDoc(proc: PolicyProcess, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.processService.uploadDoc(proc.id, file.name).subscribe(() => this.refreshProcesses());
  }

  /** «Обсудить в чате» — общий чат с контекстным якорем на заявку. */
  discussInChat(proc: PolicyProcess): void {
    const kind = PROCESS_KIND_LABEL[proc.kind];
    this.chat.startWithContext(
      `Вопрос по заявке №${proc.requestNumber} (${kind}) по полису ${proc.policyNumber}: `,
    );
    void this.router.navigate(['/messages']);
  }

  /** Добавить кросс-продукт клиенту. Заглушка — реальный флоу появится позже. */
  addCrossSell(name: string): void {
    alert(`Добавим клиенту: ${name}`);
  }
}
