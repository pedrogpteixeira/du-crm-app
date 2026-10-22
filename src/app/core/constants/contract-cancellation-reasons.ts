export const CONTRACT_CANCELLATION_REASONS = [
  'Dívida existente - CPE/CUI',
  'CPE/CUI ativo',
  'Cliente desistiu',
  'Falta de tratamento do processo',
  'Falta de tratamento - campanha descontinuada',
  'Outras',
] as const;

export type ContractCancellationReason = (typeof CONTRACT_CANCELLATION_REASONS)[number];


export interface ContractCancellationReasonUpdate {
  motivoAnulacao: ContractCancellationReason;
  motivoAnulacaoOutras: string | null;
}

interface ContractCancellationReasonFormState {
  motivoAnulacao: string;
  motivoAnulacaoOutras: string;
}

export function mergeCancellationReasonIntoEditState<
  T extends ContractCancellationReasonFormState,
>(
  current: T,
  original: T,
  update: ContractCancellationReasonUpdate,
): { current: T; original: T } {
  const reasonChangedLocally = current.motivoAnulacao !== original.motivoAnulacao;
  const otherChangedLocally =
    current.motivoAnulacaoOutras !== original.motivoAnulacaoOutras;

  const nextReason = update.motivoAnulacao;
  const nextOther = update.motivoAnulacaoOutras ?? '';

  return {
    current: {
      ...current,
      ...(reasonChangedLocally ? {} : { motivoAnulacao: nextReason }),
      ...(otherChangedLocally ? {} : { motivoAnulacaoOutras: nextOther }),
    },
    original: {
      ...original,
      motivoAnulacao: nextReason,
      motivoAnulacaoOutras: nextOther,
    },
  };
}

export function isContractCancellationReason(
  value: string | null | undefined,
): value is ContractCancellationReason {
  return CONTRACT_CANCELLATION_REASONS.includes(value as ContractCancellationReason);
}

export function isContractCancellationState(state: string | null | undefined): boolean {
  const normalized = (state ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT');

  return normalized === 'anulado' || normalized === 'cancelado' || normalized === 'cancelada';
}

interface CancellationReasonEditState {
  currentState: string | null | undefined;
  originalState: string | null | undefined;
  currentReason: string | null | undefined;
  originalReason: string | null | undefined;
  currentOther: string | null | undefined;
  originalOther: string | null | undefined;
}

export function isCancellationReasonEditRequired(state: CancellationReasonEditState): boolean {
  if (!isContractCancellationState(state.currentState)) {
    return false;
  }

  const transitionedToCancellation = state.currentState !== state.originalState;
  const reasonChanged = (state.currentReason ?? '') !== (state.originalReason ?? '');
  const otherChanged = (state.currentOther ?? '') !== (state.originalOther ?? '');

  return transitionedToCancellation || reasonChanged || otherChanged;
}
