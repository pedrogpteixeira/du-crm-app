import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { Auth } from '../services/auth';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  const evaluateAccess = () => {
    const authenticationState = auth.getAuthenticationState();
    const hasAccessToken = auth.getAccessToken() !== null;

    if (authenticationState === 'authenticated' && hasAccessToken) {
      if (auth.isPasswordExpired() && !state.url.startsWith('/change-password')) {
        return router.createUrlTree(['/change-password']);
      }

      return true;
    }

    return router.createUrlTree(['/login'], {
      queryParams: {
        returnUrl: state.url,
        ...(authenticationState === 'recoverable-error' ? { sessionRecovery: 'true' } : {}),
      },
    });
  };

  if (auth.getAuthenticationState() !== 'initializing') {
    return evaluateAccess();
  }

  return auth.initializeAuthentication().pipe(map(() => evaluateAccess()));
};
