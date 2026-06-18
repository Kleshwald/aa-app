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
  url: string;
}

export interface PolicyService {
  id: string;
  /** Термин из 1С (название действия). */
  name: string;
  /** Выгода/подпись под названием («данные, водители, авто»). */
  benefit?: string;
  /** Цена кросс-продукта для показа на карточке («от 500 ₽», «2 450 ₽»). */
  priceLabel?: string;
  available: boolean;
}

export interface PolicyProcessCounters {
  changes: number;
  cancellations: number;
  losses: number;
}

export interface CreatePolicyPayload {
  type: 'OSAGO' | 'NS' | 'TICK' | 'MORTGAGE';
  productName: string;
  premium: number;
  startDate: string;
  endDate: string;
  clientName: string;
  clientPhone: string;
  insuranceCompanyId: string;
  insuranceCompanyName: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleVin?: string;
  vehicleLicensePlate?: string;
}

export interface PolicyDetail {
  id: string;
  number: string;
  type: 'OSAGO' | 'NS' | 'TICK' | 'MORTGAGE';
  productName?: string;
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

  // Водители, допущенные к управлению (ОСАГО). Пусто = без ограничений.
  drivers: string[];

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

  /** Оформление договора после эквайринга. Возвращает id созданного полиса. */
  create(payload: CreatePolicyPayload): Observable<ApiResponse<{ id: string } | null>> {
    return this.api.post<{ id: string } | null>('/policies', payload);
  }
}
