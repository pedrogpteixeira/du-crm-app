import { environment } from '../../../environments/environment';
import type { AuthUser } from '../models/auth-user';

export const PORTULOGOS_B2B_COMPANY_ID = environment.PORTULOGOS_B2B_COMPANY_ID;
export const EZU_B2B_COMPANY_ID = environment.EZU_B2B_COMPANY_ID;
export const NOSSA_ENERGIA_B2B_COMPANY_ID = environment.NOSSA_ENERGIA_B2B_COMPANY_ID;
export const AUDAX_B2B_COMPANY_ID = environment.AUDAX_B2B_COMPANY_ID;
export const PLENITUDE_B2B_COMPANY_ID = environment.PLENITUDE_B2B_COMPANY_ID;
export const ENDESA_B2B_COMPANY_ID = environment.ENDESA_B2B_COMPANY_ID;

export const PORTULOGOS_B2B_TEAM_ID = 'tea_fcEmfBJ92A';

export const PORTULOGOS_B2B_PROVIDER = 'portulogos-b2b' as const;
export const EZU_B2B_PROVIDER = 'ezu-b2b' as const;
export const NOSSA_ENERGIA_B2B_PROVIDER = 'nossa-energia-b2b' as const;
export const AUDAX_B2B_PROVIDER = 'audax-b2b' as const;
export const PLENITUDE_B2B_PROVIDER = 'plenitude-b2b' as const;
export const ENDESA_B2B_PROVIDER = 'endesa-b2b' as const;

export const PORTULOGOS_B2B_CONTRACT_PREFIX = 'pbc_';
export const EZU_B2B_CONTRACT_PREFIX = 'ezb_';
export const NOSSA_ENERGIA_B2B_CONTRACT_PREFIX = 'neb_';
export const AUDAX_B2B_CONTRACT_PREFIX = 'adb_';
export const PLENITUDE_B2B_CONTRACT_PREFIX = 'plb_';
export const ENDESA_B2B_CONTRACT_PREFIX = 'enb_';

export const B2B_RESTRICTED_COMPANY_IDS = new Set<string>([
  PORTULOGOS_B2B_COMPANY_ID,
  EZU_B2B_COMPANY_ID,
  NOSSA_ENERGIA_B2B_COMPANY_ID,
  AUDAX_B2B_COMPANY_ID,
  PLENITUDE_B2B_COMPANY_ID,
  ENDESA_B2B_COMPANY_ID,
]);

export const B2B_RESTRICTED_PROVIDERS = new Set<string>([
  PORTULOGOS_B2B_PROVIDER,
  EZU_B2B_PROVIDER,
  NOSSA_ENERGIA_B2B_PROVIDER,
  AUDAX_B2B_PROVIDER,
  PLENITUDE_B2B_PROVIDER,
  ENDESA_B2B_PROVIDER,
]);

export function canAccessB2BContracts(user: AuthUser | null | undefined): boolean {
  if (!user) return false;

  const role = user.role?.trim().toLowerCase() ?? '';
  if (role.includes('super admin')) return true;

  const teamIds = new Set<string>();
  if (user.defaultTeam?.id) teamIds.add(user.defaultTeam.id);
  for (const team of user.teams ?? []) {
    if (team?.id) teamIds.add(team.id);
  }

  return teamIds.has(PORTULOGOS_B2B_TEAM_ID);
}

export function isRestrictedB2BCompany(companyId: string | null | undefined): boolean {
  return !!companyId && B2B_RESTRICTED_COMPANY_IDS.has(companyId);
}

export function isRestrictedB2BProvider(provider: string | null | undefined): boolean {
  return !!provider && B2B_RESTRICTED_PROVIDERS.has(provider);
}

// Backwards-compatible aliases used by the existing Portulogos B2B module.
export function canAccessPortulogosB2B(user: AuthUser | null | undefined): boolean {
  return canAccessB2BContracts(user);
}

export function isPortulogosB2BCompany(companyId: string | null | undefined): boolean {
  return companyId === PORTULOGOS_B2B_COMPANY_ID;
}
