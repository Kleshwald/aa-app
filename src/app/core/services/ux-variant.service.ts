import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

// ─── Переключатель UX-вариантов процессов (для сравнения владельцем на /hub) ────
// Прототип — одно развёртывание (GitHub Pages), поэтому «три версии» — это не три
// сборки, а один рантайм-флаг: ?ux=v1|v2|v3, залипающий в localStorage. Ссылки с
// «панели проекта» задают вариант; внутри приложения он сквозной. Так владелец
// сравнивает форматы последовательно (выбрал на /hub → пощупал → вернулся → другой),
// без трёх адресов и трёх билдов.
//
// Ось различия — КАК процессы (заявки) всплывают у агента:
//   v1 «Процессы в Сообщениях»   — сигнал в шапке + вкладка Процессы-указатель в Сообщениях
//                                   (текущая, вариант B). Клик по заявке → страница договора.
//   v2 «Уведомления вверху»       — сигнал в шапке ведёт в «Мои клиенты» (чип «ждут вас»);
//                                   Сообщения = только чат поддержки. Процессы живут в
//                                   договоре и в таблице. Это состояние ДО хаба (предыдущее).
//   v3 «Переписка в Сообщениях»   — сигнал в шапке + переписка заявок СИНХРОНИЗИРОВАНА в
//                                   Сообщения: единый список бесед, отдельный чат на клиента.
//                                   (Формат-кандидат; пересекает лок 152-ФЗ — см. /hub.)

export type UxVariant = 'v1' | 'v2' | 'v3';

const STORAGE_KEY = 'aa-ux-variant';
const VALID: readonly UxVariant[] = ['v1', 'v2', 'v3'];

function isVariant(v: unknown): v is UxVariant {
  return typeof v === 'string' && (VALID as readonly string[]).includes(v);
}

/** Куда ведёт клик по сигналу «Ждут ваших действий» — своё для каждого варианта. */
export interface SignalLink {
  commands: unknown[];
  query: Record<string, string>;
}

export interface VariantMeta {
  n: number;
  name: string;
  tagline: string;
}

export const UX_VARIANT_META: Record<UxVariant, VariantMeta> = {
  v1: { n: 1, name: 'Процессы в Сообщениях', tagline: 'вкладка «Процессы» внутри Сообщений' },
  v2: { n: 2, name: 'Уведомления вверху', tagline: 'сигнал в шапке, процессы — в договоре' },
  v3: {
    n: 3,
    name: 'Переписка в Сообщениях',
    tagline: 'уведомления вверху + чат по каждому клиенту',
  },
};

@Injectable({ providedIn: 'root' })
export class UxVariantService {
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);

  private readonly _variant = signal<UxVariant>('v1');
  private readonly _chosen = signal(false);

  /** Текущий вариант UX. По умолчанию v1 (текущая, вариант B). */
  readonly variant = this._variant.asReadonly();
  /** Вариант выбран ЯВНО (через ссылку с /hub или прошлый выбор) — только тогда рисуем dev-метку. */
  readonly chosen = this._chosen.asReadonly();
  readonly meta = computed<VariantMeta>(() => UX_VARIANT_META[this._variant()]);

  constructor() {
    this.applyFromLocation();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.applyFromLocation());
  }

  /** ?ux= в адресе перебивает всё; иначе на старте поднимаем прошлый выбор из хранилища. */
  private applyFromLocation(): void {
    const win = this.doc.defaultView;
    const fromUrl = win ? new URLSearchParams(win.location.search).get('ux') : null;
    if (isVariant(fromUrl)) {
      this.set(fromUrl);
      return;
    }
    if (!this._chosen()) {
      const stored = this.readStored();
      if (isVariant(stored)) {
        this._variant.set(stored);
        this._chosen.set(true);
      }
    }
  }

  set(v: UxVariant): void {
    this._variant.set(v);
    this._chosen.set(true);
    try {
      this.doc.defaultView?.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // Приватный режим / заблокированное хранилище — вариант живёт хотя бы в рамках сессии.
    }
  }

  private readStored(): string | null {
    try {
      return this.doc.defaultView?.localStorage.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  /** Куда ведёт сигнал «Ждут ваших действий» из шапки — зависит от варианта. */
  readonly signalLink = computed<SignalLink>(() => {
    switch (this._variant()) {
      case 'v2': {
        // Процессов в Сообщениях нет — сигнал ведёт в «Мои клиенты» с включённым чипом.
        const link: SignalLink = { commands: ['/clients'], query: { awaiting: '1' } };
        return link;
      }
      case 'v3': {
        // Переписка живёт в Сообщениях — открываем список бесед процессов.
        const link: SignalLink = { commands: ['/messages'], query: { focus: 'awaiting' } };
        return link;
      }
      case 'v1':
      default: {
        const link: SignalLink = { commands: ['/messages'], query: { tab: 'processes' } };
        return link;
      }
    }
  });

  /** Считает ли бейдж «Сообщения» ещё и заявки? Да там, где процессы живут в Сообщениях (v1/v3). */
  readonly messagesCountsProcesses = computed(() => this._variant() !== 'v2');
}
