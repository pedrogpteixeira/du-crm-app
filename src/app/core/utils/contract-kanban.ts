import { HttpParams } from '@angular/common/http';

export type ContractFilterPrimitive = string | number | boolean;

export type ContractApiFilters = Record<
  string,
  ContractFilterPrimitive | readonly ContractFilterPrimitive[] | null | undefined
>;

export interface ContractListItemBase<TStatus extends string = string> {
  id: string;
  estado: TStatus;
  nomeClienteEmpresa?: string | null;
  nif?: number | null;
  nomeRegistoCE?: string | null;
  dataContrato?: string | null;
  dataAssinatura?: string | null;
  dataRegisto?: string | null;
  dataAgendamento?: string | null;
}

export interface ContractListSocketPayload {
  contractId?: string;
  estado?: string | null;
  nomeClienteEmpresa?: string | null;
  nif?: number | null;
  nomeRegistoCE?: string | null;
  dataContrato?: string | null;
  dataAssinatura?: string | null;
  dataRegisto?: string | null;
  dataAgendamento?: string | null;
}

export function mergeContractListSocketPayload<TStatus extends string>(
  existing: ContractListItemBase<TStatus> | undefined,
  event: ContractListSocketPayload,
  estado: TStatus,
): ContractListItemBase<TStatus> {
  return {
    id: event.contractId ?? existing?.id ?? '',
    estado,
    nomeClienteEmpresa:
      event.nomeClienteEmpresa !== undefined
        ? event.nomeClienteEmpresa
        : existing?.nomeClienteEmpresa,
    nif: event.nif !== undefined ? event.nif : existing?.nif,
    nomeRegistoCE:
      event.nomeRegistoCE !== undefined ? event.nomeRegistoCE : existing?.nomeRegistoCE,
    dataContrato:
      event.dataContrato !== undefined ? event.dataContrato : existing?.dataContrato,
    dataAssinatura:
      event.dataAssinatura !== undefined ? event.dataAssinatura : existing?.dataAssinatura,
    dataRegisto:
      event.dataRegisto !== undefined ? event.dataRegisto : existing?.dataRegisto,
    dataAgendamento:
      event.dataAgendamento !== undefined
        ? event.dataAgendamento
        : existing?.dataAgendamento,
  };
}

export function formatContractListDate(
  value: string | null | undefined,
  includeTime = false,
): string {
  if (!value) {
    return '-';
  }

  if (!includeTime) {
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

    if (isoDate) {
      return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
        }
      : {
          timeZone: 'UTC',
        }),
  }).format(date);
}

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

export interface ContractKanbanBase extends ContractListItemBase {}

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
