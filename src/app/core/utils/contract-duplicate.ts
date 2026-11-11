import type { ClientContractProvider, Client } from '../services/client';

const DUPLICATE_CONTRACT_STORAGE_KEY = 'certo:contract-duplicate-draft';

interface StoredContractDuplicateDraft {
  provider: ClientContractProvider;
  contract: Record<string, unknown>;
  createdAt: number;
}

export interface ContractDuplicatePrefill {
  client: Client | null;
  nif: number | null;
  clientName: string;
  assignedUserId: string;
  selectedTeamIds: string[];
  selectedRegistrationTeamId: string;
}

const SYSTEM_FIELDS = new Set([
  '_id',
  'id',
  '__v',
  'provider',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'attachments',
  'documents',
  'history',
  'activity',
  'tickets',
  'ticketIds',
]);

function cloneBusinessFields(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => cloneBusinessFields(item, depth + 1));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(source)) {
    if (depth === 0 && SYSTEM_FIELDS.has(key)) {
      continue;
    }

    result[key] = cloneBusinessFields(item, depth + 1);
  }

  return result;
}

export function storeContractDuplicateDraft(
  provider: ClientContractProvider,
  contract: unknown,
): void {
  if (!contract || typeof contract !== 'object') {
    return;
  }

  const draft: StoredContractDuplicateDraft = {
    provider,
    contract: cloneBusinessFields(contract) as Record<string, unknown>,
    createdAt: Date.now(),
  };

  sessionStorage.setItem(DUPLICATE_CONTRACT_STORAGE_KEY, JSON.stringify(draft));
}

function consumeContractDuplicateDraft(
  provider: ClientContractProvider,
): StoredContractDuplicateDraft | null {
  const raw = sessionStorage.getItem(DUPLICATE_CONTRACT_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  sessionStorage.removeItem(DUPLICATE_CONTRACT_STORAGE_KEY);

  try {
    const draft = JSON.parse(raw) as StoredContractDuplicateDraft;

    if (!draft?.contract || draft.provider !== provider) {
      return null;
    }

    // Evita que um draft antigo seja aplicado acidentalmente dias depois.
    if (!draft.createdAt || Date.now() - draft.createdAt > 30 * 60 * 1000) {
      return null;
    }

    return draft;
  } catch {
    return null;
  }
}

function normalizeFormValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const dateLike = key === 'agendamento' || /^data[A-Z]/.test(key);

  if (!dateLike || !value) {
    return value;
  }

  // datetime-local não aceita o sufixo Z. Preserva datas simples e reduz timestamps ISO.
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}T${isoMatch[2]}`;
  }

  return value;
}

function readString(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
}

function readId(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if (typeof object['id'] === 'string') return object['id'];
    if (typeof object['_id'] === 'string') return object['_id'];
  }

  return '';
}

function readTeamIds(source: Record<string, unknown>): string[] {
  const candidates = [source['teamIds'], source['teams'], source['team'], source['assignedTeams']];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const ids = candidate.map(readId).filter(Boolean);
      if (ids.length) return ids.slice(0, 1);
    }

    const singleId = readId(candidate);
    if (singleId) return [singleId];
  }

  const direct = readString(source, 'teamId', 'assignedTeamId');
  return direct ? [direct] : [];
}

export function applyContractDuplicateDraft<T extends object>(
  provider: ClientContractProvider,
  contractForm: T,
): ContractDuplicatePrefill | null {
  const draft = consumeContractDuplicateDraft(provider);

  if (!draft) {
    return null;
  }

  const source = draft.contract;
  const formRecord = contractForm as Record<string, unknown>;

  for (const key of Object.keys(formRecord)) {
    if (key === 'companyId' || !(key in source)) {
      continue;
    }

    const value = source[key];
    if (value !== undefined) {
      formRecord[key] = normalizeFormValue(key, value);
    }
  }

  const sourceClient =
    source['client'] && typeof source['client'] === 'object'
      ? (source['client'] as Record<string, unknown>)
      : null;
  const nifRaw = source['nif'] ?? sourceClient?.['nif'];
  const nif = nifRaw === null || nifRaw === undefined || nifRaw === '' ? null : Number(nifRaw);
  const safeNif = Number.isFinite(nif) ? nif : null;
  const clientName =
    readString(source, 'nomeClienteEmpresa', 'clientName', 'nomeCliente', 'name') ||
    (sourceClient ? readString(sourceClient, 'name', 'nomeClienteEmpresa') : '');
  const clientId =
    readString(source, 'clientId', 'clienteId') || (sourceClient ? readId(sourceClient) : '');

  const client: Client | null =
    safeNif !== null && clientName
      ? {
          id: clientId,
          name: clientName,
          nif: safeNif,
          createdAt: '',
          updatedAt: '',
        }
      : null;

  const userValue = source['user'] ?? source['assignedUser'];
  const assignedUserId =
    readString(source, 'assignedUserId', 'userId', 'utilizadorId') || readId(userValue);
  const selectedTeamIds = readTeamIds(source);

  return {
    client,
    nif: safeNif,
    clientName,
    assignedUserId,
    selectedTeamIds,
    selectedRegistrationTeamId: selectedTeamIds[0] ?? '',
  };
}
