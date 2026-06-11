import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

export interface PolicyAddOn {
  id: string;
  type: 'OSAGO' | 'NS' | 'TICK' | 'MORTGAGE';
  number: string;
  premium: number;
  productLabel: string;
}

export interface PolicyDocument {
  id: string;
  name: string;
  format: 'pdf';
}

export interface PolicyService {
  id: string;
  name: string;
  available: boolean;
}

export interface PolicyProcessCounters {
  changes: number;
  cancellations: number;
  losses: number;
}

export interface PolicyDetail {
  id: string;
  number: string;
  type: 'OSAGO' | 'NS' | 'TICK' | 'MORTGAGE';
  status: 'active' | 'expired' | 'cancelled' | 'pending' | 'processing';
  premium: number;
  commission: number;
  startDate: string;
  endDate: string;
  createdAt: string;

  clientName: string;
  clientPhone: string;

  vehicleVin: string;
  vehicleLicensePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;

  insuranceCompanyId: string;
  insuranceCompanyName: string;

  ikp: string;
  curatorName: string;

  addOns: PolicyAddOn[];
  documents: PolicyDocument[];
  services: PolicyService[];
  processCounters: PolicyProcessCounters;
}

@Injectable({ providedIn: 'root' })
export class ClientDetailService {
  private readonly api = inject(ApiClient);

  get(id: string): Observable<ApiResponse<PolicyDetail | null>> {
    return this.api.get<PolicyDetail | null>(`/policies/${id}`);
  }
}
