import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

// Page renders a list of policies under the «Мои клиенты» heading.
// The underlying entity is still a Policy (per api-contract.yaml).
// Russian label mismatch intentional — agents are used to «клиенты» from current 1C.

export interface ClientRow {
  id: string;
  ikp: string;
  number: string;
  createdAt: string;
  curatorName: string;
  clientName: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleLicensePlate: string;
  type: 'OSAGO' | 'NS' | 'TICK' | 'MORTGAGE';
  status: 'active' | 'expired' | 'cancelled' | 'pending' | 'processing';
  premium: number;
  insuranceCompanyName: string;
}

export interface ClientsQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
  insuranceCompanyId?: string;
  search?: string;
  period?: 'this-month' | 'this-quarter' | 'this-year' | 'all';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly api = inject(ApiClient);

  list(query: ClientsQuery = {}): Observable<ApiResponse<ClientRow[]>> {
    const params: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params[key] = value as string | number | boolean;
      }
    }
    return this.api.get<ClientRow[]>('/policies', params);
  }
}
