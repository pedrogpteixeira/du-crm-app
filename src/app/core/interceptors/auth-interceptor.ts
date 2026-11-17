import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
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

  const isApiRequest = isBackendApiRequest(req.url);

  if (isApiRequest && auth.isPasswordExpired() && !isAllowedWhilePasswordExpired(req)) {
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

  const isCriticalRequest = isApiRequest && isCriticalMethod(req.method);

  if (isCriticalRequest) {
    criticalRequests.begin();
  }

  const requestForBackend = isApiRequest ? req.clone({ withCredentials: true }) : req;

  const authenticatedRequest =
    !isApiRequest || isPasswordRecoveryRequest(req.url)
      ? requestForBackend
      : addAccessToken(requestForBackend, auth.getAccessToken());

  return next(authenticatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!isApiRequest) {
        return throwError(() => error);
      }

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

          const retriedRequest = addAccessToken(requestForBackend, newAccessToken);

          return next(retriedRequest);
        }),
        catchError((refreshError: HttpErrorResponse) => {
          if (auth.isPasswordExpired()) {
            void router.navigate(['/change-password'], {
              replaceUrl: true,
            });

            return throwError(() => refreshError);
          }

          if (auth.isDefinitiveSessionFailure(refreshError)) {
            auth.clearSession();

            const returnUrl = getRecoverableReturnUrl(router.url);

            void router.navigate(['/login'], {
              replaceUrl: true,
              queryParams: {
                sessionExpired: 'true',
                ...(returnUrl ? { returnUrl } : {}),
              },
            });
          }

          // 409 REFRESH_CONCURRENT esgotado, 403, 429, 5xx e erros de rede
          // não significam uma sessão revogada. O estado local é preservado e
          // um pedido posterior pode tentar recuperar a sessão novamente.
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

  if (isPasswordRecoveryRequest(url)) {
    return request.method.toUpperCase() === 'POST';
  }

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
    isPasswordRecoveryRequest(url) ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/logout') ||
    url.includes('/api/auth/logout-all') ||
    // Uma password atual incorreta pode legitimamente devolver 401. Não
    // transformar esse erro de validação num refresh/logout automático.
    url.includes('/api/auth/password')
  );
}

function isPasswordRecoveryRequest(url: string): boolean {
  return url.includes('/api/auth/forgot-password') || url.includes('/api/auth/reset-password');
}

function isBackendApiRequest(url: string): boolean {
  try {
    const apiOrigin = new URL(environment.apiUrl, window.location.origin).origin;
    const requestUrl = new URL(url, window.location.origin);

    return requestUrl.origin === apiOrigin;
  } catch {
    return url.startsWith(environment.apiUrl) || url.startsWith('/api/');
  }
}

function getRecoverableReturnUrl(currentUrl: string): string | null {
  if (!currentUrl || currentUrl.startsWith('/login')) {
    return null;
  }

  return currentUrl.startsWith('/') ? currentUrl : null;
}
