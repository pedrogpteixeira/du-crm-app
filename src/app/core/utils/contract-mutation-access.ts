import { environment } from '../../../environments/environment';

export interface ContractTeamMembershipLike {
  id?: string | null;
}

export interface ContractAccessUserLike {
  teams?: readonly ContractTeamMembershipLike[] | null;
  defaultTeam?: ContractTeamMembershipLike | null;
}

const LOCKED_CONTRACT_STATUSES = new Set([
  'ativo',
  'atribuido',
  'anulado',
  'cancelado',
  'cancelada',
  'baixa',
  'parcialmente baixa',
]);

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function getRequiredContractTeamIds(): string[] {
  return [environment.EQUIPA_CRM_ID, environment.EQUIPA_DU_ID].filter(
    (teamId): teamId is string => Boolean(teamId),
  );
}

export function isLockedContractStatus(status: string | null | undefined): boolean {
  return LOCKED_CONTRACT_STATUSES.has(normalizeStatus(status));
}

export function isRequiredContractTeamMember(user: unknown): boolean {
  if (!user || typeof user !== 'object') {
    return false;
  }

  const accessUser = user as ContractAccessUserLike;
  const requiredTeamIds = new Set(getRequiredContractTeamIds());
  const teamIds = [
    accessUser.defaultTeam?.id ?? '',
    ...(accessUser.teams ?? []).map((team) => team.id ?? ''),
  ].filter(Boolean);

  return teamIds.some((teamId) => requiredTeamIds.has(teamId));
}

export function canMutateContractByBusinessRule(
  status: string | null | undefined,
  isRequiredTeamMember: boolean,
): boolean {
  return !isLockedContractStatus(status) || isRequiredTeamMember;
}
