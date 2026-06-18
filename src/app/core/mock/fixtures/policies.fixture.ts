import { faker } from './seed';

import { insuranceCompanies } from './insurance-companies.fixture';

type PolicyType = 'OSAGO' | 'NS' | 'TICK' | 'MORTGAGE';
type PolicyStatus = 'active' | 'expired' | 'cancelled' | 'pending' | 'processing';

const CAR_BRANDS = [
  ['ВАЗ', ['2107', '2110', '2114', 'Granta', 'Vesta', 'Niva']],
  ['Toyota', ['Camry', 'Corolla', 'RAV4', 'Land Cruiser']],
  ['Hyundai', ['Solaris', 'Creta', 'Tucson']],
  ['Kia', ['Rio', 'Sportage', 'Cerato']],
  ['Renault', ['Logan', 'Duster', 'Sandero']],
  ['Lada', ['Largus', 'XRAY']],
  ['Nissan', ['Almera', 'Qashqai', 'X-Trail']],
  ['UAZ', ['Patriot', 'Hunter']],
] as const;

export interface PolicyFixture {
  id: string;
  number: string;
  type: PolicyType;
  productName?: string; // витринное имя продукта (напр. «НС Спорт»), если отличается от type
  status: PolicyStatus;
  clientName: string;
  clientPhone: string;
  vehicleVin: string;
  vehicleLicensePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  startDate: string;
  endDate: string;
  premium: number;
  commission: number;
  insuranceCompanyId: string;
  insuranceCompanyName: string;
  agentId: string;
  createdAt: string;
}

function makePolicy(agentId: string): PolicyFixture {
  const company = faker.helpers.arrayElement(insuranceCompanies);
  const [brand, models] = faker.helpers.arrayElement(CAR_BRANDS);
  const model = faker.helpers.arrayElement(models);
  const type: PolicyType = faker.helpers.weightedArrayElement([
    { value: 'OSAGO', weight: 70 },
    { value: 'NS', weight: 15 },
    { value: 'TICK', weight: 8 },
    { value: 'MORTGAGE', weight: 7 },
  ]);
  // Пока используем только два статуса: «Оформлен» (active) и «Черновик» (pending).
  const status: PolicyStatus = faker.helpers.weightedArrayElement([
    { value: 'active', weight: 80 },
    { value: 'pending', weight: 20 },
  ]);
  const created = faker.date.past({ years: 1 });
  const start = faker.date.between({ from: created, to: new Date() });
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  const premium = faker.number.float({ min: 3500, max: 28000, fractionDigits: 2 });
  const commissionRate = faker.number.float({ min: 0.07, max: 0.15 });
  const sex = faker.helpers.arrayElement(['male', 'female'] as const);
  // Серия ОСАГО — всегда «ХХХ» (как у реальных е-полисов и при оформлении).
  const number =
    type === 'OSAGO' ? `ХХХ ${faker.string.numeric(10)}` : `РРР-${faker.string.numeric(8)}`;
  return {
    id: faker.string.uuid(),
    number,
    type,
    status,
    clientName: `${faker.person.lastName(sex)} ${faker.person.firstName(sex)} ${faker.person.middleName(sex)}`,
    clientPhone: `+7${faker.string.numeric(10)}`,
    vehicleVin: faker.vehicle.vin(),
    vehicleLicensePlate: `${faker.string.alpha({ length: 1, casing: 'upper' })}${faker.string.numeric(3)}${faker.string.alpha({ length: 2, casing: 'upper' })}${faker.string.numeric(2)}`,
    vehicleBrand: brand,
    vehicleModel: model,
    vehicleYear: faker.number.int({ min: 2005, max: 2025 }),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    premium: Math.round(premium * 100) / 100,
    commission: Math.round(premium * commissionRate * 100) / 100,
    insuranceCompanyId: company.id,
    insuranceCompanyName: company.shortName,
    agentId,
    createdAt: created.toISOString(),
  };
}

// 100 policies attributed to the current agent for richer demo data.
import { currentAgent } from './agents.fixture';

// Несколько «свежих за сегодня» с разным временем — чтобы фильтр «Сегодня»
// был наглядным и показывал дату + время.
const todayPolicies: PolicyFixture[] = Array.from({ length: 6 }, (_, i): PolicyFixture => {
  const policy = makePolicy(currentAgent.id);
  const created = new Date();
  created.setHours(9 + i, (i * 17) % 60, 0, 0);
  return { ...policy, status: 'active', createdAt: created.toISOString() };
});

export const policies: PolicyFixture[] = [
  ...todayPolicies,
  ...Array.from({ length: 100 }, () => makePolicy(currentAgent.id)),
];

export interface CreatePolicyInput {
  type: PolicyType;
  productName: string;
  premium: number;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;
  clientName: string;
  clientPhone: string;
  insuranceCompanyId: string;
  insuranceCompanyName: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleVin?: string;
  vehicleLicensePlate?: string;
}

/**
 * Создаёт оформленный договор и кладёт его в начало списка (in-memory, на сессию).
 * Используется POST /policies после имитации эквайринга в ОСАГО и «Здоровье».
 */
export function createPolicy(input: CreatePolicyInput): PolicyFixture {
  const year = new Date(input.startDate || new Date().toISOString()).getFullYear();
  const number =
    input.type === 'OSAGO'
      ? `ХХХ ${faker.string.numeric(10)}`
      : `001SHG-${faker.string.numeric(6)}/${year}-AKN`;
  const policy: PolicyFixture = {
    id: faker.string.uuid(),
    number,
    type: input.type,
    productName: input.productName,
    status: 'active',
    clientName: input.clientName || 'Клиент не указан',
    clientPhone: input.clientPhone,
    vehicleVin: input.vehicleVin ?? '',
    vehicleLicensePlate: input.vehicleLicensePlate ?? '',
    vehicleBrand: input.vehicleBrand ?? '',
    vehicleModel: input.vehicleModel ?? '',
    vehicleYear: input.vehicleYear ?? 0,
    startDate: input.startDate,
    endDate: input.endDate,
    premium: Math.round(input.premium * 100) / 100,
    commission: Math.round(input.premium * 0.1 * 100) / 100,
    insuranceCompanyId: input.insuranceCompanyId,
    insuranceCompanyName: input.insuranceCompanyName,
    agentId: currentAgent.id,
    createdAt: new Date().toISOString(),
  };
  policies.unshift(policy);
  return policy;
}
