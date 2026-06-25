import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

/** Сотрудник агента (штат точки продаж). */
export interface TeamEmployee {
  id: string;
  ikp: string;
  fullName: string;
  phone: string;
  email: string;
  role: string;
  category: string;
  policiesPerMonth: number;
  address: string;
}

/** Субагент, работающий под агентом. */
export interface TeamSubagent {
  id: string;
  ikp: string;
  fullName: string;
  phone: string;
}

/** Команда агента — сотрудники + субагенты (для ИП/ЮЛ со штатом). */
export interface AgentTeam {
  worksWithoutEmployees: boolean;
  employees: TeamEmployee[];
  worksWithoutSubagents: boolean;
  subagents: TeamSubagent[];
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly api = inject(ApiClient);

  team(): Observable<ApiResponse<AgentTeam>> {
    return this.api.get<AgentTeam>('/agents/team');
  }
}
