import { HttpParams } from '@angular/common/http';

import { ContractApiFilters, buildContractFiltersParams } from './contract-kanban';

export interface ContractTableResponse<TContract> {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
  orderBy: 'updatedAt';
  order: 'desc';
  contracts: TContract[];
}

export interface ContractTableQuery {
  offset?: number;
  estado?: string | readonly string[];
  filters?: ContractApiFilters;
}

export function buildContractTableParams(query: ContractTableQuery = {}): HttpParams {
  return buildContractFiltersParams(query.filters, query.offset ?? 0, query.estado);
}
