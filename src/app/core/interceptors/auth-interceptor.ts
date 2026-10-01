import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, switchMap, throwError } from 'rxjs';

import { PasswordPolicy } from '../models/password-policy';
import { Auth } from '../services/auth';
import { CriticalRequestService } from '../services/critical-request';

interface PasswordExpiredErrorBody {
  code?: string;
  message?: string;
  passwordPolicy?: PasswordPolicy;
}

const PASSWORD_EXPIRED_CODE = 'PASSWORD_EXPIRED';
const PASSWORD_EXPIRED_MESSAGE =
  'A palavra-passe expirou. Altere-a para continuar a utilizar o CRM.';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const criticalRequests = inject(CriticalRequestService);

  if (auth.isPasswordExpired() && !isAllowedWhilePasswordExpired(req)) {
    void router.navigate(['/change-password'], {
      replaceUrl: true,
    });

    return throwError(
      () =>
        new HttpErrorResponse({
          status: 403,
          statusText: 'Forbidden',
          url: req.url,
          error: {
            code: PASSWORD_EXPIRED_CODE,
            message: PASSWORD_EXPIRED_MESSAGE,
            passwordPolicy: auth.getPasswordPolicy(),
          },
        }),
    );
  }

  const isCriticalRequest = isCriticalMethod(req.method);

  if (isCriticalRequest) {
    criticalRequests.begin();
  }

  const requestWithCredentials = req.clone({
    withCredentials: true,
  });

  const authenticatedRequest = addAccessToken(requestWithCredentials, auth.getAccessToken());

  return next(authenticatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isPasswordExpiredError(error)) {
        const body = error.error as PasswordExpiredErrorBody;

        auth.markPasswordExpired(body.passwordPolicy ?? null);

        void router.navigate(['/change-password'], {
          replaceUrl: true,
        });

        return throwError(() => error);
      }

      const isAuthenticationRequest = isAuthRequest(req.url);

      if (error.status !== 401 || isAuthenticationRequest) {
        return throwError(() => error);
      }

      return auth.refresh().pipe(
        switchMap((newAccessToken) => {
          if (auth.isPasswordExpired()) {
            void router.navigate(['/change-password'], {
              replaceUrl: true,
            });

            return throwError(
              () =>
                new HttpErrorResponse({
                  status: 403,
                  statusText: 'Forbidden',
                  url: req.url,
                  error: {
                    code: PASSWORD_EXPIRED_CODE,
                    message: PASSWORD_EXPIRED_MESSAGE,
                    passwordPolicy: auth.getPasswordPolicy(),
                  },
                }),
            );
          }

          const retriedRequest = addAccessToken(requestWithCredentials, newAccessToken);

          return next(retriedRequest);
        }),

        catchError((refreshError: HttpErrorResponse) => {
          if (auth.isPasswordExpired()) {
            void router.navigate(['/change-password'], {
              replaceUrl: true,
            });

            return throwError(() => refreshError);
          }

          auth.clearSession();

          void router.navigate(['/login'], {
            replaceUrl: true,
          });

          return throwError(() => refreshError);
        }),
      );
    }),
    finalize(() => {
      if (isCriticalRequest) {
        criticalRequests.end();
      }
    }),
  );
};

function addAccessToken(
  request: HttpRequest<unknown>,
  accessToken: string | null,
): HttpRequest<unknown> {
  if (!accessToken) {
    return request;
  }

  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

function isPasswordExpiredError(error: HttpErrorResponse): boolean {
  if (error.status !== 403 || !error.error || typeof error.error !== 'object') {
    return false;
  }

  return (error.error as PasswordExpiredErrorBody).code === PASSWORD_EXPIRED_CODE;
}

function isAllowedWhilePasswordExpired(request: HttpRequest<unknown>): boolean {
  const url = request.url;

  if (url.includes('/api/auth/password')) {
    return request.method.toUpperCase() === 'PATCH';
  }

  return (
    url.includes('/api/auth/logout') ||
    url.includes('/api/auth/logout-all') ||
    url.includes('/api/auth/refresh')
  );
}

function isCriticalMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

function isAuthRequest(url: string): boolean {
  return (
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/signin') ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/logout') ||
    url.includes('/api/auth/logout-all') ||
    url.includes('/api/auth/password')
  );
}
