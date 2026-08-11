import { type HttpInterceptorFn, type HttpRequest, type HttpResponse } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { environment } from '@env/environment';
import { type ApiResponse } from '@core/models';

import { handleLogin, handleLogout, handleRefresh } from '../../mock/handlers/auth.handler';
import { handleGetCurrentAgent } from '../../mock/handlers/agent.handler';
import { handleGetTeam } from '../../mock/handlers/team.handler';
import {
  handleCreatePolicy,
  handleGetPolicies,
  handleGetPolicy,
} from '../../mock/handlers/policies.handler';
import {
  handleAddProcessComment,
  handleCreateProcess,
  handleListActiveProcesses,
  handleListAwaitingProcesses,
  handleListPolicyProcesses,
  handleUploadProcessDoc,
} from '../../mock/handlers/processes.handler';
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
import {
  handleAcceptOffer,
  handleAddDealMessage,
  handleCreateDeal,
  handleGetDeal,
  handleGetDeals,
  handleListAwaitingDeals,
  handleReadDealMessages,
  handleRequoteOffer,
} from '../../mock/handlers/deals.handler';
import {
  handleSupportAssign,
  handleSupportEscalate,
  handleSupportNote,
  handleSupportQueue,
  handleSupportReply,
  handleSupportRequest,
  handleSupportStatus,
  handleSupportThread,
  handleSupportThreadAssign,
  handleSupportThreadReply,
} from '../../mock/handlers/support.handler';

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
  { method: 'GET', match: /\/agents\/team$/, handler: handleGetTeam },
  { method: 'POST', match: /\/policies$/, handler: handleCreatePolicy },
  // Заявки по договору — до общего GET /policies/:id (3-сегментные пути).
  { method: 'GET', match: /\/processes\/awaiting$/, handler: handleListAwaitingProcesses },
  { method: 'GET', match: /\/processes\/active$/, handler: handleListActiveProcesses },
  { method: 'POST', match: /\/policies\/[^/]+\/processes$/, handler: handleCreateProcess },
  { method: 'GET', match: /\/policies\/[^/]+\/processes$/, handler: handleListPolicyProcesses },
  { method: 'POST', match: /\/processes\/[^/]+\/comments$/, handler: handleAddProcessComment },
  { method: 'POST', match: /\/processes\/[^/]+\/documents$/, handler: handleUploadProcessDoc },
  { method: 'GET', match: /\/policies\/[^/]+$/, handler: handleGetPolicy },
  { method: 'GET', match: /\/policies(\?.*)?$/, handler: handleGetPolicies },
  { method: 'GET', match: /\/prolongations\/stats$/, handler: handleGetProlongationStats },
  { method: 'GET', match: /\/prolongations(\?.*)?$/, handler: handleGetProlongations },
  { method: 'POST', match: /\/nsis-search$/, handler: handleNsisSearch },
  { method: 'GET', match: /\/finance\/results$/, handler: handleGetFinanceResults },
  { method: 'GET', match: /\/finance\/payouts(\?.*)?$/, handler: handleGetFinancePayouts },
  { method: 'GET', match: /\/finance\/history(\?.*)?$/, handler: handleGetFinanceHistory },
  // Сделки («Согласование») — заявка на оформление ДО появления полиса.
  // /deals/awaiting — раньше общего /deals/:id, иначе «awaiting» съест id.
  { method: 'GET', match: /\/deals\/awaiting$/, handler: handleListAwaitingDeals },
  { method: 'POST', match: /\/deals\/[^/]+\/accept$/, handler: handleAcceptOffer },
  { method: 'POST', match: /\/deals\/[^/]+\/requote$/, handler: handleRequoteOffer },
  { method: 'POST', match: /\/deals\/[^/]+\/messages$/, handler: handleAddDealMessage },
  { method: 'POST', match: /\/deals\/[^/]+\/read$/, handler: handleReadDealMessages },
  { method: 'POST', match: /\/deals$/, handler: handleCreateDeal },
  { method: 'GET', match: /\/deals\/[^/]+$/, handler: handleGetDeal },
  { method: 'GET', match: /\/deals(\?.*)?$/, handler: handleGetDeals },
  // Кокпит поддержки. Действия — раньше общих GET /:id, иначе id съест хвост.
  { method: 'GET', match: /\/support\/queue(\?.*)?$/, handler: handleSupportQueue },
  { method: 'POST', match: /\/support\/requests\/[^/]+\/assign$/, handler: handleSupportAssign },
  { method: 'POST', match: /\/support\/requests\/[^/]+\/reply$/, handler: handleSupportReply },
  { method: 'POST', match: /\/support\/requests\/[^/]+\/note$/, handler: handleSupportNote },
  { method: 'POST', match: /\/support\/requests\/[^/]+\/status$/, handler: handleSupportStatus },
  { method: 'GET', match: /\/support\/requests\/[^/]+$/, handler: handleSupportRequest },
  { method: 'POST', match: /\/support\/threads\/[^/]+\/reply$/, handler: handleSupportThreadReply },
  { method: 'POST', match: /\/support\/threads\/[^/]+\/escalate$/, handler: handleSupportEscalate },
  {
    method: 'POST',
    match: /\/support\/threads\/[^/]+\/assign$/,
    handler: handleSupportThreadAssign,
  },
  { method: 'GET', match: /\/support\/threads\/[^/]+$/, handler: handleSupportThread },
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
