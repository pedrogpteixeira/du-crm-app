import type { ClientContractProvider } from '../services/client';
import { environment } from '../../../environments/environment';
import { IBERDROLA_COMPANY_ID } from '../services/iberdrola-contract';
import { IBERDROLA_SOLAR_COMPANY_ID } from '../services/iberdrola-solar-contract';
import { MEO_ENERGIAS_COMPANY_ID } from '../services/meo-energias-contract';
import { YES_ENERGY_COMPANY_ID } from '../services/yes-energy-contract';

interface ContractRouteConfig {
  companyId: string;
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


export function getContractProviderByCompanyId(
  companyId: string,
): ClientContractProvider | null {
  const config = CONTRACT_ROUTE_CONFIGS.find(
    (entry) => entry.companyId === companyId,
  );

  return config?.segment ?? null;
}

export function getContractDetailRoute(
  companyId: string,
  contractId: string,
): string[] | null {
  const config = CONTRACT_ROUTE_CONFIGS.find(
    (entry) => entry.companyId === companyId,
  );

  if (!config || !contractId) {
    return null;
  }

  return [
    '/home/contracts',
    config.segment,
    contractId,
  ];
}

export function getContractDetailRouteByProvider(
  provider: ClientContractProvider,
  contractId: string,
): string[] | null {
  const config = CONTRACT_ROUTE_CONFIGS.find(
    (entry) => entry.segment === provider,
  );

  if (!config || !contractId) {
    return null;
  }

  return ['/home/contracts', config.segment, contractId];
}

export function getContractProviderName(provider: ClientContractProvider): string {
  const config = CONTRACT_ROUTE_CONFIGS.find(
    (entry) => entry.segment === provider,
  );

  return config?.companyName ?? 'Comercializadora desconhecida';
}

export function getContractCompanyName(companyId: string): string {
  const config = CONTRACT_ROUTE_CONFIGS.find(
    (entry) => entry.companyId === companyId,
  );

  return config?.companyName ?? 'Comercializadora desconhecida';
}
