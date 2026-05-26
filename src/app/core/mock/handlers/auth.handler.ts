import { type HttpRequest, type HttpResponse } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { type ApiResponse } from '@core/models';

import { currentAgent } from '../fixtures/agents.fixture';
import { mockFail, mockOk } from '../helpers/response';

// POST /auth/login — accepts any non-empty login/password to keep the demo open.
// Real authentication will be implemented when the 1C HTTP service is ready.

export function handleLogin(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const body = req.body as { login?: string; password?: string } | null;
  if (!body?.login || !body.password) {
    return mockFail('VALIDATION_ERROR', 'Введите логин и пароль', 401);
  }

  return mockOk({
    token: `mock-jwt-${Date.now()}`,
    refreshToken: `mock-refresh-${Date.now()}`,
    expiresIn: 1800,
    agent: currentAgent,
  });
}

export function handleLogout(): Observable<HttpResponse<ApiResponse<unknown>>> {
  return mockOk({ ok: true });
}

export function handleRefresh(): Observable<HttpResponse<ApiResponse<unknown>>> {
  return mockOk({
    token: `mock-jwt-${Date.now()}`,
    expiresIn: 1800,
  });
}
