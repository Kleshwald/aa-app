import { type HttpRequest, type HttpResponse } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { type ApiResponse } from '@core/models';

import { financeResults, payoutHistory, payoutRows } from '../fixtures/finance.fixture';
import { mockOk } from '../helpers/response';

export function handleGetFinanceResults(
  _req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  return mockOk(financeResults);
}

export function handleGetFinancePayouts(
  _req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  return mockOk(payoutRows, { page: 1, pageSize: payoutRows.length, total: payoutRows.length });
}

// История выплат отдаётся от роли агента — только акты самого агента.
export function handleGetFinanceHistory(
  _req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  return mockOk(payoutHistory, {
    page: 1,
    pageSize: payoutHistory.length,
    total: payoutHistory.length,
  });
}
