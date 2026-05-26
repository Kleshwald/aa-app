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
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  agent: AuthenticatedAgent;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  readonly currentAgent = signal<AuthenticatedAgent | null>(null);

  isAuthenticated(): boolean {
    return !!localStorage.getItem(environment.jwtStorageKey);
  }

  login(payload: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.api.post<LoginResponse>('/auth/login', payload).pipe(
      tap((response) => {
        if (response.success && response.data) {
          localStorage.setItem(environment.jwtStorageKey, response.data.token);
          localStorage.setItem(environment.refreshTokenStorageKey, response.data.refreshToken);
          this.currentAgent.set(response.data.agent);
        }
      }),
    );
  }

  logout(): void {
    localStorage.removeItem(environment.jwtStorageKey);
    localStorage.removeItem(environment.refreshTokenStorageKey);
    this.currentAgent.set(null);
    void this.router.navigate(['/login']);
  }
}
