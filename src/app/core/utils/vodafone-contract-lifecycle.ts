export function isVodafoneActivationDateRequired(status: string | null | undefined): boolean {
  return status === 'Ativo';
}

export function isVodafoneDeactivationDateRequired(status: string | null | undefined): boolean {
  return status === 'Anulado';
}

export function getVodafoneLifecycleDateValidationError(
  status: string | null | undefined,
  dataAtivacao: string | null | undefined,
  dataBaixa: string | null | undefined,
): string | null {
  if (isVodafoneActivationDateRequired(status) && !dataAtivacao?.trim()) {
    return 'A Data de Ativação é obrigatória para o estado Ativo.';
  }

  if (isVodafoneDeactivationDateRequired(status) && !dataBaixa?.trim()) {
    return 'A Data de Baixa é obrigatória para o estado Anulado.';
  }

  return null;
}
