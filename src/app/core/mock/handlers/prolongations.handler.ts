import { type HttpRequest, type HttpResponse } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { type ApiResponse } from '@core/models';

import { prolongationStats, prolongations, rsaSamples } from '../fixtures/prolongations.fixture';
import { mockOk } from '../helpers/response';

export function handleGetProlongations(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const params = req.params;
  const search = (params.get('search') ?? '').toLowerCase();
  const status = params.get('status') ?? '';

  let result = prolongations.slice();
  if (status) result = result.filter((p) => p.status === status);
  if (search) {
    result = result.filter(
      (p) =>
        p.clientName.toLowerCase().includes(search) ||
        p.policyNumber.toLowerCase().includes(search) ||
        p.phone.includes(search),
    );
  }
  return mockOk(result, { page: 1, pageSize: result.length, total: result.length });
}

export function handleGetProlongationStats(
  _req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  return mockOk(prolongationStats);
}

export function handleRsaSearch(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const body = req.body as { name?: string; plate?: string; license?: string } | null;
  // Прототип: возвращаем случайную подвыборку 0-5 строк
  const hasQuery = !!body && (body.name || body.plate || body.license);
  if (!hasQuery) return mockOk([]);

  const size = 2 + Math.floor(Math.random() * 4);
  const slice = rsaSamples.slice(0, size);
  return mockOk(slice);
}
