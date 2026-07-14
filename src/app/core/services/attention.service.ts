import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, switchMap, timer } from 'rxjs';

import { ProcessService, type AwaitingProcess } from './process.service';

// ─── Сигнал «Ждут ваших действий» ───────────────────────────────────────────
// Один УЗКИЙ сигнал: заявки по договорам, где мяч у агента. Питает сквозной
// индикатор в сайдбаре и чип-фильтр на «Мои клиенты» — оба показывают ОДНО число.
//
// Чат сюда НЕ входит: у него свой бейдж на «Сообщения» (разные bounded-контексты;
// склейка давала ощущение «сигнал на всё» — разбор с Анваром/Беловым 2026-07-13).
//
// ЧЕСТНОСТЬ (Белов, 2026-07-14): «не знаю» и «ноль» — РАЗНЫЕ вещи. Раньше при ошибке
// бэкенда сигнал тихо гас и отказ выглядел как «вас никто не ждёт» — худший failure
// mode для аудитории, у которой главный страх «пропущу и опозорюсь». Теперь состояние
// трёхзначное: loading | ok(N) | error(не знаем). UI обязан показывать «не удалось
// проверить», а не ноль.

/** Состояние сигнала: пока не знаем / знаем число / не смогли узнать. */
export type AttentionState = 'loading' | 'ok' | 'error';

// Лёгкий поллинг: индикатор должен ловить авто-продвижение заявки в «Ожидаем
// документы» без F5 — это несущее для теста «заметит ли посреди задачи».
// Пауза на скрытой вкладке: на 3G и старом ноуте фоновый опрос — это радиошум
// и разряд канала ради события, которое случается раз в час (НФТ, Белов).
const POLL_MS = 5000;

@Injectable({ providedIn: 'root' })
export class AttentionService {
  private readonly processService = inject(ProcessService);

  /** Вкладка на переднем плане? Скрытую не опрашиваем. */
  private readonly visible = signal(!document.hidden);

  constructor() {
    document.addEventListener('visibilitychange', () => this.visible.set(!document.hidden));
  }

  private readonly response = toSignal(
    timer(0, POLL_MS).pipe(
      filter(() => this.visible()),
      switchMap(() => this.processService.listAwaiting()),
    ),
    { initialValue: undefined },
  );

  /** loading — ещё не спросили; error — спросили и не смогли узнать. */
  readonly state = computed<AttentionState>(() => {
    const r = this.response();
    if (r === undefined) return 'loading';
    return r.success ? 'ok' : 'error';
  });

  /** Заявки, ждущие действия агента, по всем полисам (вне фильтра периода). */
  private readonly awaiting = computed<AwaitingProcess[]>(() => {
    const r = this.response();
    return r?.success ? (r.data ?? []) : [];
  });

  /**
   * Сколько ПОЛИСОВ (строк таблицы) ждут агента: на одном полисе заявок может быть
   * несколько, а строка — одна. Одно число и для индикатора в сайдбаре, и для чипа.
   *
   * ВАЖНО: 0 здесь значит «знаем, что ноль» ТОЛЬКО при `state() === 'ok'`.
   * При 'loading'/'error' тоже вернётся 0 — поэтому UI обязан сначала смотреть на
   * `state()`, иначе повторит ровно тот баг честности, который мы чиним
   * (отказ бэкенда, показанный как «вас никто не ждёт»).
   */
  readonly awaitingPolicyCount = computed(
    () => new Set(this.awaiting().map((a) => a.policyId)).size,
  );

  /** Не смогли узнать (отказ бэкенда). UI: «не удалось проверить», НЕ ноль. */
  readonly failed = computed(() => this.state() === 'error');
}
