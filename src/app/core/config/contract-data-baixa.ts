export type DataBaixaProvider =
  | 'repsol'
  | 'portulogos'
  | 'galp-power-gas'
  | 'yes-energy'
  | 'iberdrola'
  | 'vodafone'
  | 'meo-energias';

export interface TerminationDateRequirements {
  requireCpe: boolean;
  requireCui: boolean;
  requireAtLeastOne: boolean;
}

export interface TerminationDateValidation extends TerminationDateRequirements {
  missingCpe: boolean;
  missingCui: boolean;
  missingAtLeastOne: boolean;
  multiplePartialDates: boolean;
  valid: boolean;
  message: string | null;
}

export const DATA_BAIXA_CPE_REQUIRED_MESSAGE =
  'A Data de Baixa do CPE é obrigatória para este estado.';

export const DATA_BAIXA_CUI_REQUIRED_MESSAGE =
  'A Data de Baixa do CUI é obrigatória para este estado.';

export const DATA_BAIXA_PARTIAL_DUAL_REQUIRED_MESSAGE =
  'Para uma baixa parcial de Luz + Gás, é obrigatório preencher a Data de Baixa do CPE ou a Data de Baixa do CUI.';

export const DATA_BAIXA_PARTIAL_DUAL_EXCLUSIVE_MESSAGE =
  'Para colocar um contrato Luz + Gás como Parcialmente Baixa, deve preencher apenas uma das Datas de Baixa: CPE ou CUI, não ambas.';

const PROVIDERS_WITH_PARTIAL_TERMINATION = new Set<DataBaixaProvider>([
  'repsol',
  'portulogos',
  'galp-power-gas',
  'yes-energy',
  'iberdrola',
]);

export function getTerminationDateRequirements(
  provider: DataBaixaProvider,
  estado: string | null | undefined,
  tipoProduto: string | null | undefined,
): TerminationDateRequirements {
  const isFullTermination = estado === 'Baixa';
  const isPartialTermination =
    estado === 'Parcialmente Baixa' && PROVIDERS_WITH_PARTIAL_TERMINATION.has(provider);

  if (!isFullTermination && !isPartialTermination) {
    return emptyRequirements();
  }

  if (tipoProduto === 'Luz') {
    return {
      requireCpe: true,
      requireCui: false,
      requireAtLeastOne: false,
    };
  }

  if (tipoProduto === 'Gás') {
    return {
      requireCpe: false,
      requireCui: true,
      requireAtLeastOne: false,
    };
  }

  if (tipoProduto === 'Luz + Gás') {
    if (isPartialTermination) {
      return {
        requireCpe: false,
        requireCui: false,
        requireAtLeastOne: true,
      };
    }

    return {
      requireCpe: true,
      requireCui: true,
      requireAtLeastOne: false,
    };
  }

  return emptyRequirements();
}

export function getTerminationDateValidation(
  provider: DataBaixaProvider,
  estado: string | null | undefined,
  tipoProduto: string | null | undefined,
  dataBaixaCPE: unknown,
  dataBaixaCUI: unknown,
): TerminationDateValidation {
  const requirements = getTerminationDateRequirements(provider, estado, tipoProduto);
  const hasCpe = hasTerminationDateValue(dataBaixaCPE);
  const hasCui = hasTerminationDateValue(dataBaixaCUI);
  const missingCpe = requirements.requireCpe && !hasCpe;
  const missingCui = requirements.requireCui && !hasCui;
  const missingAtLeastOne = requirements.requireAtLeastOne && !hasCpe && !hasCui;
  const multiplePartialDates = requirements.requireAtLeastOne && hasCpe && hasCui;

  let message: string | null = null;

  if (missingAtLeastOne) {
    message = DATA_BAIXA_PARTIAL_DUAL_REQUIRED_MESSAGE;
  } else if (multiplePartialDates) {
    message = DATA_BAIXA_PARTIAL_DUAL_EXCLUSIVE_MESSAGE;
  } else if (missingCpe) {
    message = DATA_BAIXA_CPE_REQUIRED_MESSAGE;
  } else if (missingCui) {
    message = DATA_BAIXA_CUI_REQUIRED_MESSAGE;
  }

  return {
    ...requirements,
    missingCpe,
    missingCui,
    missingAtLeastOne,
    multiplePartialDates,
    valid: !missingCpe && !missingCui && !missingAtLeastOne && !multiplePartialDates,
    message,
  };
}

export function hasTerminationDateValue(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value != null;
}

export function isDataBaixaRequiredError(error: unknown): boolean {
  return collectErrorCodes(error).includes('data-baixa-required');
}

export function getDataBaixaBackendMessage(error: unknown): string | null {
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

function emptyRequirements(): TerminationDateRequirements {
  return {
    requireCpe: false,
    requireCui: false,
    requireAtLeastOne: false,
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
