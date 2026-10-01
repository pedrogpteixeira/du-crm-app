import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';

import { Auth } from '../services/auth';

export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  const authenticationState = auth.getAuthenticationState();
  const hasAccessToken = auth.getAccessToken() !== null;

  if (authenticationState === 'authenticated' && hasAccessToken) {
    return auth.isPasswordExpired()
      ? router.createUrlTree(['/change-password'])
      : router.createUrlTree(['/home']);
  }

  return true;
};
