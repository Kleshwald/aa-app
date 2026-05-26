import { type HttpRequest, type HttpResponse } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { type ApiResponse } from '@core/models';

import { policies } from '../fixtures/policies.fixture';
import { mockOk } from '../helpers/response';

// Mirrors GET /dashboard in api-contract.yaml.

export function handleDashboard(
  _req: HttpRequest<unknown>,
): Observable<HttpResponse<ApiResponse<unknown>>> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyPolicies = policies.filter((p) => new Date(p.createdAt) >= monthStart);
  const monthlyEarnings = monthlyPolicies.reduce((sum, p) => sum + p.commission, 0);
  const activePolicies = policies.filter((p) => p.status === 'active').length;

  const data = {
    metrics: {
      monthlyEarnings: Math.round(monthlyEarnings * 100) / 100,
      monthlyEarningsChange: 8.4,
      activePolicies,
      activePoliciesChange: 3.1,
      monthlyRenewals: 12,
      urgentRenewals: 3,
      conversionRate: 42.7,
      conversionRateChange: -1.2,
    },
    recentPolicies: policies
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        number: p.number,
        type: p.type,
        status: p.status,
        clientName: p.clientName,
        startDate: p.startDate,
        endDate: p.endDate,
        premium: p.premium,
        commission: p.commission,
        insuranceCompanyName: p.insuranceCompanyName,
      })),
    urgentActions: [
      {
        id: '1',
        type: 'prolongation' as const,
        title: 'Пролонгация Петрова И.С. истекает завтра',
        description: 'Полис ОСАГО РРР-12345678',
        dueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        priority: 'high' as const,
      },
      {
        id: '2',
        type: 'client_request' as const,
        title: 'Новое обращение от клиента',
        description: 'Иванова А.С. запросила консультацию',
        dueDate: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        priority: 'medium' as const,
      },
    ],
  };

  return mockOk(data);
}
