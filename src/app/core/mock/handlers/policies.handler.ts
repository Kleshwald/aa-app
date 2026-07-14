import { HttpResponse, type HttpRequest } from '@angular/common/http';
import { type Observable, of, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { type ApiResponse } from '@core/models';

import { currentAgent } from '../fixtures/agents.fixture';
import { type CreatePolicyInput, createPolicy, policies } from '../fixtures/policies.fixture';
import { processes } from '../fixtures/processes.fixture';
import { randomDelay } from '../helpers/delay';
import { mockOk } from '../helpers/response';
import type { PolicyProcess, ProcessStatus } from '@core/services/process.service';

// GET /policies — supports filter, search, sort, pagination per api-contract.yaml.

// «Живые» статусы заявки: только они показываются маркером в строке. `done`/`rejected`
// не показываем — закрытая заявка не «висит» на полисе и не требует агента.
const ACTIVE_PROCESS: readonly ProcessStatus[] = [
  'submitted',
  'checking-docs',
  'in-work',
  'awaiting-docs',
];

/**
 * Активная заявка по полису для маркера в строке. Если их несколько — «ваш ход»
 * (awaiting-docs) важнее прочих; иначе берём свежайшую (processes — newest-first).
 */
function activeProcessFor(policyId: string): PolicyProcess | undefined {
  const own = processes.filter((x) => x.policyId === policyId && ACTIVE_PROCESS.includes(x.status));
  return own.find((x) => x.status === 'awaiting-docs') ?? own[0];
}

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
  const awaitingOnly = params.get('awaitingOnly') === 'true';
  const processFirst = params.get('processFirst') === 'true';

  let result = policies.slice();
  if (status) result = result.filter((p) => p.status === status);
  if (type) result = result.filter((p) => p.type === type);
  if (awaitingOnly) {
    // «Ждут ваших действий» — внимание кросс-периодное: заявка на прошлогоднем полисе
    // обязана найтись, поэтому фильтр периода СОЗНАТЕЛЬНО игнорируется.
    result = result.filter((p) => activeProcessFor(p.id)?.status === 'awaiting-docs');
  } else if (!search) {
    // Поиск (по фамилии/номеру) тоже игнорирует период: клиент звонит спросить статус,
    // а его полис оформлен в мае — при дефолтном «Этот месяц» он бы не нашёлся.
    // Дату применяем ТОЛЬКО когда агент листает список, а не ищет конкретного клиента.
    if (dateFrom) result = result.filter((p) => p.createdAt.slice(0, 10) >= dateFrom);
    if (dateTo) result = result.filter((p) => p.createdAt.slice(0, 10) <= dateTo);
  }
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
  if (processFirst) {
    // Стабильное разбиение: полисы с активной заявкой наверх, порядок внутри — прежний
    // (сортировка выше сохраняется). Это ручной чип, не смена сортировки по умолчанию.
    const withProc = result.filter((p) => activeProcessFor(p.id));
    const rest = result.filter((p) => !activeProcessFor(p.id));
    result = [...withProc, ...rest];
  }

  const total = result.length;
  const offset = (page - 1) * pageSize;
  const slice = result.slice(offset, offset + pageSize).map((p) => {
    const active = activeProcessFor(p.id);
    return {
      ...p,
      ikp: currentAgent.ikp,
      curatorName: currentAgent.curatorName,
      processKind: active?.kind,
      processStatus: active?.status,
      // Дата последнего события заявки — для строки «В работе у страховой с 3 июля».
      processSince: active?.statusHistory[active.statusHistory.length - 1]?.at,
    };
  });

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

  // Process counters — из реальных заявок по договору (не случайные).
  const own = processes.filter((x) => x.policyId === policy.id);
  const processCounters = {
    changes: own.filter((x) => x.kind === 'change').length,
    cancellations: own.filter((x) => x.kind === 'cancel').length,
    losses: own.filter((x) => x.kind === 'loss').length,
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
