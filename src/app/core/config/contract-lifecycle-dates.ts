export type ContractLifecycleDatePatchValue = string | null;

/**
 * Normaliza apenas datas de ciclo de vida para a semântica do PATCH:
 * - input vazio/null -> null (limpeza explícita)
 * - data preenchida -> string atual do formulário
 *
 * A comparação entre valor atual e original também é feita já normalizada,
 * permitindo distinguir "não alterado" de "explicitamente limpo".
 */
export function normalizeContractLifecycleDate(value: unknown): ContractLifecycleDatePatchValue {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  return String(value);
}

export function assignChangedContractLifecycleDate<
  Payload extends object,
  Key extends keyof Payload,
>(payload: Payload, key: Key, currentValue: unknown, originalValue: unknown): void {
  const normalizedCurrent = normalizeContractLifecycleDate(currentValue);
  const normalizedOriginal = normalizeContractLifecycleDate(originalValue);

  if (normalizedCurrent === normalizedOriginal) {
    return;
  }

  (payload as unknown as Record<string, unknown>)[String(key)] = normalizedCurrent;
}
