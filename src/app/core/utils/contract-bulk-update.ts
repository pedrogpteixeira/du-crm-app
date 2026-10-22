import { ContractExportProvider, ContractExportMode } from './contract-export';
import { ContractApiFilters } from './contract-kanban';

export type ContractBulkUpdateProvider = ContractExportProvider;
export type ContractBulkUpdateMode = ContractExportMode;
export type ContractBulkUpdateFieldType = 'string' | 'boolean' | 'number' | 'teams' | 'user';
export type ContractBulkUpdateOperation = 'set' | 'add' | 'remove' | 'replace';
export type ContractBulkUpdateOperationStatus =
  | 'processing'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'interrupted';
export type ContractBulkUpdateResultStatus = 'processing' | 'updated' | 'unchanged' | 'failed';

export interface ContractBulkUpdateField {
  key: string;
  label: string;
  type: ContractBulkUpdateFieldType;
  options?: string[];
  operations: ContractBulkUpdateOperation[];
}

export interface ContractBulkUpdateFieldsResponse {
  provider: ContractBulkUpdateProvider | string;
  fields: ContractBulkUpdateField[];
}

export type ContractBulkUpdateValue = string | number | boolean | string[] | null;

export interface ContractBulkUpdateChange {
  field: string;
  operation: ContractBulkUpdateOperation;
  value: ContractBulkUpdateValue;
}

export interface ContractBulkUpdateSelectedScope {
  mode: 'selected';
  ids: string[];
}

export interface ContractBulkUpdateFilteredScope {
  mode: 'filtered';
  filters: ContractApiFilters;
}

export type ContractBulkUpdateScope =
  | ContractBulkUpdateSelectedScope
  | ContractBulkUpdateFilteredScope;

export type ContractBulkUpdatePreviewRequest = ContractBulkUpdateScope & {
  changes: ContractBulkUpdateChange[];
};

export type ContractBulkUpdateExecuteRequest = ContractBulkUpdatePreviewRequest & {
  idempotencyKey: string;
};

export interface ContractBulkUpdatePreviewResponse {
  provider?: string;
  mode?: ContractBulkUpdateMode;
  total?: number;
  matched?: number;
  count?: number;
  preflight?: string;
  eligible?: number | null;
}

export interface ContractBulkUpdateSummary {
  total: number;
  processed: number;
  updated: number;
  unchanged: number;
  failed: number;
}

export interface ContractBulkUpdateErrorItem {
  contractId: string;
  code?: string | null;
  message: string;
}

export interface ContractBulkUpdateRecovery {
  requiresReview?: boolean;
  uncertain?: number;
  pending?: number;
  uncertainCount?: number;
  pendingCount?: number;
}

export interface ContractBulkUpdateExecuteResponse {
  operationId: string;
  status: ContractBulkUpdateOperationStatus;
  summary: ContractBulkUpdateSummary;
  errors?: ContractBulkUpdateErrorItem[];
  errorsTruncated?: boolean;
  recovery?: ContractBulkUpdateRecovery | null;
}

export interface ContractBulkUpdateHistoryChange {
  field: string;
  operation?: ContractBulkUpdateOperation;
  value?: ContractBulkUpdateValue;
}

export interface ContractBulkUpdateHistoryUser {
  id?: string;
  name?: string | null;
}

export interface ContractBulkUpdateHistoryOperation {
  domainId?: string;
  id?: string;
  operationId?: string;
  provider: ContractBulkUpdateProvider | string;
  mode: ContractBulkUpdateMode;
  status: ContractBulkUpdateOperationStatus;
  changedFields?: string[];
  fields?: string[];
  changes?: ContractBulkUpdateHistoryChange[];
  summary?: Partial<ContractBulkUpdateSummary>;
  total?: number;
  processed?: number;
  updated?: number;
  unchanged?: number;
  failed?: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string | null;
  userName?: string | null;
  createdByName?: string | null;
  user?: ContractBulkUpdateHistoryUser | null;
  recovery?: ContractBulkUpdateRecovery | null;
}

export interface ContractBulkUpdateOperationListApiResponse {
  operations?: ContractBulkUpdateHistoryOperation[];
  items?: ContractBulkUpdateHistoryOperation[];
  total?: number;
  offset?: number;
  limit?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
}

