import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { canAccessEdp } from '../config/edp-access';
import { Auth } from '../services/auth';

export const edpAccessGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return canAccessEdp(auth.getCurrentUser()) ? true : router.createUrlTree(['/error']);
};
