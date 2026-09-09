export interface ContractFlowEntry {
  userId: string;
  userName: string | null;
  acao: string;
  dataHora: string;
}

export type ContractTicketPriority =
  | 'Baixo'
  | 'Normal'
  | 'Alto'
  | 'Urgente';

export interface ContractTicketSummary {
  ticketId: string;
  estado: string;
  tipo: string;
  prioridade: ContractTicketPriority;
  userId: string;
  userName: string | null;
}

export type ContractTicketSocketEventType =
  | 'created'
  | 'updated'
  | 'deleted';

export interface ContractActivityCarrier {
  id?: string;
  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
}

export interface ContractActivitySocketPayload {
  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
  ticket?: ContractTicketSummary;
  ticketEvent?: ContractTicketSocketEventType;
}

export function preserveContractActivity<
  T extends ContractActivityCarrier,
>(
  incoming: T,
  current: ContractActivityCarrier | null | undefined,
): T {
  if (
    incoming.id &&
    current?.id &&
    incoming.id !== current.id
  ) {
    return incoming;
  }

  return {
    ...incoming,
    fluxo: incoming.fluxo ?? current?.fluxo,
    tickets: incoming.tickets ?? current?.tickets,
  };
}

export function mergeContractActivitySocketPayload<
  T extends ContractActivityCarrier,
>(
  current: T | null,
  event: ContractActivitySocketPayload,
): {
  contract: T | null;
  updated: boolean;
} {
  if (!current) {
    return {
      contract: current,
      updated: false,
    };
  }

  const hasFlow = Array.isArray(event.fluxo);
  const hasTickets = Array.isArray(event.tickets);

  if (!hasFlow && !hasTickets) {
    return {
      contract: current,
      updated: false,
    };
  }

  return {
    contract: {
      ...current,
      ...(hasFlow
        ? { fluxo: [...(event.fluxo ?? [])] }
        : {}),
      ...(hasTickets
        ? { tickets: [...(event.tickets ?? [])] }
        : {}),
    },
    updated: true,
  };
}
export interface ContractStateCarrier<TStatus extends string = string> {
  estado: TStatus;
}

export interface ContractStateSocketPayload {
  estado?: string | null;
}

export function mergeContractStateSocketPayload<
  TStatus extends string,
  T extends ContractStateCarrier<TStatus>,
>(
  current: T | null,
  event: ContractStateSocketPayload,
  allowedStatuses: readonly TStatus[],
): {
  contract: T | null;
  updated: boolean;
  estado?: TStatus;
} {
  if (!current || !event.estado) {
    return {
      contract: current,
      updated: false,
    };
  }

  const nextStatus = event.estado as TStatus;

  if (!allowedStatuses.includes(nextStatus)) {
    return {
      contract: current,
      updated: false,
    };
  }

  if (current.estado === nextStatus) {
    return {
      contract: current,
      updated: false,
      estado: nextStatus,
    };
  }

  return {
    contract: {
      ...current,
      estado: nextStatus,
    },
    updated: true,
    estado: nextStatus,
  };
}

