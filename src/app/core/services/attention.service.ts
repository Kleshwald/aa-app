import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, timer } from 'rxjs';

import { ProcessService, type AwaitingProcess } from './process.service';

// ─── Сигнал «Ждут ваших действий» ───────────────────────────────────────────
// Один УЗКИЙ сигнал: заявки по договорам, где мяч у агента (status awaiting-docs,
// см. ProcessService.listAwaiting). Питает сквозной индикатор в сайдбаре и чип-
// фильтр на «Мои клиенты» — оба показывают ОДНО число (полисы, где заявка ждёт).
//
// Чат сюда НЕ входит: у него свой канал — бейдж на «Сообщения». Это разные
// контексты (администрирование договора vs переписка), и их склейка давала
// ощущение «сигнал на всё» = перебор (разбор с Анваром/Беловым 2026-07-13).

// Лёгкий поллинг: индикатор должен ловить авто-продвижение заявки в «Ожидаем
// документы» без F5 — это несущее для теста «заметит ли посреди задачи».
const POLL_MS = 5000;

@Injectable({ providedIn: 'root' })
export class AttentionService {
  private readonly processService = inject(ProcessService);

  private readonly awaitingResponse = toSignal(
    timer(0, POLL_MS).pipe(switchMap(() => this.processService.listAwaiting())),
    { initialValue: undefined },
  );

  /** Заявки, ждущие действия агента, по всем полисам (вне фильтра периода). */
  private readonly awaiting = computed<AwaitingProcess[]>(() => {
    const r = this.awaitingResponse();
    return r?.success ? (r.data ?? []) : [];
  });

  /**
   * Сколько ПОЛИСОВ (строк таблицы) ждут агента прямо сейчас: на одном полисе
   * заявок может быть несколько, а строка — одна. 0 → индикатор скрыт.
   * Одно число и для сквозного индикатора в сайдбаре, и для чипа на «Мои клиенты».
   */
  readonly awaitingPolicyCount = computed(
    () => new Set(this.awaiting().map((a) => a.policyId)).size,
  );
}
