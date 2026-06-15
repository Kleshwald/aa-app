import { type MotivationSnapshot } from '@core/services/motivation.service';

// ⚠️ МОК. Названия категорий, пороги сборов и КВ% — плейсхолдеры до получения
// реальных чисел из системы мотивации (agentacademy.ru/motivation: точные таблицы
// живут в графике, текстом не отдаются). Логика расчёта — настоящая:
// прогноз = (сборы / прошедшие дни) × дней в месяце; категория = по прогнозу.
export const motivationSnapshot: MotivationSnapshot = {
  tiers: [
    { name: 'Основная', minProjection: 0, kv: 16 },
    { name: 'Стандарт', minProjection: 250_000, kv: 20 },
    { name: 'Профи', minProjection: 350_000, kv: 24 },
    { name: 'Эксперт', minProjection: 500_000, kv: 28 },
    { name: 'Лидер', minProjection: 800_000, kv: 32 },
  ],
  monthCollections: 140_000, // прогноз = 140 000 / 14 × 30 = 300 000 → «Стандарт»
  daysPassed: 14,
  daysInMonth: 30,
  penetration: 93,
  poolShare: 12,
  policiesThisMonth: 38,
  monthLabel: 'июнь',
};
