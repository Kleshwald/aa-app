import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, combineLatest, filter, merge, switchMap, tap, timer } from 'rxjs';

import type { AwaitingDeal } from './deal.model';
import { DealService } from './deal.service';
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
  private readonly dealService = inject(DealService);

  /** Вкладка на переднем плане? Скрытую не опрашиваем. */
  private readonly visible = signal(!document.hidden);

  /** Ручной повтор из UI: отказ должен быть тупиком не для агента, а для нас. */
  private readonly retry$ = new Subject<void>();

  /** Идёт повторная проверка (после нажатия «Проверить ещё раз»). */
  readonly retrying = signal(false);

  constructor() {
    document.addEventListener('visibilitychange', () => this.visible.set(!document.hidden));
  }

  /**
   * Спросить ещё раз, не дожидаясь следующего тика поллинга.
   *
   * Без этого честный текст «не удалось проверить» превращался в «обновите страницу» —
   * то есть в требование к агенту бросить недозаполненную форму ОСАГО и потерять ввод.
   * Чинить связь — наша работа, а не её.
   */
  retry(): void {
    this.retrying.set(true);
    this.retry$.next();
  }

  // ДВА источника мяча у агента, ОДИН сигнал:
  //   • заявки по договору (изменение/расторжение/убыток) — status `awaiting-docs`;
  //   • сделки «Согласование» — по флагу `actionRequired` (тариф пришёл / СК просит
  //     документы / нужно отдать клиенту ссылку на оплату).
  // Оба — из НАШЕГО контура (1С). Чат по-прежнему НЕ здесь: у него свой бейдж.
  // Это и есть та синхронизация, о которой спрашивал владелец: наружу «всплывает»
  // не текст переписки, а ФАКТ «вас ждут».
  private readonly response = toSignal(
    merge(
      timer(0, POLL_MS).pipe(filter(() => this.visible())),
      this.retry$, // ручной повтор идёт вне расписания — агент не должен ждать тик
    ).pipe(
      switchMap(() =>
        combineLatest([this.processService.listAwaiting(), this.dealService.listAwaiting()]).pipe(
          tap(() => this.retrying.set(false)),
        ),
      ),
    ),
    { initialValue: undefined },
  );

  /** loading — ещё не спросили; error — спросили и не смогли узнать. */
  readonly state = computed<AttentionState>(() => {
    const r = this.response();
    if (r === undefined) return 'loading';
    const [processes, deals] = r;
    return processes.success && deals.success ? 'ok' : 'error';
  });

  /** Заявки по договорам, ждущие действия агента (вне фильтра периода). */
  private readonly awaiting = computed<AwaitingProcess[]>(() => {
    const r = this.response();
    return r?.[0]?.success ? (r[0].data ?? []) : [];
  });

  /** Сделки «Согласование», где мяч у агента. */
  private readonly awaitingDeals = computed<AwaitingDeal[]>(() => {
    const r = this.response();
    return r?.[1]?.success ? (r[1].data ?? []) : [];
  });

  /**
   * Сколько СТРОК «Мои клиенты» ждут агента. Считаем строки, а не заявки: на одном
   * полисе заявок может быть несколько, а строка — одна. Сделки — тоже строки того же
   * списка (картотека сделок), поэтому просто складываются.
   * Одно число и для индикатора в сайдбаре, и для чипа-фильтра.
   *
   * ВАЖНО: 0 здесь значит «знаем, что ноль» ТОЛЬКО при `state() === 'ok'`.
   * При 'loading'/'error' тоже вернётся 0 — поэтому UI обязан сначала смотреть на
   * `state()`, иначе повторит ровно тот баг честности, который мы чиним
   * (отказ бэкенда, показанный как «вас никто не ждёт»).
   */
  readonly awaitingPolicyCount = computed(
    () =>
      new Set(this.awaiting().map((a) => a.policyId)).size +
      new Set(this.awaitingDeals().map((d) => d.dealId)).size,
  );

  /** Id сделок, ждущих агента — для маркера в строке «Мои клиенты». */
  readonly awaitingDealIds = computed(() => new Set(this.awaitingDeals().map((d) => d.dealId)));

  /** Не смогли узнать (отказ бэкенда). UI: «не удалось проверить», НЕ ноль. */
  readonly failed = computed(() => this.state() === 'error');
}
