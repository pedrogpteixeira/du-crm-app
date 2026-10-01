import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';

import { Auth } from '../services/auth';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  const authenticationState = auth.getAuthenticationState();
  const hasAccessToken = auth.getAccessToken() !== null;

  if (authenticationState === 'authenticated' && hasAccessToken) {
    if (auth.isPasswordExpired() && !state.url.startsWith('/change-password')) {
      return router.createUrlTree(['/change-password']);
    }

    return true;
  }

  return router.createUrlTree(['/login']);
};
