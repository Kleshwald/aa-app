import { type HttpRequest, type HttpResponse } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { type ApiResponse } from '@core/models';

import { currentAgent } from '../fixtures/agents.fixture';
import { policies } from '../fixtures/policies.fixture';
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
  return mockOk(policy ?? null);
}
