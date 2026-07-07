import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';

import { Auth } from '../services/auth';

export const roleIncludesGuard: CanActivateFn = (route) => {
  const auth = inject(Auth);
  const router = inject(Router);

  const user = auth.getCurrentUser();

  const role = user?.role || '';

  const allowedRoles =
    (route.data?.['allowedRoles'] as string[] | undefined) ||
    (route.data?.['roleIncludes']
      ? [route.data['roleIncludes'] as string]
      : []);

  if (!allowedRoles.length) {
    return true;
  }

  const hasAccess = allowedRoles.some((allowedRole) =>
    role.toLowerCase().includes(allowedRole.toLowerCase()),
  );

  if (hasAccess) {
    return true;
  }

  return router.createUrlTree(['/home']);
};