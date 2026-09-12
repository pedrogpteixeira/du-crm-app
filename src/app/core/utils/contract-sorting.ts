type ContractTimestampValue =
  | string
  | number
  | Date
  | null
  | undefined
  | { $date?: string | number | Date | null };

export interface ContractWithTimestamps {
  id?: string | null;
  createdAt?: ContractTimestampValue;
  updatedAt?: ContractTimestampValue;
}

/**
 * Ordena contratos pela atividade mais recente.
 *
 * `updatedAt` é sempre a fonte principal. `createdAt` só é usado quando
 * `updatedAt` não existe ou não pode ser interpretado. A função devolve um
 * novo array e nunca altera o array recebido pela API.
 */
export function sortContractsByUpdatedAtDesc<T extends ContractWithTimestamps>(
  contracts: readonly T[],
): T[] {
  return [...contracts].sort((a, b) => {
    const updatedDifference =
      getEffectiveUpdatedTimestamp(b) - getEffectiveUpdatedTimestamp(a);

    if (updatedDifference !== 0) {
      return updatedDifference;
    }

    // Desempate por criação para manter os resultados previsíveis quando
    // dois contratos possuem o mesmo updatedAt (ou ambos não o possuem).
    const createdDifference =
      parseContractTimestamp(b.createdAt) - parseContractTimestamp(a.createdAt);

    if (createdDifference !== 0) {
      return createdDifference;
    }

    return String(b.id ?? '').localeCompare(String(a.id ?? ''));
  });
}

function getEffectiveUpdatedTimestamp(
  contract: ContractWithTimestamps,
): number {
  const updatedAt = parseContractTimestamp(contract.updatedAt);

  if (updatedAt > 0) {
    return updatedAt;
  }

  return parseContractTimestamp(contract.createdAt);
}

/**
 * O backend normalmente envia ISO-8601, mas este parser também suporta
 * Date, timestamps Unix/ms, Mongo Extended JSON e datas pt-PT como
 * "12/09/2026 14:30:00". Datas inválidas ficam com timestamp 0 e vão para
 * o fim da lista em vez de influenciarem incorretamente a ordenação.
 */
function parseContractTimestamp(value: ContractTimestampValue): number {
  if (value == null) {
    return 0;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  if (typeof value === 'object') {
    return parseContractTimestamp(value.$date);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return 0;
    }

    // Também aceita Unix timestamps em segundos.
    return Math.abs(value) < 1_000_000_000_000
      ? value * 1000
      : value;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return 0;
  }

  if (/^\d+(?:\.\d+)?$/.test(normalizedValue)) {
    const numericTimestamp = Number(normalizedValue);

    if (Number.isFinite(numericTimestamp)) {
      return Math.abs(numericTimestamp) < 1_000_000_000_000
        ? numericTimestamp * 1000
        : numericTimestamp;
    }
  }

  // Evita a interpretação ambígua do Date.parse para DD/MM/YYYY.
  const portugueseDateMatch = normalizedValue.match(
    /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?:[\s,T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,3}))?)?)?$/,
  );

  if (portugueseDateMatch) {
    const [, day, month, year, hour = '0', minute = '0', second = '0', millisecond = '0'] =
      portugueseDateMatch;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(millisecond.padEnd(3, '0')),
    );

    const timestamp = date.getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  const timestamp = Date.parse(normalizedValue);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}
