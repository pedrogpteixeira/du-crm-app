import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';

import {
  catchError,
  map,
  of,
} from 'rxjs';

import { Auth } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!auth.hasToken()) {
    return router.createUrlTree(['/login']);
  }

  // O utilizador já foi carregado nesta sessão Angular.
  if (auth.getCurrentUser()) {
    return true;
  }

  // Num refresh ou novo separador, o BehaviorSubject começa a null.
  // Carregamos o utilizador antes de permitir a ativação das rotas filhas.
  return auth.loadCurrentUser().pipe(
    map(() => true),

    catchError(() => {
      auth.logout();

      return of(
        router.createUrlTree(['/login']),
      );
    }),
  );
};