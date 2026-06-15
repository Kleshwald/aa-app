import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

/** Ступень системы мотивации: категория агента → её порог и КВ. */
export interface MotivationTier {
  name: string;
  /** Порог прогноза сборов за месяц, ₽ (0 — базовая категория). */
  minProjection: number;
  /** КВ категории, % (для дашборда в профиле; на котировках НЕ показываем). */
  kv: number;
}

/**
 * Снимок мотивации агента на текущий день месяца. Категория присваивается
 * динамически по прогнозу сборов: (сборы / прошедшие дни) × дней в месяце.
 */
export interface MotivationSnapshot {
  tiers: MotivationTier[];
  /** Сборы (страховая премия) за месяц на текущий день, ₽. */
  monthCollections: number;
  daysPassed: number;
  daysInMonth: number;
  /** Уровень проникновения (доп.продукты к ОСАГО), %. */
  penetration: number;
  /** Доля ОСАГО, ушедшего в перестраховочный пул, %. */
  poolShare: number;
  policiesThisMonth: number;
  /** Название месяца в родительном падеже («июнь»). */
  monthLabel: string;
}

/** Вычисленный прогресс: где агент сейчас и сколько до следующей категории. */
export interface MotivationProgress {
  projection: number;
  currentTier: MotivationTier;
  nextTier: MotivationTier | null;
  /** Заполнение полосы внутри текущего «коридора», 0..100. */
  bandPct: number;
  /** Ещё сборов до следующей категории, ₽ (0 — уже максимум). */
  collectionsToNext: number;
}

@Injectable({ providedIn: 'root' })
export class MotivationService {
  private readonly api = inject(ApiClient);

  snapshot(): Observable<ApiResponse<MotivationSnapshot>> {
    return this.api.get<MotivationSnapshot>('/agents/me/motivation');
  }

  /**
   * Чистый расчёт прогресса. `extraPremium` — премия «этой сделки»: добавляется
   * к сборам, чтобы показать, как продажа двигает прогноз к следующей категории.
   */
  progress(s: MotivationSnapshot, extraPremium = 0): MotivationProgress {
    const collections = s.monthCollections + Math.max(0, extraPremium);
    const projection =
      s.daysPassed > 0 ? Math.round((collections / s.daysPassed) * s.daysInMonth) : collections;

    const tiers = [...s.tiers].sort((a, b) => a.minProjection - b.minProjection);
    let currentTier = tiers[0];
    for (const t of tiers) {
      if (projection >= t.minProjection) currentTier = t;
    }
    const nextTier = tiers.find((t) => t.minProjection > projection) ?? null;

    const floor = currentTier.minProjection;
    const ceil = nextTier ? nextTier.minProjection : projection;
    const bandPct = nextTier
      ? Math.min(100, Math.max(0, Math.round(((projection - floor) / (ceil - floor)) * 100)))
      : 100;
    const collectionsToNext = nextTier
      ? Math.max(
          0,
          Math.ceil(((nextTier.minProjection - projection) * s.daysPassed) / s.daysInMonth),
        )
      : 0;

    return { projection, currentTier, nextTier, bandPct, collectionsToNext };
  }
}
