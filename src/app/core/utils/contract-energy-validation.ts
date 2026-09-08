import {
  DEFAULT_CPE_PREFIX,
  DEFAULT_CUI_PREFIX,
} from '../constants/contract-energy-options';

export interface ContractEnergyValidationInput {
  requiresElectricity: boolean;
  requiresGas: boolean;
  cpe?: unknown;
  cui?: unknown;
  potencia?: unknown;
  escalao?: unknown;
  cicloHorario?: unknown;
}

function normalizeValue(value: unknown): string {
  return String(value ?? '').trim();
}

export function getContractEnergyValidationError(
  input: ContractEnergyValidationInput,
): string | null {
  if (input.requiresElectricity) {
    const cpe = normalizeValue(input.cpe);

    if (!cpe || cpe === DEFAULT_CPE_PREFIX) {
      return 'O CPE é obrigatório para contratos com Luz.';
    }

    if (!normalizeValue(input.potencia)) {
      return 'A Potência é obrigatória para contratos com Luz.';
    }

    if (!normalizeValue(input.cicloHorario)) {
      return 'O Ciclo Horário é obrigatório para contratos com Luz.';
    }
  }

  if (input.requiresGas) {
    const cui = normalizeValue(input.cui);

    if (!cui || cui === DEFAULT_CUI_PREFIX) {
      return 'O CUI é obrigatório para contratos com Gás.';
    }

    if (!normalizeValue(input.escalao)) {
      return 'O Escalão é obrigatório para contratos com Gás.';
    }
  }

  return null;
}
