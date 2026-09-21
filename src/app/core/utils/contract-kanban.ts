import { HttpParams } from '@angular/common/http';

export type ContractFilterPrimitive = string | number | boolean;

export type ContractApiFilters = Record<
  string,
  ContractFilterPrimitive | readonly ContractFilterPrimitive[] | null | undefined
>;

export interface ContractKanbanState<TContract> {
  estado: string;
  contracts: TContract[];
  hasMore: boolean;
  nextOffset: number | null;
}

export interface ContractKanbanResponse<TContract> {
  total: number;
  offset: number;
  step: number;
  orderBy: 'updatedAt';
  order: 'desc';
  states: ContractKanbanState<TContract>[];
}

export interface ContractKanbanQuery {
  offset?: number;
  estado?: string | readonly string[];
  filters?: ContractApiFilters;
}

export interface ContractKanbanColumnState {
  hasMore: boolean;
  nextOffset: number | null;
  isLoading: boolean;
}

export interface ContractKanbanBase {
  id: string;
  clientId?: string;
  companyId?: string;
  estado: string;
  nomeClienteEmpresa?: string | null;
  nif?: string | number | null;
  userId?: string;
  user?: {
    id: string;
    name?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export function buildContractFiltersParams(
  filters: ContractApiFilters = {},
  offset = 5,
  estado?: string | readonly string[],
): HttpParams {
  let params = new HttpParams().set('offset', String(offset));

  Object.entries(filters).forEach(([key, value]) => {
    if (shouldIgnoreFilterValue(value)) {
      return;
    }

    if (Array.isArray(value)) {
      params = params.set(key, value.map(String).join(','));
      return;
    }

    params = params.set(key, String(value));
  });

  const states = Array.isArray(estado) ? estado : estado ? [estado] : [];

  states
    .map((state) => state.trim())
    .filter(Boolean)
    .forEach((state) => {
      params = params.append('estado', state);
    });

  return params;
}

export function mergeContractsById<TContract extends { id: string }>(
  existing: readonly TContract[],
  incoming: readonly TContract[],
): TContract[] {
  const incomingById = new Map(incoming.map((contract) => [contract.id, contract]));
  const result = existing.map((contract) => incomingById.get(contract.id) ?? contract);
  const existingIds = new Set(existing.map((contract) => contract.id));

  incoming.forEach((contract) => {
    if (!existingIds.has(contract.id)) {
      result.push(contract);
    }
  });

  return result;
}

export function prependContractById<TContract extends { id: string }>(
  contracts: readonly TContract[],
  contract: TContract,
): TContract[] {
  return [contract, ...contracts.filter((item) => item.id !== contract.id)];
}

export function hasAnyMoreContracts(
  pagination: Readonly<Record<string, ContractKanbanColumnState>>,
): boolean {
  return Object.values(pagination).some((state) => state.hasMore);
}

function shouldIgnoreFilterValue(value: ContractApiFilters[string]): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}
