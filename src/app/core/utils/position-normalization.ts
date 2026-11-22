export const OFFICIAL_COMMERCIAL_POSITION = 'Comercial';
const LEGACY_SELLER_POSITION = 'Vendedor';

export function normalizePositionName(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();

  if (!trimmed) {
    return '';
  }

  return trimmed.localeCompare(LEGACY_SELLER_POSITION, 'pt-PT', { sensitivity: 'accent' }) === 0
    ? OFFICIAL_COMMERCIAL_POSITION
    : trimmed;
}

/**
 * Normaliza apenas a designação, preservando rigorosamente o comprimento e a
 * ordem da lista. Assim, os positionIndex existentes continuam a apontar para
 * o mesmo slot da hierarquia.
 */
export function normalizePositionList(positionList: readonly string[] | null | undefined): string[] {
  return Array.isArray(positionList)
    ? positionList.map((position) => normalizePositionName(position))
    : [];
}

/**
 * Remove duplicações visuais para seletores sem recalcular os índices reais.
 * O option.value continua a ser o positionIndex original da equipa.
 */
export function buildUniquePositionOptions(
  positionList: readonly string[] | null | undefined,
): Array<{ index: number; label: string }> {
  const seen = new Set<string>();
  const options: Array<{ index: number; label: string }> = [];

  (positionList ?? []).forEach((position, index) => {
    const label = normalizePositionName(position);
    if (!label) {
      return;
    }

    const key = label.toLocaleLowerCase('pt-PT');
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    options.push({ index, label });
  });

  return options;
}

export function normalizeRoleName(value: string | null | undefined): string {
  return normalizePositionName(value);
}
