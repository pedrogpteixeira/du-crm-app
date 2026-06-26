import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';

import { inject } from '@angular/core';
import { Router } from '@angular/router';

import { catchError, throwError } from 'rxjs';

import { Auth } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);

  const token = auth.getToken();

  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isLoginRequest = req.url.includes('/auth/login');

      if (
        error.status === 401 &&
        !isLoginRequest
      ) {
        auth.logout();

        router.navigate(['/login'], {
          replaceUrl: true,
        });
      }

      return throwError(() => error);
    }),
  );
};