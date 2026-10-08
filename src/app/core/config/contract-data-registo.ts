import type { GalpPowerGasContractStatus } from '../services/galp-power-gas-contract';
import type { GalpSolarContractStatus } from '../services/galp-solar-contract';
import type { IberdrolaContractStatus } from '../services/iberdrola-contract';
import type { IberdrolaSolarContractStatus } from '../services/iberdrola-solar-contract';
import type { MeoEnergiasContractStatus } from '../services/meo-energias-contract';
import type { PortulogosContractStatus } from '../services/portulogos-contract';
import type { RepsolContractStatus } from '../services/repsol-contract';
import type { WallboxContractStatus } from '../services/wallbox-contract';
import type { YesEnergyContractStatus } from '../services/yes-energy-contract';

export type DataRegistoProvider =
  | 'repsol'
  | 'portulogos'
  | 'galp-power-gas'
  | 'galp-solar'
  | 'wallbox'
  | 'yes-energy'
  | 'iberdrola'
  | 'iberdrola-solar'
  | 'meo-energias';

interface DataRegistoTriggerStateMap {
  repsol: readonly RepsolContractStatus[];
  portulogos: readonly PortulogosContractStatus[];
  'galp-power-gas': readonly GalpPowerGasContractStatus[];
  'galp-solar': readonly GalpSolarContractStatus[];
  wallbox: readonly WallboxContractStatus[];
  'yes-energy': readonly YesEnergyContractStatus[];
  iberdrola: readonly IberdrolaContractStatus[];
  'iberdrola-solar': readonly IberdrolaSolarContractStatus[];
  'meo-energias': readonly MeoEnergiasContractStatus[];
}

export const DATA_REGISTO_TRIGGER_STATES: DataRegistoTriggerStateMap = {
  repsol: ['Atribuído'],
  portulogos: ['Atribuído'],
  'galp-power-gas': ['Registo Plataforma Galp'],
  'galp-solar': ['Proposta enviada'],
  wallbox: ['Registo Plataforma Galp'],
  'yes-energy': ['Pendente (ATR)'],
  iberdrola: ['BackOffice', 'Controle'],
  'iberdrola-solar': ['Proposta Enviada'],
  'meo-energias': ['Registo MEO'],
};

export const DATA_REGISTO_REQUIRED_MESSAGE =
  'A Data de Registo é obrigatória para este estado.';

export function requiresDataRegisto(
  provider: DataRegistoProvider,
  estado: string | null | undefined,
): boolean {
  if (!estado) {
    return false;
  }

  return (DATA_REGISTO_TRIGGER_STATES[provider] as readonly string[]).includes(estado);
}

export function hasDataRegistoValue(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value != null;
}

export function isDataRegistoRequiredError(error: unknown): boolean {
  const codes = collectErrorCodes(error);
  return codes.includes('data-registo-required');
}

function collectErrorCodes(error: unknown): string[] {
  if (!isRecord(error)) {
    return [];
  }

  const codes: string[] = [];
  const directCode = error['code'];

  if (typeof directCode === 'string') {
    codes.push(directCode);
  }

  const nestedError = error['error'];

  if (isRecord(nestedError)) {
    const nestedCode = nestedError['code'];

    if (typeof nestedCode === 'string') {
      codes.push(nestedCode);
    }

    const nestedPayload = nestedError['error'];

    if (isRecord(nestedPayload) && typeof nestedPayload['code'] === 'string') {
      codes.push(nestedPayload['code']);
    }
  }

  return codes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
