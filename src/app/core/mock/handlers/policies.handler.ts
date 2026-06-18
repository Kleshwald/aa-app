import { HttpResponse, type HttpRequest } from '@angular/common/http';
import { type Observable, of, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { type ApiResponse } from '@core/models';

import { currentAgent } from '../fixtures/agents.fixture';
import { type CreatePolicyInput, createPolicy, policies } from '../fixtures/policies.fixture';
import { randomDelay } from '../helpers/delay';
import { mockOk } from '../helpers/response';

// GET /policies — supports filter, search, sort, pagination per api-contract.yaml.

export function handleGetPolicies(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const params = req.params;
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('pageSize') ?? 20);
  const status = params.get('status');
  const type = params.get('type');
  const dateFrom = params.get('dateFrom');
  const dateTo = params.get('dateTo');
  const search = (params.get('search') ?? '').toLowerCase();
  const sortBy = params.get('sortBy') ?? 'createdAt';
  const sortOrder = params.get('sortOrder') ?? 'desc';

  let result = policies.slice();
  if (status) result = result.filter((p) => p.status === status);
  if (type) result = result.filter((p) => p.type === type);
  // Фильтр по дате оформления (createdAt — ISO datetime; сравниваем по дню).
  if (dateFrom) result = result.filter((p) => p.createdAt.slice(0, 10) >= dateFrom);
  if (dateTo) result = result.filter((p) => p.createdAt.slice(0, 10) <= dateTo);
  if (search) {
    result = result.filter(
      (p) =>
        p.clientName.toLowerCase().includes(search) ||
        p.number.toLowerCase().includes(search) ||
        p.vehicleLicensePlate.toLowerCase().includes(search),
    );
  }
  const direction = sortOrder === 'asc' ? 1 : -1;
  result.sort((a, b) => {
    const av = (a as unknown as Record<string, string | number>)[sortBy];
    const bv = (b as unknown as Record<string, string | number>)[sortBy];
    if (av === bv) return 0;
    return av < bv ? -direction : direction;
  });

  const total = result.length;
  const offset = (page - 1) * pageSize;
  const slice = result.slice(offset, offset + pageSize).map((p) => ({
    ...p,
    ikp: currentAgent.ikp,
    curatorName: currentAgent.curatorName,
  }));

  return mockOk(slice, { page, pageSize, total });
}

