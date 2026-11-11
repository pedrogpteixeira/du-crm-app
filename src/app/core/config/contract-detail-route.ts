import type { ClientContractProvider } from '../services/client';
import { environment } from '../../../environments/environment';
import { IBERDROLA_COMPANY_ID } from '../services/iberdrola-contract';
import { IBERDROLA_SOLAR_COMPANY_ID } from '../services/iberdrola-solar-contract';
import { MEO_ENERGIAS_COMPANY_ID } from '../services/meo-energias-contract';
import { YES_ENERGY_COMPANY_ID } from '../services/yes-energy-contract';
import { VODAFONE_COMPANY_ID } from '../services/vodafone-contract';
import {
  PORTULOGOS_B2B_COMPANY_ID, PORTULOGOS_B2B_CONTRACT_PREFIX,
  EZU_B2B_COMPANY_ID, EZU_B2B_CONTRACT_PREFIX,
  NOSSA_ENERGIA_B2B_COMPANY_ID, NOSSA_ENERGIA_B2B_CONTRACT_PREFIX,
  AUDAX_B2B_COMPANY_ID, AUDAX_B2B_CONTRACT_PREFIX,
  PLENITUDE_B2B_COMPANY_ID, PLENITUDE_B2B_CONTRACT_PREFIX,
  ENDESA_B2B_COMPANY_ID, ENDESA_B2B_CONTRACT_PREFIX,
} from './portulogos-b2b-access';

interface ContractRouteConfig {
  companyId?: string;
  contractIdPrefix?: string;
  companyName: string;
  segment: ClientContractProvider;
}

const CONTRACT_ROUTE_CONFIGS: readonly ContractRouteConfig[] = [
  {
    companyId: environment.REPSOLID,
    companyName: 'Repsol',
    segment: 'repsol',
  },
  {
    companyId: environment.PORTULOGOS_COMPANY_ID,
    companyName: 'Portulogos',
    segment: 'portulogos',
  },
  {
    companyId: PORTULOGOS_B2B_COMPANY_ID,
    contractIdPrefix: PORTULOGOS_B2B_CONTRACT_PREFIX,
    companyName: 'Portulogos B2B',
    segment: 'portulogos-b2b',
  },
  {
    companyId: EZU_B2B_COMPANY_ID,
    contractIdPrefix: EZU_B2B_CONTRACT_PREFIX,
    companyName: 'Ezu B2B',
    segment: 'ezu-b2b',
  },
  {
    companyId: NOSSA_ENERGIA_B2B_COMPANY_ID,
    contractIdPrefix: NOSSA_ENERGIA_B2B_CONTRACT_PREFIX,
    companyName: 'Nossa Energia B2B',
    segment: 'nossa-energia-b2b',
  },
  {
    companyId: AUDAX_B2B_COMPANY_ID,
    contractIdPrefix: AUDAX_B2B_CONTRACT_PREFIX,
    companyName: 'Audax B2B',
    segment: 'audax-b2b',
  },
  {
    companyId: PLENITUDE_B2B_COMPANY_ID,
    contractIdPrefix: PLENITUDE_B2B_CONTRACT_PREFIX,
    companyName: 'Plenitude B2B',
    segment: 'plenitude-b2b',
  },
  {
    companyId: ENDESA_B2B_COMPANY_ID,
    contractIdPrefix: ENDESA_B2B_CONTRACT_PREFIX,
    companyName: 'Endesa B2B',
    segment: 'endesa-b2b',
  },
  {
    companyId: environment.WALLBOX_COMPANY_ID,
    companyName: 'Wallbox',
    segment: 'wallbox',
  },
  {
    companyId: YES_ENERGY_COMPANY_ID,
    companyName: 'Yes Energy',
    segment: 'yes-energy',
  },
  {
    companyId: IBERDROLA_COMPANY_ID,
    companyName: 'Iberdrola',
    segment: 'iberdrola',
  },
  {
    companyId: IBERDROLA_SOLAR_COMPANY_ID,
    companyName: 'Iberdrola Solar',
    segment: 'iberdrola-solar',
  },
  {
    companyId: MEO_ENERGIAS_COMPANY_ID,
    companyName: 'Meo Energias',
    segment: 'meo-energias',
  },
  {
    companyId: VODAFONE_COMPANY_ID,
    companyName: 'Vodafone',
    segment: 'vodafone',
  },
  {
    companyId: environment.GALP_POWER_GAS_COMPANY_ID,
    companyName: 'Galp Power & Gás',
    segment: 'galp-power-gas',
  },
  {
    companyId: environment.GALP_SOLAR_COMPANY_ID,
    companyName: 'Galp Solar',
    segment: 'galp-solar',
  },
];

function resolveContractRouteConfig(
  companyId: string,
  contractId = '',
): ContractRouteConfig | null {
  const companyMatch = CONTRACT_ROUTE_CONFIGS.find(
    (entry) => entry.companyId && entry.companyId === companyId,
  );

  if (companyMatch) {
    return companyMatch;
  }

  if (!contractId) {
    return null;
  }

  return (
    CONTRACT_ROUTE_CONFIGS.find(
      (entry) => entry.contractIdPrefix && contractId.startsWith(entry.contractIdPrefix),
    ) ?? null
  );
}

export function getContractProviderByCompanyId(
  companyId: string,
  contractId = '',
): ClientContractProvider | null {
  return resolveContractRouteConfig(companyId, contractId)?.segment ?? null;
}

export function getContractDetailRoute(companyId: string, contractId: string): string[] | null {
  const config = resolveContractRouteConfig(companyId, contractId);

  if (!config || !contractId) {
    return null;
  }

  return ['/home/contracts', config.segment, contractId];
}

export function getContractDetailRouteByProvider(
  provider: ClientContractProvider,
  contractId: string,
): string[] | null {
  const config = CONTRACT_ROUTE_CONFIGS.find((entry) => entry.segment === provider);

  if (!config || !contractId) {
    return null;
  }

  return ['/home/contracts', config.segment, contractId];
}

export function getContractProviderName(provider: ClientContractProvider): string {
  const config = CONTRACT_ROUTE_CONFIGS.find((entry) => entry.segment === provider);

  return config?.companyName ?? 'Comercializadora desconhecida';
}

export function getContractCompanyName(companyId: string, contractId = ''): string {
  return (
    resolveContractRouteConfig(companyId, contractId)?.companyName ??
    'Comercializadora desconhecida'
  );
}

export function getContractCreateRouteByProvider(
  provider: ClientContractProvider,
): string[] | null {
  const config = CONTRACT_ROUTE_CONFIGS.find((entry) => entry.segment === provider);

  return config ? ['/home/contracts', config.segment, 'create'] : null;
}
