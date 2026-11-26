import { environment } from '../../../environments/environment';
import type { AuthUser } from '../models/auth-user';

export const EDP_POWER_GAS_COMPANY_ID = environment.EDP_POWER_GAS_COMPANY_ID;
export const EDP_SOLAR_COMPANY_ID = environment.EDP_SOLAR_COMPANY_ID;

export const EDP_POWER_GAS_PROVIDER = 'edp' as const;
export const EDP_SOLAR_PROVIDER = 'edp-solar' as const;

export const EDP_POWER_GAS_CONTRACT_PREFIX = 'epg_';
export const EDP_SOLAR_CONTRACT_PREFIX = 'eps_';

export const EDP_COMPANY_IDS = new Set<string>([
  EDP_POWER_GAS_COMPANY_ID,
  EDP_SOLAR_COMPANY_ID,
]);

export const EDP_PROVIDERS = new Set<string>([
  EDP_POWER_GAS_PROVIDER,
  EDP_SOLAR_PROVIDER,
]);

export function canAccessEdp(user: AuthUser | null | undefined): boolean {
  if (!user) return false;

  const role = user.role?.trim().toLowerCase() ?? '';
  if (!role) return false;

  return role.includes('super admin') || role.includes('edp');
}

export function isEdpCompany(companyId: string | null | undefined): boolean {
  return !!companyId && EDP_COMPANY_IDS.has(companyId);
}

export function isEdpProvider(provider: string | null | undefined): boolean {
  return !!provider && EDP_PROVIDERS.has(provider);
}
