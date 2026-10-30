import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Auth } from '../services/auth';

export const emailFeatureGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return auth.roleIncludes('CRM')
    ? true
    : router.createUrlTree(['/error']);
};
