import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

export type ProlongationStatus = 'issued' | 'calculated' | 'declined' | 'not-renewed';
export type RsaStatus = 'renewed' | 'expiring-soon' | 'expired';

export interface ProlongationRow {
  id: string;
  ikp: string;
  clientName: string;
  vehicleBrand: string;
  vehicleModel: string;
  policyNumber: string;
  endDate: string;
  insuranceCompanyName: string;
  lastYearPrice: number;
  phone: string;
  status: ProlongationStatus;
}

export interface RsaSearchRow extends Omit<ProlongationRow, 'status'> {
  rsaStatus: RsaStatus;
}

export interface ProlongationStats {
  totalToRenew: number;
  calculated: number;
  issued: number;
  renewalRatePct: number;
}

export interface RsaSearchQuery {
  name?: string;
  plate?: string;
  license?: string;
}

@Injectable({ providedIn: 'root' })
export class ProlongationService {
  private readonly api = inject(ApiClient);

  list(
    query: { search?: string; status?: string } = {},
  ): Observable<ApiResponse<ProlongationRow[]>> {
    const params: Record<string, string> = {};
    if (query.search) params['search'] = query.search;
    if (query.status) params['status'] = query.status;
    return this.api.get<ProlongationRow[]>('/prolongations', params);
  }

  stats(): Observable<ApiResponse<ProlongationStats>> {
    return this.api.get<ProlongationStats>('/prolongations/stats');
  }

  searchRsa(query: RsaSearchQuery): Observable<ApiResponse<RsaSearchRow[]>> {
    return this.api.post<RsaSearchRow[]>('/rsa-search', query);
  }
}
