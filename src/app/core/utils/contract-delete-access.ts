interface ContractDeleteUserLike {
  role?: string | null;
}

export function hasSuperAdminContractDeleteAccess(
  user: ContractDeleteUserLike | null | undefined,
): boolean {
  return (user?.role ?? '').trim().toLowerCase().includes('super admin');
}
