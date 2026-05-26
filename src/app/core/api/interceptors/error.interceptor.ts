import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

// Logs HTTP failures and re-throws. UI-level toasts and redirects
// (401 → /login, 5xx → retry banner) will be wired in a later phase
// once the toast service exists.

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        console.error(`[API ${error.status}] ${req.method} ${req.url}`, error.error);
      }
      return throwError(() => error);
    }),
  );
};
