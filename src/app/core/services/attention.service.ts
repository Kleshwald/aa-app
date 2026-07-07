import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, timer } from 'rxjs';

import { ChatService } from './chat.service';
import { ProcessService, type AwaitingProcess } from './process.service';

// ─── Единый сигнал «Требуют вас» ───────────────────────────────────────────
// Объединяем ОБНАРУЖЕНИЕ («где меня ждут») в один канал, но разводим ДЕЙСТВИЕ:
// каждый пункт несёт свой адрес (заявка → страница договора; чат → «Сообщения»).
// Агрегируем УКАЗАТЕЛИ (счётчики), не тексты — два бэкенда (1С/вендор) не сливаются,
// принцип «ответ приходит туда, где спросил» сохраняется.

/** Источник пункта — определяет, куда уводит клик. */
export type AttentionSource = 'process' | 'chat';

/** Пункт «Требуют вас»: указатель на дело + адрес действия. */
export interface AttentionItem {
  id: string;
  source: AttentionSource;
  title: string;
  subtitle: string;
  route: string;
  actionLabel: string;
}

// Лёгкий поллинг: индикатор должен ловить авто-продвижение заявки в «Ожидаем
// документы» без F5 — это несущее для теста «заметит ли посреди задачи».
const POLL_MS = 5000;

@Injectable({ providedIn: 'root' })
export class AttentionService {
  private readonly processService = inject(ProcessService);
  private readonly chat = inject(ChatService);

  private readonly awaitingResponse = toSignal(
    timer(0, POLL_MS).pipe(switchMap(() => this.processService.listAwaiting())),
    { initialValue: undefined },
  );

  /** Заявки, ждущие действия агента, по всем полисам (вне фильтра периода). */
  private readonly awaiting = computed<AwaitingProcess[]>(() => {
    const r = this.awaitingResponse();
    return r?.success ? (r.data ?? []) : [];
  });

  /** Пункты «Требуют вас»: заявки + непрочитанный чат (одним пунктом). */
  readonly items = computed<AttentionItem[]>(() => {
    const items: AttentionItem[] = this.awaiting().map(
      (a): AttentionItem => ({
        id: a.processId,
        source: 'process',
        title: a.clientName,
        subtitle: a.need,
        route: `/clients/${a.policyId}`,
        actionLabel: 'Ответить по заявке',
      }),
    );

    // Чат — одним пунктом; гранулярное число непрочитанных остаётся на бейдже
    // «Сообщения» (числа согласованы, список чистый).
    const unread = this.chat.messages().filter((m) => m.author === 'company' && !m.read);
    if (unread.length > 0) {
      const last = unread[unread.length - 1];
      const who = last?.sender?.role === 'curator' ? 'Куратор' : 'Поддержка';
      items.push({
        id: 'chat',
        source: 'chat',
        title: `${who}: новое сообщение`,
        subtitle: last?.sender?.name ?? 'Общий чат поддержки',
        route: '/messages',
        actionLabel: 'Открыть «Сообщения»',
      });
    }
    return items;
  });

  /** Сколько дел ждут агента прямо сейчас (0 → индикатор скрыт). */
  readonly count = computed(() => this.items().length);
}
