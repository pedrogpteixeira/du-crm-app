import { environment } from '../../../environments/environment';
import type { AuthUser } from '../models/auth-user';

export const PORTULOGOS_B2B_COMPANY_ID = environment.PORTULOGOS_B2B_COMPANY_ID;
export const PORTULOGOS_B2B_TEAM_ID = 'tea_fcEmfBJ92A';
export const PORTULOGOS_B2B_PROVIDER = 'portulogos-b2b' as const;
export const PORTULOGOS_B2B_CONTRACT_PREFIX = 'pbc_';

export function canAccessPortulogosB2B(user: AuthUser | null | undefined): boolean {
  if (!user) {
    return false;
  }

  const role = user.role?.trim().toLowerCase() ?? '';
  if (role.includes('super admin')) {
    return true;
  }

  const teamIds = new Set<string>();

  if (user.defaultTeam?.id) {
    teamIds.add(user.defaultTeam.id);
  }

  for (const team of user.teams ?? []) {
    if (team?.id) {
      teamIds.add(team.id);
    }
  }

  return teamIds.has(PORTULOGOS_B2B_TEAM_ID);
}

export function isPortulogosB2BCompany(companyId: string | null | undefined): boolean {
  return companyId === PORTULOGOS_B2B_COMPANY_ID;
}
