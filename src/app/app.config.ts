import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeRu from '@angular/common/locales/ru';
import {
  type ApplicationConfig,
  LOCALE_ID,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  signal,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { TUI_ICON_RESOLVER, provideTaiga } from '@taiga-ui/core';
import { provideEventPlugins } from '@taiga-ui/event-plugins';
import { TUI_LANGUAGE, TUI_RUSSIAN_LANGUAGE } from '@taiga-ui/i18n';

import { authInterceptor } from '@core/api/interceptors/auth.interceptor';
import { errorInterceptor } from '@core/api/interceptors/error.interceptor';
import { mockInterceptor } from '@core/api/interceptors/mock.interceptor';
import { environment } from '@env/environment';

import { routes } from './app.routes';

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
    provideAnimationsAsync(),
    provideEventPlugins(),
    provideTaiga({ scrollbars: 'native' }),
    { provide: LOCALE_ID, useValue: 'ru-RU' },
    // Иконки Taiga отдаём из локальных ассетов (assets-glob → /taiga-icons).
    // Относительный путь учитывает base-href (и на GitHub Pages под /aa-app/).
    {
      provide: TUI_ICON_RESOLVER,
      useValue: (icon: string): string =>
        icon.startsWith('@tui.') ? `taiga-icons/${icon.slice(5).replaceAll('.', '/')}.svg` : icon,
    },
    { provide: TUI_LANGUAGE, useValue: signal(TUI_RUSSIAN_LANGUAGE) },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
