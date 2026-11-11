import type { ClientContractProvider } from '../services/client';

export interface DashboardPendenciesTotals {
  contracts: number;
  byState: Record<string, number>;
  ticketsForReturnedContracts: number;
}

export interface DashboardPendingContract {
  id: string;
  contractId: string;
  companyId: string;
  provider: ClientContractProvider | null;
  nomeClienteEmpresa: string | null;
  nif: string | number | null;
  estado: string | null;
  updatedAt: string | null;
}

export interface DashboardPendingTicket {
  id: string;
  contractId: string;
}

export interface DashboardPendenciesResponse {
  totals: DashboardPendenciesTotals;
  contracts: DashboardPendingContract[];
  tickets: DashboardPendingTicket[];
  limit: number;
  hasMoreContracts: boolean;
}
