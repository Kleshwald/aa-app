import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

/** Профиль агента (полные данные, в отличие от слим-объекта в AuthService). */
export interface AgentProfile {
  id: string;
  ikp: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: 'male' | 'female';
  region: string;
  district: string;
  legalType: 'individual' | 'ip' | 'sz' | 'ul';
  category: string;
  curatorName: string;
  joinDate: string;
  firstSaleDate: string | null;
  status: 'active' | 'inactive' | 'blocked';
  totalCommission: number;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiClient);

  me(): Observable<ApiResponse<AgentProfile>> {
    return this.api.get<AgentProfile>('/agents/me');
  }
}
