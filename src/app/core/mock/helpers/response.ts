import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { type Observable, of, throwError, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { environment } from '@env/environment';
import { type ApiResponse } from '@core/models';

import { randomDelay } from './delay';

// Wraps a payload into our ApiResponse envelope, adds a realistic delay,
// and occasionally fails to let UI exercise its error states.

export function mockOk<T>(
  data: T,
  meta?: ApiResponse<T>['meta'],
): Observable<HttpResponse<ApiResponse<T>>> {
  const shouldFail = Math.random() < environment.mockErrorRate;
  if (shouldFail) {
    return timer(randomDelay()).pipe(
      mergeMap(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 500,
              statusText: 'Mock random failure',
              error: {
                success: false,
                data: null,
                error: { code: 'MOCK_RANDOM', message: 'Случайная ошибка моков' },
              },
            }),
        ),
      ),
    );
  }
  return timer(randomDelay()).pipe(
    mergeMap(() =>
      of(
        new HttpResponse({
          status: 200,
          body: { success: true, data, error: null, meta: meta ?? null },
        }),
      ),
    ),
  );
}

export function mockFail(
  code: string,
  message: string,
  status = 400,
): Observable<HttpResponse<ApiResponse<never>>> {
  return timer(randomDelay()).pipe(
    mergeMap(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status,
            statusText: code,
            error: { success: false, data: null, error: { code, message } },
          }),
      ),
    ),
  );
}