export interface ContractBulkUpdateOperationPage {
  operations: ContractBulkUpdateHistoryOperation[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export interface ContractBulkUpdateResult {
  id?: string;
  domainId?: string | null;
  contractId: string;
  status: ContractBulkUpdateResultStatus;
  errorCode?: string | null;
  code?: string | null;
  message?: string | null;
  failedFields?: string[];
  fields?: string[];
  processedAt?: string | null;
  createdAt?: string | null;
}

export interface ContractBulkUpdateResultsApiResponse {
  results?: ContractBulkUpdateResult[];
  items?: ContractBulkUpdateResult[];
  total?: number;
  offset?: number;
  limit?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
}

export interface ContractBulkUpdateResultsPage {
  results: ContractBulkUpdateResult[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export const CONTRACT_BULK_UPDATE_PROVIDERS: readonly ContractBulkUpdateProvider[] = [
  'repsol',
  'portulogos',
  'galp-power-gas',
  'galp-solar',
  'iberdrola',
  'iberdrola-solar',
  'yes-energy',
  'meo-energias',
  'wallbox',
  'vodafone',
];

const PROVIDER_LABELS: Record<ContractBulkUpdateProvider, string> = {
  repsol: 'Repsol',
  portulogos: 'Portulogos',
  'galp-power-gas': 'Galp Power & Gás',
  'galp-solar': 'Galp Solar',
  iberdrola: 'Iberdrola',
  'iberdrola-solar': 'Iberdrola Solar',
  'yes-energy': 'Yes Energy',
  'meo-energias': 'MEO Energias',
  wallbox: 'Wallbox',
  vodafone: 'Vodafone',
};

export function getContractBulkUpdateProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider as ContractBulkUpdateProvider] ?? provider;
}

export function getContractBulkUpdateOperationId(
  operation: ContractBulkUpdateHistoryOperation,
): string {
  return operation.domainId?.trim()
    || operation.operationId?.trim()
    || operation.id?.trim()
    || '';
}

export function getContractBulkUpdateOperationFields(
  operation: ContractBulkUpdateHistoryOperation,
): string[] {
  if (Array.isArray(operation.changedFields) && operation.changedFields.length) {
    return operation.changedFields.filter(Boolean);
  }

  if (Array.isArray(operation.fields) && operation.fields.length) {
    return operation.fields.filter(Boolean);
  }

  return (operation.changes ?? [])
    .map((change) => change.field)
    .filter(Boolean);
}

export function getContractBulkUpdateResultContractId(
  result: ContractBulkUpdateResult,
): string {
  return result.domainId?.trim() || result.contractId?.trim() || '';
}

export function getContractBulkUpdateResultErrorCode(
  result: ContractBulkUpdateResult,
): string {
  return result.errorCode?.trim() || result.code?.trim() || '';
}

export function getContractBulkUpdateResultFields(
  result: ContractBulkUpdateResult,
): string[] {
  if (Array.isArray(result.failedFields) && result.failedFields.length) {
    return result.failedFields.filter(Boolean);
  }
  return (result.fields ?? []).filter(Boolean);
}

export function getContractBulkUpdateSummary(
  operation: ContractBulkUpdateHistoryOperation,
): ContractBulkUpdateSummary {
  const summary = operation.summary ?? {};
  return {
    total: Number(summary.total ?? operation.total ?? 0) || 0,
    processed: Number(summary.processed ?? operation.processed ?? 0) || 0,
    updated: Number(summary.updated ?? operation.updated ?? 0) || 0,
    unchanged: Number(summary.unchanged ?? operation.unchanged ?? 0) || 0,
    failed: Number(summary.failed ?? operation.failed ?? 0) || 0,
  };
}

export function getContractDetailRoute(
  provider: string,
  contractId: string,
): string[] | null {
  if (!CONTRACT_BULK_UPDATE_PROVIDERS.includes(provider as ContractBulkUpdateProvider)) {
    return null;
  }

  return ['/home/contracts', provider, contractId];
}

export function getBulkUpdateStatusLabel(status: ContractBulkUpdateOperationStatus): string {
  const labels: Record<ContractBulkUpdateOperationStatus, string> = {
    processing: 'Em processamento',
    completed: 'Concluída',
    completed_with_errors: 'Concluída com erros',
    failed: 'Falhada',
    interrupted: 'Interrompida',
  };

  return labels[status];
}

export function getBulkUpdateResultStatusLabel(status: ContractBulkUpdateResultStatus): string {
  const labels: Record<ContractBulkUpdateResultStatus, string> = {
    processing: 'Por confirmar',
    updated: 'Atualizado',
    unchanged: 'Sem alterações',
    failed: 'Falhado',
  };

  return labels[status];
}
