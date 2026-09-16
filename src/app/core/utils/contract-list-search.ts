interface SearchEntry {
  normalized: string;
  compact: string;
}

function normalizeSearchValue(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function compactSearchValue(value: string): string {
  return value.replace(/[^a-z0-9]/g, '');
}

function parseSearchTerms(searchTerm: string): string[] {
  const normalized = normalizeSearchValue(searchTerm);

  if (!normalized) {
    return [];
  }

  // Permite combinar vários parâmetros usando espaços, vírgulas ou ponto e vírgula.
  // Texto entre aspas é mantido como uma única expressão, por exemplo:
  // 123456789 "Acacio Reis" atribuido
  const terms: string[] = [];
  const matcher = /"([^"]+)"|'([^']+)'|([^\s,;]+)/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(normalized)) !== null) {
    const value = normalizeSearchValue(match[1] ?? match[2] ?? match[3]);
    if (value) {
      terms.push(value);
    }
  }

  return terms;
}

function collectSearchEntries(
  value: unknown,
  entries: SearchEntry[],
  visited: WeakSet<object>,
  depth = 0,
): void {
  if (value === null || value === undefined || depth > 8) {
    return;
  }

  if (value instanceof Date) {
    const normalized = normalizeSearchValue(value.toISOString());
    if (normalized) {
      entries.push({ normalized, compact: compactSearchValue(normalized) });
    }
    return;
  }

  const valueType = typeof value;

  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean' || valueType === 'bigint') {
    const normalized = normalizeSearchValue(value);
    if (normalized) {
      entries.push({ normalized, compact: compactSearchValue(normalized) });
    }
    return;
  }

  if (valueType !== 'object') {
    return;
  }

  const objectValue = value as object;
  if (visited.has(objectValue)) {
    return;
  }
  visited.add(objectValue);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectSearchEntries(item, entries, visited, depth + 1);
    }
    return;
  }

  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    collectSearchEntries(nestedValue, entries, visited, depth + 1);
  }
}

function contractMatchesTerms(contract: object, terms: readonly string[]): boolean {
  const entries: SearchEntry[] = [];
  collectSearchEntries(contract, entries, new WeakSet<object>());

  return terms.every((term) => {
    const compactTerm = compactSearchValue(term);

    return entries.some((entry) => {
      if (entry.normalized.includes(term)) {
        return true;
      }

      return Boolean(compactTerm) && entry.compact.includes(compactTerm);
    });
  });
}

/**
 * Pesquisa transversal usada por todas as listas de contratos.
 *
 * - cada termo da pesquisa pode corresponder a um campo diferente (lógica AND);
 * - pesquisa todos os valores simples já presentes no objeto recebido pela lista,
 *   incluindo valores em objetos/arrays aninhados;
 * - ignora diferenças de maiúsculas/minúsculas, acentos e separadores comuns;
 * - não provoca qualquer pedido adicional à API.
 *
 * Exemplos:
 *   123456789 Acacio atribuido
 *   123456789, "Acacio Reis", empresarial
 */
export function filterContractsBySearch<T extends object>(
  contracts: readonly T[],
  searchTerm: string,
): T[] {
  const terms = parseSearchTerms(searchTerm);

  if (!terms.length) {
    return [...contracts];
  }

  return contracts.filter((contract) => contractMatchesTerms(contract, terms));
}