export function handleGetPolicy(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const id = req.url.split('/').pop();
  const policy = policies.find((p) => p.id === id);
  if (!policy) return mockOk(null);

  // Mock "addon" policies в составе договора ОСАГО — только реальные кроссы
  // (НС при ДТП). Ипотеку/клеща в примеры НЕ берём — это не кроссы к ОСАГО.
  const possibleAddOns = policies.filter((p) => p.id !== policy.id && p.type === 'NS').slice(0, 2);
  const addOns = policy.type === 'OSAGO' && Math.random() < 0.65 ? possibleAddOns.slice(0, 1) : [];

  // Водители ОСАГО: страхователь + 0–2 других (из пула клиентов). Для не-ОСАГО — пусто.
  const driverPool = policies
    .filter((p) => p.id !== policy.id && p.clientName !== policy.clientName)
    .map((p) => p.clientName);
  const driverCount = 1 + Math.floor(Math.random() * 3); // 1..3
  const drivers =
    policy.type === 'OSAGO' ? [policy.clientName, ...driverPool].slice(0, driverCount) : [];

  // Process counters (история операций по полису).
  const processCounters = {
    changes: Math.random() < 0.15 ? 1 : 0,
    cancellations: 0,
    losses: Math.random() < 0.05 ? 1 : 0,
  };

  // Available downloadable documents. У продуктов «Здоровья» (НС/Антиклещ) —
  // свой пакет: полис, таблица выплат, КИД (ключевой информационный документ).
  // Демо-файлы для прототипа (реальных PDF/бэкенда нет): полис и доп.
  const POLIS_PDF = 'docs/polis-osago-demo.pdf';
  const DOP_PDF = 'docs/dop-demo.pdf';
  const isHealth = policy.type === 'NS' || policy.type === 'TICK';
  const documents = isHealth
    ? [
        { id: 'policy', name: 'Полис', format: 'pdf' as const, url: POLIS_PDF },
        { id: 'payouts', name: 'Таблица выплат', format: 'pdf' as const, url: DOP_PDF },
        { id: 'kid', name: 'КИД', format: 'pdf' as const, url: DOP_PDF },
      ]
    : [
        {
          id: 'policy',
          name: `Полис ${productLabel(policy.type)}`,
          format: 'pdf' as const,
          url: POLIS_PDF,
        },
        ...addOns.map((a) => ({
          id: `addon-${a.id}`,
          name: `Полис ${productLabel(a.type)}`,
          format: 'pdf' as const,
          url: DOP_PDF,
        })),
        {
          id: 'application',
          name: 'Заявление на страхование',
          format: 'pdf' as const,
          url: DOP_PDF,
        },
      ];

  // Cross-sell services (что ещё можно предложить клиенту). priceLabel —
  // цены допов из ADD_ON_PRESETS (osago): МиниКАСКО 2 450 ₽, Юрист от 500 ₽,
  // НС при ДТП от 800 ₽. Для «Здоровья» — свои разумные подписи.
  const services = (
    isHealth
      ? [
          {
            id: 'tick',
            name: 'Антиклещ',
            benefit: 'защита от укуса клеща',
            priceLabel: 'от 350 ₽',
            available: policy.type !== 'TICK',
          },
          {
            id: 'ns-sport',
            name: 'НС Спорт',
            benefit: 'травмы на тренировках и соревнованиях',
            priceLabel: 'от 900 ₽',
            available: true,
          },
        ]
      : [
          {
            id: 'legal',
            name: 'Юрист поможет',
            benefit: 'споры по ДТП и выплатам',
            priceLabel: 'от 500 ₽',
            available: true,
          },
          {
            id: 'ns-dtp',
            name: 'НС при ДТП',
            benefit: 'защита водителя и пассажиров',
            priceLabel: 'от 800 ₽',
            available: !addOns.some((a) => a.type === 'NS'),
          },
          {
            id: 'mini-kasko',
            name: 'МиниКАСКО',
            benefit: 'ремонт без полного КАСКО',
            priceLabel: '2 450 ₽',
            available: true,
          },
        ]
  ).filter((s) => s.available);

  return mockOk({
    ...policy,
    ikp: currentAgent.ikp,
    curatorName: currentAgent.curatorName,
    drivers,
    addOns: addOns.map((a) => ({
      id: a.id,
      type: a.type,
      number: a.number,
      // Цена допа = как у кросса к ОСАГО (НС при ДТП ~1000 ₽), а не полная
      // премия случайного НС-полиса (та давала «странную» цену 3500–28000).
      premium: 1000,
      productLabel: productLabel(a.type),
    })),
    processCounters,
    documents,
    services,
  });
}

// POST /policies — оформление договора после эквайринга. Гарантированный успех
// (без random-fail из mockOk), т.к. это критичный путь демо: оформил → открыли договор.
export function handleCreatePolicy(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const body = (req.body ?? {}) as Partial<CreatePolicyInput>;
  const policy = createPolicy({
    type: body.type ?? 'NS',
    productName: body.productName ?? '',
    premium: body.premium ?? 0,
    startDate: body.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: body.endDate ?? '',
    clientName: body.clientName ?? '',
    clientPhone: body.clientPhone ?? '',
    insuranceCompanyId: body.insuranceCompanyId ?? '',
    insuranceCompanyName: body.insuranceCompanyName ?? '',
    vehicleBrand: body.vehicleBrand,
    vehicleModel: body.vehicleModel,
    vehicleYear: body.vehicleYear,
    vehicleVin: body.vehicleVin,
    vehicleLicensePlate: body.vehicleLicensePlate,
  });
  return timer(randomDelay()).pipe(
    mergeMap(() =>
      of(
        new HttpResponse({
          status: 201,
          body: { success: true, data: { id: policy.id }, error: null, meta: null },
        }),
      ),
    ),
  );
}

function productLabel(type: 'OSAGO' | 'NS' | 'TICK' | 'MORTGAGE'): string {
  switch (type) {
    case 'OSAGO':
      return 'ОСАГО';
    case 'NS':
      return 'НС при ДТП';
    case 'TICK':
      return 'Антиклещ';
    case 'MORTGAGE':
      return 'Ипотека';
  }
}
