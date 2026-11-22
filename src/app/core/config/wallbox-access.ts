import type { AuthUser } from '../models/auth-user';

export function canAccessWallbox(user: Pick<AuthUser, 'role'> | null | undefined): boolean {
  const role = user?.role?.trim().toLowerCase() ?? '';
  return role.includes('super admin');
}
