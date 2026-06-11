import { faker } from './seed';
import { insuranceCompanies } from './insurance-companies.fixture';

// «Прошлогодние полисы», которые агент может пролонгировать.
// Колонки и цветовые статусы — как в текущей 1С (см. скриншот).
//
// status — для вкладки «Мои пролонгации»:
//   issued       Оформлено        зелёный фон
//   calculated   Рассчитано       жёлтый фон
//   declined     Отказ клиента    розовый фон
//   not-renewed  Не продлён       бледно-розовый фон
//
// rsaStatus — для вкладки «Поиск по базе РСА»:
//   renewed         Продлён            зелёный
//   expiring-soon   10 дней до окончания  жёлтый
//   expired         Просрочен          красный

export type ProlongationStatus = 'issued' | 'calculated' | 'declined' | 'not-renewed';
export type RsaStatus = 'renewed' | 'expiring-soon' | 'expired';

const CAR_MAKES = [
  ['KIA', ['Rio', 'Sportage', 'Cerato']],
  ['Hyundai', ['Solaris', 'Creta', 'Tucson']],
  ['Toyota', ['RAV4', 'Camry', 'Corolla']],
  ['VW', ['Polo', 'Tiguan', 'Passat']],
  ['Skoda', ['Octavia', 'Rapid', 'Karoq']],
  ['Nissan', ['Qashqai', 'X-Trail', 'Almera']],
  ['Mitsubishi', ['Outlander', 'ASX']],
  ['Renault', ['Duster', 'Logan', 'Kaptur']],
  ['Lada', ['Vesta', 'Granta', 'Largus']],
  ['Mazda', ['CX-5', 'CX-30', '3']],
] as const;

const STATUS_WEIGHTS: { value: ProlongationStatus; weight: number }[] = [
  { value: 'issued', weight: 35 },
  { value: 'calculated', weight: 30 },
  { value: 'declined', weight: 12 },
  { value: 'not-renewed', weight: 23 },
];

const RSA_STATUS_WEIGHTS: { value: RsaStatus; weight: number }[] = [
  { value: 'renewed', weight: 50 },
  { value: 'expiring-soon', weight: 30 },
  { value: 'expired', weight: 20 },
];

export interface ProlongationRow {
  id: string;
  ikp: string;
  clientName: string;
  vehicleBrand: string;
  vehicleModel: string;
  policyNumber: string;
  endDate: string;
  insuranceCompanyName: string;
  lastYearPrice: number;
  phone: string;
  status: ProlongationStatus;
}

export interface RsaSearchRow extends Omit<ProlongationRow, 'status'> {
  rsaStatus: RsaStatus;
}

function makeBase(): Omit<ProlongationRow, 'status'> {
  const sex = faker.helpers.weightedArrayElement([
    { value: 'female' as const, weight: 68 },
    { value: 'male' as const, weight: 32 },
  ]);
  const [brand, models] = faker.helpers.arrayElement(CAR_MAKES);
  const model = faker.helpers.arrayElement(models);
  const company = faker.helpers.arrayElement(insuranceCompanies);
  const endDate = faker.date.between({
    from: new Date(Date.now() - 60 * 24 * 3600 * 1000),
    to: new Date(Date.now() + 60 * 24 * 3600 * 1000),
  });

  return {
    id: faker.string.uuid(),
    ikp: faker.string.numeric(5),
    clientName: `${faker.person.lastName(sex)} ${faker.person.firstName(sex)} ${faker.person.middleName(sex)}`,
    vehicleBrand: brand,
    vehicleModel: model,
    policyNumber: `001ДМСА${faker.string.numeric(6)}`,
    endDate: endDate.toISOString().slice(0, 10),
    insuranceCompanyName: company.shortName,
    lastYearPrice: faker.helpers.arrayElement([540, 810, 1080, 1888, 4860, 8100, 27000]),
    phone: `+7 (${faker.string.numeric(3)}) ${faker.string.numeric(3)} ${faker.string.numeric(2)} ${faker.string.numeric(2)}`,
  };
}

export const prolongations: ProlongationRow[] = Array.from({ length: 50 }, () => ({
  ...makeBase(),
  status: faker.helpers.weightedArrayElement(STATUS_WEIGHTS),
}));

export const rsaSamples: RsaSearchRow[] = Array.from({ length: 12 }, () => ({
  ...makeBase(),
  rsaStatus: faker.helpers.weightedArrayElement(RSA_STATUS_WEIGHTS),
}));

// Aggregated motivational metrics (top dashboard on the «Мои пролонгации» tab).
// Numbers from screenshot kept as feels — agent sees their portfolio scale.
export const prolongationStats = {
  totalToRenew: 12_438,
  calculated: 9_842,
  issued: 6_231,
  renewalRatePct: 63,
};
