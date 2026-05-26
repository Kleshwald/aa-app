import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

export interface PolicyListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface Policy {
  id: string;
  number: string;
  type: string;
  status: string;
  clientName: string;
  clientPhone: string;
  vehicleVin: string;
  vehicleLicensePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  startDate: string;
  endDate: string;
  premium: number;
  commission: number;
  insuranceCompanyId: string;
  insuranceCompanyName: string;
  agentId: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class PolicyService {
  private readonly api = inject(ApiClient);

  list(query: PolicyListQuery = {}): Observable<ApiResponse<Policy[]>> {
    const params: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params[key] = value as string | number | boolean;
      }
    }
    return this.api.get<Policy[]>('/policies', params);
  }

  get(id: string): Observable<ApiResponse<Policy>> {
    return this.api.get<Policy>(`/policies/${id}`);
  }
}
