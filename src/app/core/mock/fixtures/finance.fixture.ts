import {
  type FinanceResults,
  type PayoutAct,
  type PayoutRow,
  type PayoutStatus,
} from '@core/services/finance.service';

import { faker } from './seed';

// ─── «Мои результаты» — мотивационный дашборд (фиксированный снимок периода) ───

export const financeResults: FinanceResults = {
  periodLabel: 'Июнь 2026',
  periodRange: '1 – 14 июня',
  category: 'Серебро',
  nextCategory: 'Золото',
  collected: 184_500,
  nextThreshold: 250_000,
  amountToNext: 65_500,
  dailyToNext: 4_094,
  daysLeft: 16,
  tierLadder: [
    { name: 'Старт', threshold: 0, state: 'done' },
    { name: 'Бронза', threshold: 100_000, state: 'done' },
    { name: 'Серебро', threshold: 180_000, state: 'current' },
    { name: 'Золото', threshold: 250_000, state: 'locked' },
    { name: 'Платина', threshold: 400_000, state: 'locked' },
  ],
  segment: {
    totalCollected: 184_500,
    osagoCount: 47,
    avgAddonCheck: 1_280,
    penetrationPct: 38,
    trends: {
      totalCollected: 12,
      osagoCount: 8,
      avgAddonCheck: -3,
      penetrationPct: 5,
    },
  },
  pool: {
    osagoPoolCount: 12,
    autoHelper: 8,
    reliableTrip: 5,
    reliableTripPlus: 3,
    reliableTripEco: 2,
    poolSharePct: 21,
  },
};

// ─── «К выплате» — начисленное вознаграждение ───

const REWARD_PCTS = [20, 25, 30, 35, 40];
const PREMIUMS = [80, 130, 170, 270, 310, 400, 540, 550, 800, 810, 1200, 1888, 4860];

const CONTRACT_FORMATS: (() => string)[] = [
  () => `001ДМСАЧ${faker.string.numeric(8)}`,
  () => `05-005-${faker.string.numeric(5)}/24НСБЮФ`,
  () => `001SHO-${faker.string.numeric(6)}/2024-AKN`,
  () => `АЮ №109/12-${faker.string.numeric(6)} 09/25/1.1`,
];

function makePayoutRow(): PayoutRow {
  const sex = faker.helpers.arrayElement(['male', 'female'] as const);
  const premium = faker.helpers.arrayElement(PREMIUMS);
  const rewardPct = faker.helpers.arrayElement(REWARD_PCTS);
  return {
    id: faker.string.uuid(),
    policyholder: `${faker.person.lastName(sex)} ${faker.person.firstName(sex)} ${faker.person.middleName(sex)}`,
    contract: faker.helpers.arrayElement(CONTRACT_FORMATS)(),
    rewardPct,
    premium,
    payout: Math.round(((premium * rewardPct) / 100) * 100) / 100,
  };
}

export const payoutRows: PayoutRow[] = Array.from({ length: 14 }, makePayoutRow);

// ─── «История выплат» — акты текущего агента (только свои) ───

const ACT_BASE_DATE = new Date('2026-06-14');
const ACT_START_NUMBER = 22_640;

function makePayoutAct(i: number): PayoutAct {
  const date = new Date(ACT_BASE_DATE);
  date.setDate(date.getDate() - i);
  // Свежие акты ещё готовятся к выплате, более старые — уже выплачены.
  const status: PayoutStatus = i < 3 ? 'preparing' : 'paid';
  const rub = faker.number.int({ min: 400, max: 22_000 });
  const kop = faker.number.int({ min: 0, max: 99 });
  return {
    id: faker.string.uuid(),
    actNumber: String(ACT_START_NUMBER - i).padStart(6, '0'),
    date: date.toISOString().slice(0, 10),
    status,
    amount: rub + kop / 100,
  };
}

export const payoutHistory: PayoutAct[] = Array.from({ length: 18 }, (_, i) => makePayoutAct(i));
