export interface BaseContractFilters {
  contractId: string;
  client: string;
  nif: string;
  segment: string;
  product: string;
  status: string;
  userId: string;
  registrationName: string;
}

export interface ContractFilterUserOption {
  id: string;
  name: string;
}

export interface BaseContractFilterOptions {
  segments: string[];
  products: string[];
  users: ContractFilterUserOption[];
}

export interface BaseFilterableContract {
  id: string;
  nomeClienteEmpresa?: string | null;
  nif?: string | number | null;
  tipoSegmento?: string | null;
  tipoProduto?: string | null;
  estado?: string | null;
  nomeRegistoCE?: string | null;
  user?: {
    id: string;
    name?: string | null;
  } | null;
}

export function createBaseContractFilters(): BaseContractFilters {
  return {
    contractId: '',
    client: '',
    nif: '',
    segment: '',
    product: '',
    status: '',
    userId: '',
    registrationName: '',
  };
}

export function matchesBaseContractFilters(
  contract: BaseFilterableContract,
  filters: BaseContractFilters,
): boolean {
  return (
    matchesContractFilterValue(contract.id, filters.contractId) &&
    matchesContractFilterValue(contract.nomeClienteEmpresa, filters.client) &&
    matchesContractFilterValue(contract.nif, filters.nif) &&
    (!filters.segment || contract.tipoSegmento === filters.segment) &&
    (!filters.product || contract.tipoProduto === filters.product) &&
    (!filters.status || contract.estado === filters.status) &&
    (!filters.userId || contract.user?.id === filters.userId) &&
    matchesContractFilterValue(contract.nomeRegistoCE, filters.registrationName)
  );
}

export function buildBaseContractFilterOptions<T extends BaseFilterableContract>(
  contracts: readonly T[],
): BaseContractFilterOptions {
  const segments = uniqueSorted(
    contracts.map((contract) => contract.tipoSegmento),
  );

  const products = uniqueSorted(
    contracts.map((contract) => contract.tipoProduto),
  );

  const usersById = new Map<string, ContractFilterUserOption>();

  contracts.forEach((contract) => {
    const userId = contract.user?.id?.trim();
    const userName = contract.user?.name?.trim();

    if (!userId) {
      return;
    }

    usersById.set(userId, {
      id: userId,
      name: userName || userId,
    });
  });

  const users = Array.from(usersById.values()).sort((first, second) =>
    first.name.localeCompare(second.name, 'pt', {
      sensitivity: 'base',
    }),
  );

  return {
    segments,
    products,
    users,
  };
}


export function getVisibleContractStatuses<T extends string>(
  statuses: readonly T[],
  selectedStatus: string,
): readonly T[] {
  const normalizedSelectedStatus = selectedStatus.trim();

  if (!normalizedSelectedStatus) {
    return statuses;
  }

  return statuses.filter((status) => status === normalizedSelectedStatus);
}

export function matchesContractFilterValue(
  value: unknown,
  filter: string,
): boolean {
  const normalizedFilter = normalizeContractFilterText(filter);

  if (!normalizedFilter) {
    return true;
  }

  return normalizeContractFilterText(value).includes(normalizedFilter);
}

export function countActiveContractFilters(filters: object): number {
  return Object.values(filters as Record<string, unknown>).filter((value) => {
    if (typeof value === 'string') {
      return Boolean(value.trim());
    }

    return value !== null && value !== undefined && value !== false;
  }).length;
}

export function uniqueSorted(values: readonly unknown[]): string[] {
  const normalizedValues = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  return Array.from(new Set(normalizedValues)).sort((first, second) =>
    first.localeCompare(second, 'pt', {
      sensitivity: 'base',
    }),
  );
}

export function normalizeContractFilterText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt');
}
