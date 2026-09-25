export interface ContractRegistrationTeamLike {
  id: string;
  name?: string | null;
  registrationNumber?: string | number | null;
}

export interface ContractRegistrationFields {
  codigoRegistoCE: string;
  nomeRegistoCE: string;
}

const ADMIN_GERAL_REGISTRATION: ContractRegistrationFields = {
  codigoRegistoCE: '2',
  nomeRegistoCE: 'Equipa Admin Geral',
};

/**
 * Resolve the CE registration metadata used when creating contracts in light mode.
 *
 * The first user-selected team that is not one of the mandatory visibility teams wins.
 * When the contract only contains mandatory teams, the Admin Geral registration is used.
 */
export function resolveLightContractRegistration(
  selectedTeamIds: readonly string[],
  availableTeams: readonly ContractRegistrationTeamLike[],
  requiredTeamIds: readonly string[],
): ContractRegistrationFields {
  const requiredTeamIdsSet = new Set(requiredTeamIds.filter(Boolean));

  for (const teamId of selectedTeamIds) {
    if (requiredTeamIdsSet.has(teamId)) {
      continue;
    }

    const team = availableTeams.find((availableTeam) => availableTeam.id === teamId);

    if (!team) {
      continue;
    }

    return {
      codigoRegistoCE:
        team.registrationNumber !== null && team.registrationNumber !== undefined
          ? String(team.registrationNumber)
          : '',
      nomeRegistoCE: team.name?.trim() ?? '',
    };
  }

  return { ...ADMIN_GERAL_REGISTRATION };
}
