import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';

import { inject } from '@angular/core';
import { Router } from '@angular/router';

import {
  catchError,
  switchMap,
  throwError,
} from 'rxjs';

import { Auth } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);

  const requestWithCredentials = req.clone({
    withCredentials: true,
  });

  const authenticatedRequest = addAccessToken(
    requestWithCredentials,
    auth.getAccessToken(),
  );

  return next(authenticatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthenticationRequest =
        isAuthRequest(req.url);

      if (
        error.status !== 401 ||
        isAuthenticationRequest
      ) {
        return throwError(() => error);
      }

      return auth.refresh().pipe(
        switchMap((newAccessToken) => {
          const retriedRequest = addAccessToken(
            requestWithCredentials,
            newAccessToken,
          );

          return next(retriedRequest);
        }),

        catchError((refreshError: HttpErrorResponse) => {
          auth.clearSession();

          router.navigate(['/login'], {
            replaceUrl: true,
          });

          return throwError(() => refreshError);
        }),
      );
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

function isAuthRequest(url: string): boolean {
  return (
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/signin') ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/logout') ||
    url.includes('/api/auth/logout-all')
  );
}