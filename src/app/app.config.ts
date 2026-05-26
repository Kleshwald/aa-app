import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeRu from '@angular/common/locales/ru';
import {
  type ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';

import { environment } from '@env/environment';

import { authInterceptor } from '@core/api/interceptors/auth.interceptor';
import { errorInterceptor } from '@core/api/interceptors/error.interceptor';
import { mockInterceptor } from '@core/api/interceptors/mock.interceptor';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(localeRu, 'ru-RU');

const interceptors = environment.useMocks
  ? [mockInterceptor, authInterceptor, errorInterceptor]
  : [authInterceptor, errorInterceptor];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withInterceptors(interceptors)),
    { provide: LOCALE_ID, useValue: 'ru-RU' },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
