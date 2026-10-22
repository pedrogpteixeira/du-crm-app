import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ContractBulkUpdateService } from '../../../core/services/contract-bulk-update';
import {
  CONTRACT_BULK_UPDATE_PROVIDERS,
  ContractBulkUpdateHistoryOperation,
  ContractBulkUpdateProvider,
  ContractBulkUpdateResult,
  ContractBulkUpdateResultStatus,
  ContractBulkUpdateResultsPage,
  getBulkUpdateStatusLabel,
  getContractBulkUpdateOperationFields,
  getContractBulkUpdateOperationId,
  getContractBulkUpdateProviderLabel,
  getContractBulkUpdateResultContractId,
  getContractBulkUpdateResultErrorCode,
  getContractBulkUpdateResultFields,
  getContractBulkUpdateSummary,
  getContractDetailRoute,
} from '../../../core/utils/contract-bulk-update';

@Component({
  selector: 'app-bulk-update-history-detail',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './bulk-update-history-detail.html',
  styleUrl: './bulk-update-history-detail.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class BulkUpdateHistoryDetail {
  private readonly bulkService = inject(ContractBulkUpdateService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private operationRequestVersion = 0;
  private resultsRequestVersion = 0;
  private fieldsRequestVersion = 0;

  readonly statusLabel = getBulkUpdateStatusLabel;
  readonly providerLabel = getContractBulkUpdateProviderLabel;
  readonly operationSummary = getContractBulkUpdateSummary;

  operationId = '';
  operation: ContractBulkUpdateHistoryOperation | null = null;
  fieldLabels = new Map<string, string>();
  fieldsCatalogError = '';

  results: ContractBulkUpdateResult[] = [];
  resultsTotal = 0;
  resultsOffset = 0;
  readonly resultsLimit = 25;
  resultsHasMore = false;
  resultStatusFilter: ContractBulkUpdateResultStatus | '' = '';

  isLoadingOperation = false;
  isLoadingResults = false;
  operationError = '';
  resultsError = '';

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const operationId = params.get('id')?.trim() ?? '';
        this.resetForOperation(operationId);
        if (!operationId) {
          this.operationError = 'A operação indicada é inválida.';
          return;
        }
        this.loadOperation();
        this.loadResults(0);
      });
  }

  get summary() {
    return this.operation ? getContractBulkUpdateSummary(this.operation) : null;
  }

  getOperationId(operation: ContractBulkUpdateHistoryOperation): string {
    return getContractBulkUpdateOperationId(operation) || '—';
  }

  get changedFields(): string[] {
    if (!this.operation) return [];
    return getContractBulkUpdateOperationFields(this.operation);
  }

  get recoveryUncertainCount(): number {
    const recovery = this.operation?.recovery;
    return Number(recovery?.uncertain ?? recovery?.uncertainCount ?? 0) || 0;
  }

  get recoveryPendingCount(): number {
    const recovery = this.operation?.recovery;
    return Number(recovery?.pending ?? recovery?.pendingCount ?? 0) || 0;
  }

  retryOperation(): void {
    if (!this.operationId || this.isLoadingOperation) return;
    this.loadOperation();
  }

  retryResults(): void {
    if (!this.operationId || this.isLoadingResults) return;
    this.loadResults(this.resultsOffset);
  }

  applyResultFilter(): void {
    this.resultsOffset = 0;
    this.loadResults(0);
  }

  previousResultsPage(): void {
    if (this.resultsOffset <= 0 || this.isLoadingResults) return;
    this.loadResults(Math.max(0, this.resultsOffset - this.resultsLimit));
  }

  nextResultsPage(): void {
    if (!this.resultsHasMore || this.isLoadingResults) return;
    this.loadResults(this.resultsOffset + this.resultsLimit);
  }

  fieldLabel(field: string): string {
    return this.fieldLabels.get(field) ?? field;
  }

  resultFields(result: ContractBulkUpdateResult): string[] {
    return getContractBulkUpdateResultFields(result).map((field) => this.fieldLabel(field));
  }

  resultErrorCode(result: ContractBulkUpdateResult): string {
    return getContractBulkUpdateResultErrorCode(result) || '—';
  }

  resultStatusLabel(result: ContractBulkUpdateResult): string {
    if (result.status === 'processing') {
      return this.operation?.status === 'interrupted'
        ? 'Resultado por confirmar'
        : 'Em processamento';
    }
    if (result.status === 'updated') return 'Atualizado';
    if (result.status === 'unchanged') return 'Sem alterações';
    return 'Falhado';
  }

  resultFilterLabel(status: ContractBulkUpdateResultStatus): string {
    if (status === 'processing') return 'Por confirmar';
    if (status === 'updated') return 'Atualizados';
    if (status === 'unchanged') return 'Sem alterações';
    return 'Falhados';
  }

  contractRoute(result: ContractBulkUpdateResult): string[] | null {
    if (!this.operation?.provider) return null;
    const contractId = getContractBulkUpdateResultContractId(result);
    if (!contractId) return null;
    return getContractDetailRoute(this.operation.provider, contractId);
  }

  contractLabel(result: ContractBulkUpdateResult): string {
    return getContractBulkUpdateResultContractId(result) || '—';
  }

  selectionLabel(operation: ContractBulkUpdateHistoryOperation): string {
    return operation.mode === 'selected'
      ? 'Contratos selecionados'
      : 'Todos os contratos abrangidos pelos filtros';
  }

  responsibleName(operation: ContractBulkUpdateHistoryOperation): string {
    return operation.userName?.trim()
      || operation.createdByName?.trim()
      || operation.user?.name?.trim()
      || '—';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  isLongMessage(message: string | null | undefined): boolean {
    return (message?.length ?? 0) > 150;
  }

  shortMessage(message: string | null | undefined): string {
    if (!message) return '—';
    return message.length > 150 ? `${message.slice(0, 147)}...` : message;
  }

  private resetForOperation(operationId: string): void {
    this.operationRequestVersion += 1;
    this.resultsRequestVersion += 1;
    this.fieldsRequestVersion += 1;
    this.operationId = operationId;
    this.operation = null;
    this.fieldLabels = new Map<string, string>();
    this.fieldsCatalogError = '';
    this.results = [];
    this.resultsTotal = 0;
    this.resultsOffset = 0;
    this.resultsHasMore = false;
    this.resultStatusFilter = '';
    this.operationError = '';
    this.resultsError = '';
  }

  private loadOperation(): void {
    const requestVersion = ++this.operationRequestVersion;
    const requestedOperationId = this.operationId;
    this.isLoadingOperation = true;
    this.operationError = '';

    this.bulkService
      .getOperation(requestedOperationId)
      .pipe(
        finalize(() => {
          if (requestVersion === this.operationRequestVersion) {
            this.isLoadingOperation = false;
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (operation) => {
          if (requestVersion !== this.operationRequestVersion || requestedOperationId !== this.operationId) return;
          this.operation = operation;
          this.loadFieldLabels(operation.provider);
        },
        error: (error: HttpErrorResponse) => {
          if (requestVersion !== this.operationRequestVersion || requestedOperationId !== this.operationId) return;
          this.operation = null;
          this.operationError = this.apiMessageForOperation(error);
        },
      });
  }

  private loadFieldLabels(providerValue: string): void {
    if (!CONTRACT_BULK_UPDATE_PROVIDERS.includes(providerValue as ContractBulkUpdateProvider)) {
      return;
    }

    const requestVersion = ++this.fieldsRequestVersion;
    const requestedOperationId = this.operationId;
    this.fieldsCatalogError = '';
    this.bulkService
      .getFields(providerValue as ContractBulkUpdateProvider)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (requestVersion !== this.fieldsRequestVersion || requestedOperationId !== this.operationId) return;
          this.fieldLabels = new Map(
            (response.fields ?? []).map((field) => [field.key, field.label]),
          );
        },
        error: () => {
          if (requestVersion !== this.fieldsRequestVersion || requestedOperationId !== this.operationId) return;
          this.fieldsCatalogError = 'Não foi possível carregar as designações dos campos.';
        },
      });
  }

  private loadResults(offset: number): void {
    if (!this.operationId) return;
    const requestVersion = ++this.resultsRequestVersion;
    const requestedOperationId = this.operationId;
    this.isLoadingResults = true;
    this.resultsError = '';

    this.bulkService
      .getOperationResults(requestedOperationId, {
        status: this.resultStatusFilter,
        offset,
        limit: this.resultsLimit,
      })
      .pipe(
        finalize(() => {
          if (requestVersion === this.resultsRequestVersion) {
            this.isLoadingResults = false;
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (page) => {
          if (requestVersion !== this.resultsRequestVersion || requestedOperationId !== this.operationId) return;
          this.applyResultsPage(page);
        },
        error: (error: HttpErrorResponse) => {
          if (requestVersion !== this.resultsRequestVersion || requestedOperationId !== this.operationId) return;
          this.results = [];
          this.resultsTotal = 0;
          this.resultsHasMore = false;
          this.resultsError = this.apiMessage(
            error,
            'Não foi possível carregar os resultados individuais.',
          );
        },
      });
  }

  private applyResultsPage(page: ContractBulkUpdateResultsPage): void {
    this.results = page.results;
    this.resultsTotal = page.total;
    this.resultsOffset = page.offset;
    this.resultsHasMore = page.hasMore;
  }

  private apiMessageForOperation(error: HttpErrorResponse): string {
    if (error.status === 403) {
      return this.apiMessage(error, 'Não tem permissão para consultar esta operação.');
    }
    if (error.status === 404) {
      return this.apiMessage(error, 'A operação indicada não existe ou já não está disponível.');
    }
    return this.apiMessage(error, 'Não foi possível carregar o detalhe da operação.');
  }

  private apiMessage(error: HttpErrorResponse, fallback: string): string {
    const body = error.error as { message?: string } | string | null;
    if (typeof body === 'string' && body.trim()) return body;
    if (body && typeof body === 'object' && typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
    return fallback;
  }
}
