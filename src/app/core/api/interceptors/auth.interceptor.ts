import { type HttpInterceptorFn } from '@angular/common/http';

import { environment } from '@env/environment';

// Attach the bearer token (if present) to every outgoing request.
// Login and refresh endpoints are excluded.

const PUBLIC_PATHS = ['/auth/login', '/auth/refresh'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (PUBLIC_PATHS.some((path) => req.url.includes(path))) {
    return next(req);
  }
  const token = localStorage.getItem(environment.jwtStorageKey);
  if (!token) {
    return next(req);
  }
  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(authReq);
};
