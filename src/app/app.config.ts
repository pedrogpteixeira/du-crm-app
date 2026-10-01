import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';

import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';

import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';

import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';

import { Auth } from './core/services/auth';
import { SocketService } from './core/services/socket';
import { authInterceptor } from './core/interceptors/auth-interceptor';

import { NotificationService } from './core/services/notification';
import { SystemNoticeService } from './core/services/system-notice';
import { UserService } from './core/services/user';
import { ThemeService } from './core/services/theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    provideZoneChangeDetection({
      eventCoalescing: true,
    }),

    provideRouter(routes, withPreloading(PreloadAllModules)),

    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),

    provideAppInitializer(() => {
      const themeService = inject(ThemeService);
      themeService.applyTheme(themeService.getCurrentTheme());

      const auth = inject(Auth);

      inject(SystemNoticeService);
      inject(SocketService);
      inject(NotificationService);
      inject(UserService);

      return firstValueFrom(auth.initializeAuthentication());
    }),
  ],
};
