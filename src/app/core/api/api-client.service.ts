import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { environment } from '@env/environment';
import { type ApiResponse } from '@core/models';

// Single HTTP entry point. Components never call HttpClient directly —
// they go through a domain service, which goes through this client.
// See ARCHITECTURE.md "API-слой".

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(
    endpoint: string,
    params?: HttpParams | Record<string, string | number | boolean>,
  ): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(this.url(endpoint), { params: this.toParams(params) });
  }

  post<T>(endpoint: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(this.url(endpoint), body);
  }

  put<T>(endpoint: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(this.url(endpoint), body);
  }

  patch<T>(endpoint: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(this.url(endpoint), body);
  }

  delete<T>(endpoint: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(this.url(endpoint));
  }

  private url(endpoint: string): string {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${path}`;
  }

  private toParams(
    params?: HttpParams | Record<string, string | number | boolean>,
  ): HttpParams | undefined {
    if (!params) return undefined;
    if (params instanceof HttpParams) return params;
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }
}
