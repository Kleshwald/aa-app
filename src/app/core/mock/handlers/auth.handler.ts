import { type HttpRequest, type HttpResponse } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { type ApiResponse } from '@core/models';

import { currentAgent } from '../fixtures/agents.fixture';
import { mockFail, mockOk } from '../helpers/response';

// POST /auth/login — закрытое демо: проверяем фиксированные тестовые креды.
// Логин — номер телефона (сверяем последние 10 цифр, формат не важен),
// пароль — точное совпадение. Реальная авторизация появится с 1С HTTP-сервисом.

const TEST_LOGIN_DIGITS = '9000000000';
const TEST_PASSWORD = 'agent2026';

export function handleLogin(
  req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const body = req.body as { login?: string; password?: string } | null;
  if (!body?.login || !body.password) {
    return mockFail('VALIDATION_ERROR', 'Введите логин и пароль', 401);
  }

  const digits = body.login.replace(/\D/g, '').slice(-10);
  if (digits !== TEST_LOGIN_DIGITS || body.password !== TEST_PASSWORD) {
    return mockFail('AUTH_INVALID', 'Неверный логин или пароль', 401);
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
