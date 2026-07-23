import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';

import {
  provideHttpClient,
  withInterceptors,
  withXhr,
} from '@angular/common/http';

import {
  PreloadAllModules,
  provideRouter,
  withPreloading,
} from '@angular/router';

import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';

import { Auth } from './core/services/auth';
import { SocketService } from './core/services/socket';
import { authInterceptor } from './core/interceptors/auth-interceptor';

import { NotificationService } from './core/services/notification';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    provideZoneChangeDetection({
      eventCoalescing: true,
    }),

    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
    ),

    provideHttpClient(
      withXhr(),
      withInterceptors([
        authInterceptor,
      ]),
    ),

    provideAppInitializer(() => {
      const auth = inject(Auth);
      
      inject(SocketService);
      inject(NotificationService);

      return firstValueFrom(
        auth.initializeAuthentication(),
      );
    }),
  ],
};