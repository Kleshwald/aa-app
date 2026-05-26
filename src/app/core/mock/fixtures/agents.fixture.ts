import { faker } from './seed';

// Distributions derived from USER_PROFILE.md (914 agent dataset).
// Keep these aligned so demo data matches real audience shape.

const FEMALE_RATIO = 0.68;
const SIBERIAN_REGIONS = [
  'Красноярский край',
  'Иркутская обл',
  'Новосибирская обл',
  'Алтайский край',
  'Забайкальский край',
  'Респ Башкортостан',
  'Амурская обл',
  'Кемеровская область',
  'Свердловская обл',
  'Приморский край',
  'Респ Бурятия',
  'Омская обл',
  'Респ Хакасия',
  'Хабаровский край',
  'Респ Саха (Якутия)',
];

const LEGAL_TYPES = [
  { value: 'individual', weight: 0.518 },
  { value: 'ip', weight: 0.283 },
  { value: 'sz', weight: 0.139 },
  { value: 'ul', weight: 0.031 },
] as const;

type LegalType = (typeof LEGAL_TYPES)[number]['value'];

function pickWeighted<T extends { value: string; weight: number }>(
  items: readonly T[],
): T['value'] {
  const total = items.reduce((acc, x) => acc + x.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    if (roll < item.weight) return item.value;
    roll -= item.weight;
  }
  return items[items.length - 1].value;
}

export interface AgentFixture {
  id: string;
  ikp: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string; // YYYY-MM-DD
  gender: 'male' | 'female';
  region: string;
  district: string;
  legalType: LegalType;
  category: string;
  curatorName: string;
  joinDate: string;
  firstSaleDate: string | null;
  status: 'active' | 'inactive' | 'blocked';
  totalCommission: number;
}

function makeAgent(): AgentFixture {
  const isFemale = faker.number.float() < FEMALE_RATIO;
  const sex = isFemale ? 'female' : 'male';
  const birth = faker.date.birthdate({ min: 25, max: 70, mode: 'age' });
  const join = faker.date.past({ years: 10 });
  return {
    id: faker.string.uuid(),
    ikp: faker.string.numeric(5),
    fullName: `${faker.person.lastName(sex)} ${faker.person.firstName(sex)} ${faker.person.middleName(sex)}`,
    email: faker.internet.email().toLowerCase(),
    phone: `+7${faker.string.numeric(10)}`,
    birthDate: birth.toISOString().slice(0, 10),
    gender: sex,
    region: faker.helpers.arrayElement(SIBERIAN_REGIONS),
    district: faker.location.city(),
    legalType: pickWeighted(LEGAL_TYPES),
    category: `Категория ${faker.number.int({ min: 1, max: 5 })}`,
    curatorName: `${faker.person.lastName('female')} ${faker.person.firstName('female')} ${faker.person.middleName('female')}`,
    joinDate: join.toISOString().slice(0, 10),
    firstSaleDate:
      Math.random() < 0.85
        ? faker.date.between({ from: join, to: new Date() }).toISOString().slice(0, 10)
        : null,
    status: 'active',
    totalCommission: faker.number.int({ min: 0, max: 1_500_000 }),
  };
}

// One canonical "current agent" plus a small pool for lists/search.
export const currentAgent: AgentFixture = makeAgent();
export const agents: AgentFixture[] = [currentAgent, ...Array.from({ length: 50 }, makeAgent)];
