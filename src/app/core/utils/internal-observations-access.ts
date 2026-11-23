export interface InternalObservationsUserLike {
  role?: string | null;
}

export function canAccessInternalObservations(
  user: InternalObservationsUserLike | null | undefined,
): boolean {
  const role = (user?.role ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-PT');

  return role.includes('super admin') || role === 'du - backoffice';
}
