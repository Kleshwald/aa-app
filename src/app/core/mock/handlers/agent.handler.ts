import { type HttpRequest, type HttpResponse } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { type ApiResponse } from '@core/models';

import { currentAgent } from '../fixtures/agents.fixture';
import { mockOk } from '../helpers/response';

export function handleGetCurrentAgent(
  _req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  return mockOk(currentAgent);
}
