import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

export interface DashboardMetrics {
  monthlyEarnings: number;
  monthlyEarningsChange: number;
  activePolicies: number;
  activePoliciesChange: number;
  monthlyRenewals: number;
  urgentRenewals: number;
  conversionRate: number;
  conversionRateChange: number;
}

export interface DashboardPolicy {
  id: string;
  number: string;
  type: string;
  status: string;
  clientName: string;
  startDate: string;
  endDate: string;
  premium: number;
  commission: number;
  insuranceCompanyName: string;
}

export interface UrgentAction {
  id: string;
  type: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentPolicies: DashboardPolicy[];
  urgentActions: UrgentAction[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiClient);

  getDashboard(): Observable<ApiResponse<DashboardData>> {
    return this.api.get<DashboardData>('/dashboard');
  }
}
