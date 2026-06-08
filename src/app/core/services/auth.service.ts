import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { type Observable, tap } from 'rxjs';

import { environment } from '@env/environment';
import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

export interface LoginRequest {
  login: string;
  password: string;
}

export interface AuthenticatedAgent {
  id: string;
  ikp?: string;
  fullName: string;
  email?: string;
  region?: string;
  district?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  agent: AuthenticatedAgent;
}

const AGENT_PROFILE_KEY = 'agent_academy_agent';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  readonly currentAgent = signal<AuthenticatedAgent | null>(this.readStoredAgent());

  isAuthenticated(): boolean {
    return !!localStorage.getItem(environment.jwtStorageKey);
  }

  login(payload: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.api.post<LoginResponse>('/auth/login', payload).pipe(
      tap((response) => {
        if (response.success && response.data) {
          localStorage.setItem(environment.jwtStorageKey, response.data.token);
          localStorage.setItem(environment.refreshTokenStorageKey, response.data.refreshToken);
          localStorage.setItem(AGENT_PROFILE_KEY, JSON.stringify(response.data.agent));
          this.currentAgent.set(response.data.agent);
        }
      }),
    );
  }

  logout(): void {
    localStorage.removeItem(environment.jwtStorageKey);
    localStorage.removeItem(environment.refreshTokenStorageKey);
    localStorage.removeItem(AGENT_PROFILE_KEY);
    this.currentAgent.set(null);
    void this.router.navigate(['/login']);
  }

  private readStoredAgent(): AuthenticatedAgent | null {
    if (!localStorage.getItem(environment.jwtStorageKey)) return null;
    const raw = localStorage.getItem(AGENT_PROFILE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthenticatedAgent;
    } catch {
      return null;
    }
  }
}
