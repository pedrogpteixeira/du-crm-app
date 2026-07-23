import { inject } from '@angular/core';

import {
  CanActivateFn,
  Router,
} from '@angular/router';

import { Auth } from '../services/auth';

export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  const authenticationState =
    auth.getAuthenticationState();

  const currentUser =
    auth.getCurrentUser();

  if (
    authenticationState === 'authenticated' &&
    currentUser
  ) {
    return router.createUrlTree(['/home']);
  }

  return true;
};