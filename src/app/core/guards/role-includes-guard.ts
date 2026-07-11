import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';

import { Auth } from '../services/auth';

export const roleIncludesGuard: CanActivateFn = (route) => {
  const auth = inject(Auth);
  const router = inject(Router);

  const allowedRoles =
    (route.data?.['allowedRoles'] as string[] | undefined) ||
    (
      route.data?.['roleIncludes']
        ? [route.data['roleIncludes'] as string]
        : []
    );

  if (!allowedRoles.length) {
    return true;
  }

  const hasAccess = allowedRoles.some((allowedRole) =>
    auth.roleIncludes(allowedRole),
  );

  return hasAccess
    ? true
    : router.createUrlTree(['/home']);
};