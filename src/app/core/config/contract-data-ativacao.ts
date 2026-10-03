export interface EnergyActivationDateValidation {
  isActiveState: boolean;
  isDual: boolean;
  requireCpe: boolean;
  requireCui: boolean;
  cpeResolved: boolean;
  cuiResolved: boolean;
  missingCpe: boolean;
  missingCui: boolean;
  missingActiveSupply: boolean;
  valid: boolean;
  message: string | null;
}

export interface SimpleActivationDateValidation {
  required: boolean;
  missing: boolean;
  valid: boolean;
  message: string | null;
}

export const DATA_ATIVACAO_CPE_REQUIRED_MESSAGE =
  'A Data de Ativação do CPE é obrigatória para este estado.';

export const DATA_ATIVACAO_CUI_REQUIRED_MESSAGE =
  'A Data de Ativação do CUI é obrigatória para este estado.';

export const DATA_ATIVACAO_REQUIRED_MESSAGE =
  'A Data de Ativação é obrigatória ao alterar o estado para Ativo.';


export const DATA_ATIVACAO_DUAL_ACTIVE_REQUIRED_MESSAGE =
  'Para colocar o contrato como Ativo, pelo menos um dos fornecimentos deve ter uma Data de Ativação.';

export const DATA_ATIVACAO_DUAL_PARTIAL_REQUIRED_MESSAGE =
  'Para colocar um contrato Luz + Gás como Parcialmente Baixa, é obrigatório preencher pelo menos a Data de Ativação do CPE ou a Data de Ativação do CUI.';

export const DATA_ATIVACAO_DUAL_CPE_REQUIRED_MESSAGE =
  'Para colocar o contrato como Ativo, indique a Data de Ativação do CPE ou a respetiva Data de Baixa.';

export const DATA_ATIVACAO_DUAL_CUI_REQUIRED_MESSAGE =
  'Para colocar o contrato como Ativo, indique a Data de Ativação do CUI ou a respetiva Data de Baixa.';

export function getEnergyActivationDateValidation(
  estado: string | null | undefined,
  tipoProduto: string | null | undefined,
  dataAtivacaoCPE: unknown,
  dataAtivacaoCUI: unknown,
  dataBaixaCPE: unknown,
  dataBaixaCUI: unknown,
): EnergyActivationDateValidation {
  const isActiveState = estado === 'Ativo';
  const isPartialDualState = estado === 'Parcialmente Baixa' && tipoProduto === 'Luz + Gás';

  if (!isActiveState && !isPartialDualState) {
    return emptyEnergyValidation();
  }

  const hasActivationCpe = hasActivationDateValue(dataAtivacaoCPE);
  const hasActivationCui = hasActivationDateValue(dataAtivacaoCUI);
  const hasTerminationCpe = hasActivationDateValue(dataBaixaCPE);
  const hasTerminationCui = hasActivationDateValue(dataBaixaCUI);

  if (isPartialDualState) {
    const missingActiveSupply = !hasActivationCpe && !hasActivationCui;

    return {
      isActiveState: false,
      isDual: true,
      requireCpe: false,
      requireCui: false,
      cpeResolved: hasActivationCpe,
      cuiResolved: hasActivationCui,
      missingCpe: false,
      missingCui: false,
      missingActiveSupply,
      valid: !missingActiveSupply,
      message: missingActiveSupply ? DATA_ATIVACAO_DUAL_PARTIAL_REQUIRED_MESSAGE : null,
    };
  }

  if (tipoProduto === 'Luz') {
    const missingCpe = !hasActivationCpe;

    return {
      isActiveState: true,
      isDual: false,
      requireCpe: true,
      requireCui: false,
      cpeResolved: hasActivationCpe,
      cuiResolved: true,
      missingCpe,
      missingCui: false,
      missingActiveSupply: false,
      valid: !missingCpe,
      message: missingCpe ? DATA_ATIVACAO_CPE_REQUIRED_MESSAGE : null,
    };
  }

  if (tipoProduto === 'Gás') {
    const missingCui = !hasActivationCui;

    return {
      isActiveState: true,
      isDual: false,
      requireCpe: false,
      requireCui: true,
      cpeResolved: true,
      cuiResolved: hasActivationCui,
      missingCpe: false,
      missingCui,
      missingActiveSupply: false,
      valid: !missingCui,
      message: missingCui ? DATA_ATIVACAO_CUI_REQUIRED_MESSAGE : null,
    };
  }

  if (tipoProduto === 'Luz + Gás') {
    const cpeResolved = hasActivationCpe || hasTerminationCpe;
    const cuiResolved = hasActivationCui || hasTerminationCui;
    const missingActiveSupply = !hasActivationCpe && !hasActivationCui;
    const missingCpe = !cpeResolved;
    const missingCui = !cuiResolved;
    const valid = !missingActiveSupply && !missingCpe && !missingCui;

    let message: string | null = null;

    if (missingActiveSupply) {
      message = DATA_ATIVACAO_DUAL_ACTIVE_REQUIRED_MESSAGE;
    } else if (missingCpe) {
      message = DATA_ATIVACAO_DUAL_CPE_REQUIRED_MESSAGE;
    } else if (missingCui) {
      message = DATA_ATIVACAO_DUAL_CUI_REQUIRED_MESSAGE;
    }

    return {
      isActiveState: true,
      isDual: true,
      requireCpe: false,
      requireCui: false,
      cpeResolved,
      cuiResolved,
      missingCpe,
      missingCui,
      missingActiveSupply,
      valid,
      message,
    };
  }

  return emptyEnergyValidation(true);
}

export function getSimpleActivationDateValidation(
  estado: string | null | undefined,
  dataAtivacao: unknown,
): SimpleActivationDateValidation {
  const required = estado === 'Ativo';
  const missing = required && !hasActivationDateValue(dataAtivacao);

  return {
    required,
    missing,
    valid: !missing,
    message: missing ? DATA_ATIVACAO_REQUIRED_MESSAGE : null,
  };
}

export function hasActivationDateValue(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value != null;
}

export function isDataAtivacaoRequiredError(error: unknown): boolean {
  return collectErrorCodes(error).includes('data-ativacao-required');
}

export function getDataAtivacaoBackendMessage(error: unknown): string | null {
  if (!isRecord(error)) {
    return null;
  }

  const nestedError = error['error'];

  if (isRecord(nestedError)) {
    if (typeof nestedError['message'] === 'string' && nestedError['message'].trim()) {
      return nestedError['message'].trim();
    }

    const nestedPayload = nestedError['error'];

    if (
      isRecord(nestedPayload) &&
      typeof nestedPayload['message'] === 'string' &&
      nestedPayload['message'].trim()
    ) {
      return nestedPayload['message'].trim();
    }
  }

  if (typeof error['message'] === 'string' && error['message'].trim()) {
    return error['message'].trim();
  }

  return null;
}

function emptyEnergyValidation(isActiveState = false): EnergyActivationDateValidation {
  return {
    isActiveState,
    isDual: false,
    requireCpe: false,
    requireCui: false,
    cpeResolved: true,
    cuiResolved: true,
    missingCpe: false,
    missingCui: false,
    missingActiveSupply: false,
    valid: true,
    message: null,
  };
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
