import { type HttpInterceptorFn, type HttpRequest, type HttpResponse } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { environment } from '@env/environment';
import { type ApiResponse } from '@core/models';

import { handleLogin, handleLogout, handleRefresh } from '../../mock/handlers/auth.handler';
import { handleGetCurrentAgent } from '../../mock/handlers/agent.handler';
import { handleDashboard } from '../../mock/handlers/dashboard.handler';
import {
  handleCreatePolicy,
  handleGetPolicies,
  handleGetPolicy,
} from '../../mock/handlers/policies.handler';
import {
  handleGetProlongationStats,
  handleGetProlongations,
  handleNsisSearch,
} from '../../mock/handlers/prolongations.handler';
import {
  handleGetFinanceHistory,
  handleGetFinancePayouts,
  handleGetFinanceResults,
} from '../../mock/handlers/finance.handler';

// Maps an incoming request to a mock handler. When useMocks is false
// (staging/prod), the interceptor short-circuits and the request goes
// to the real backend untouched.

type Handler = (req: HttpRequest<unknown>) => Observable<HttpResponse<ApiResponse<unknown>>>;

interface Route {
  method: string;
  match: RegExp;
  handler: Handler;
}

const routes: Route[] = [
  { method: 'POST', match: /\/auth\/login$/, handler: handleLogin },
  { method: 'POST', match: /\/auth\/logout$/, handler: handleLogout },
  { method: 'POST', match: /\/auth\/refresh$/, handler: handleRefresh },
  { method: 'GET', match: /\/agents\/me$/, handler: handleGetCurrentAgent },
  { method: 'GET', match: /\/dashboard$/, handler: handleDashboard },
  { method: 'POST', match: /\/policies$/, handler: handleCreatePolicy },
  { method: 'GET', match: /\/policies\/[^/]+$/, handler: handleGetPolicy },
  { method: 'GET', match: /\/policies(\?.*)?$/, handler: handleGetPolicies },
  { method: 'GET', match: /\/prolongations\/stats$/, handler: handleGetProlongationStats },
  { method: 'GET', match: /\/prolongations(\?.*)?$/, handler: handleGetProlongations },
  { method: 'POST', match: /\/nsis-search$/, handler: handleNsisSearch },
  { method: 'GET', match: /\/finance\/results$/, handler: handleGetFinanceResults },
  { method: 'GET', match: /\/finance\/payouts(\?.*)?$/, handler: handleGetFinancePayouts },
  { method: 'GET', match: /\/finance\/history(\?.*)?$/, handler: handleGetFinanceHistory },
];

export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.useMocks) {
    return next(req);
  }
  const route = routes.find((r) => r.method === req.method && r.match.test(req.url));
  if (!route) {
    console.warn(`[mock] no handler for ${req.method} ${req.url} — falling through`);
    return next(req);
  }
  return route.handler(req) as Observable<HttpResponse<ApiResponse<unknown>>>;
};
