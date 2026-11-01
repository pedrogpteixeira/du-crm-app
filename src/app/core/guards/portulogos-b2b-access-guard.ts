import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { canAccessPortulogosB2B } from '../config/portulogos-b2b-access';
import { Auth } from '../services/auth';

export const portulogosB2BAccessGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return canAccessPortulogosB2B(auth.getCurrentUser()) ? true : router.createUrlTree(['/error']);
};
