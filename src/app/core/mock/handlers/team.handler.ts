import { type HttpRequest, type HttpResponse } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { type ApiResponse } from '@core/models';

import { agentTeam } from '../fixtures/team.fixture';
import { mockOk } from '../helpers/response';

export function handleGetTeam(
  _req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  return mockOk(agentTeam);
}
