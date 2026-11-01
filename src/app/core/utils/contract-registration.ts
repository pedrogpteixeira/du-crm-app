import type { ProfileUser } from '../services/user';

export interface ContractRegistrationFields {
  codigoRegistoCE: string;
  nomeRegistoCE: string;
}

/**
 * Resolves the CE registration metadata from the user assigned to a contract.
 * The user's active default team is authoritative; when it is unavailable,
 * the first active team with a valid hierarchy position is used as fallback.
 */
export function resolveContractRegistrationFromUser(
  user: ProfileUser,
): ContractRegistrationFields {
  const availableTeams = (user.teams ?? []).filter(
    (team) =>
      Boolean(team?.id) &&
      Number.isInteger(team.positionIndex) &&
      Number(team.positionIndex) >= 0 &&
      team.active !== false,
  );

  const defaultTeamId = user.defaultTeam?.id;
  const registrationTeam =
    (defaultTeamId
      ? availableTeams.find((team) => team.id === defaultTeamId)
      : undefined) ?? availableTeams[0];

  return {
    codigoRegistoCE:
      registrationTeam?.registrationNumber !== null &&
      registrationTeam?.registrationNumber !== undefined
        ? String(registrationTeam.registrationNumber)
        : '',
    nomeRegistoCE: registrationTeam?.name?.trim() ?? '',
  };
}
