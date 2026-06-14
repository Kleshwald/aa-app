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
  const search = (params.get('search') ?? '').toLowerCase();
  const sortBy = params.get('sortBy') ?? 'createdAt';
  const sortOrder = params.get('sortOrder') ?? 'desc';

  let result = policies.slice();
  if (status) result = result.filter((p) => p.status === status);
  if (type) result = result.filter((p) => p.type === type);
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

  // Mock "addon" policies tied to the same contract (cross-sell of НС при ДТП etc.).
  // Real 1C joins these via parentPolicyId — we just pick a couple from the fixture pool.
  const possibleAddOns = policies
    .filter((p) => p.id !== policy.id && p.type !== policy.type && p.type !== 'OSAGO')
    .slice(0, 2);
  const addOns = policy.type === 'OSAGO' && Math.random() < 0.65 ? possibleAddOns.slice(0, 1) : [];

  // Process counters (история операций по полису).
  const processCounters = {
    changes: Math.random() < 0.15 ? 1 : 0,
    cancellations: 0,
    losses: Math.random() < 0.05 ? 1 : 0,
  };

  // Available downloadable documents. У продуктов «Здоровья» (НС/Антиклещ) —
  // свой пакет: полис, таблица выплат, КИД (ключевой информационный документ).
  const isHealth = policy.type === 'NS' || policy.type === 'TICK';
  const documents = isHealth
    ? [
        { id: 'policy', name: 'Полис', format: 'pdf' as const },
        { id: 'payouts', name: 'Таблица выплат', format: 'pdf' as const },
        { id: 'kid', name: 'КИД', format: 'pdf' as const },
      ]
    : [
        { id: 'policy', name: `Полис ${productLabel(policy.type)}`, format: 'pdf' as const },
        ...addOns.map((a) => ({
          id: `addon-${a.id}`,
          name: `Полис ${productLabel(a.type)}`,
          format: 'pdf' as const,
        })),
        { id: 'application', name: 'Заявление на страхование', format: 'pdf' as const },
      ];

  // Cross-sell services (что ещё можно оформить этому клиенту).
  const services = (
    isHealth
      ? [
          { id: 'tick', name: 'Оформить Антиклещ', available: policy.type !== 'TICK' },
          { id: 'ns-sport', name: 'Оформить НС Спорт', available: true },
        ]
      : [
          { id: 'mini-kasko', name: 'Оформить МиниКАСКО', available: true },
          {
            id: 'ns-dtp',
            name: 'Оформить НС при ДТП',
            available: !addOns.some((a) => a.type === 'NS'),
          },
          { id: 'legal', name: 'Оформить Юрист поможет', available: true },
        ]
  ).filter((s) => s.available);

  return mockOk({
    ...policy,
    ikp: currentAgent.ikp,
    curatorName: currentAgent.curatorName,
    addOns: addOns.map((a) => ({
      id: a.id,
      type: a.type,
      number: a.number,
      premium: a.premium,
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
