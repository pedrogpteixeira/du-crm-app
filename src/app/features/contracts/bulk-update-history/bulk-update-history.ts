import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { ContractBulkUpdateService } from '../../../core/services/contract-bulk-update';
import {
  CONTRACT_BULK_UPDATE_PROVIDERS,
  ContractBulkUpdateHistoryOperation,
  ContractBulkUpdateOperationStatus,
  getBulkUpdateStatusLabel,
  getContractBulkUpdateOperationFields,
  getContractBulkUpdateOperationId,
  getContractBulkUpdateProviderLabel,
  getContractBulkUpdateSummary,
} from '../../../core/utils/contract-bulk-update';

@Component({
  selector: 'app-bulk-update-history',
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-update-history.html',
  styleUrl: './bulk-update-history.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class BulkUpdateHistory implements OnInit {
  private readonly bulkService = inject(ContractBulkUpdateService);
  private readonly router = inject(Router);

  readonly providers = CONTRACT_BULK_UPDATE_PROVIDERS;
  readonly operationStatuses: ContractBulkUpdateOperationStatus[] = [
    'processing',
    'completed',
    'completed_with_errors',
    'failed',
    'interrupted',
  ];
  readonly providerLabel = getContractBulkUpdateProviderLabel;
  readonly statusLabel = getBulkUpdateStatusLabel;
  readonly operationFields = getContractBulkUpdateOperationFields;
  readonly operationSummary = getContractBulkUpdateSummary;

  providerFilter = '';
  statusFilter: ContractBulkUpdateOperationStatus | '' = '';

  operations: ContractBulkUpdateHistoryOperation[] = [];
  operationsTotal = 0;
  operationsOffset = 0;
  readonly operationsLimit = 25;
  operationsHasMore = false;
  isLoadingOperations = false;
  operationsError = '';

  ngOnInit(): void {
    this.loadOperations();
  }

  applyFilters(): void {
    this.operationsOffset = 0;
    this.loadOperations();
  }

  clearFilters(): void {
    this.providerFilter = '';
    this.statusFilter = '';
    this.operationsOffset = 0;
    this.loadOperations();
  }

  loadOperations(offset = this.operationsOffset): void {
    this.isLoadingOperations = true;
    this.operationsError = '';

    this.bulkService
      .getOperations({
        provider: this.providerFilter,
        status: this.statusFilter,
        offset,
        limit: this.operationsLimit,
      })
      .pipe(finalize(() => (this.isLoadingOperations = false)))
      .subscribe({
        next: (page) => {
          this.operations = page.operations;
          this.operationsTotal = page.total;
          this.operationsOffset = page.offset;
          this.operationsHasMore = page.hasMore;
        },
        error: (error: HttpErrorResponse) => {
          this.operations = [];
          this.operationsTotal = 0;
          this.operationsHasMore = false;
          this.operationsError = this.apiMessage(
            error,
            'Não foi possível carregar o histórico de atualizações em massa.',
          );
        },
      });
  }

  previousOperationsPage(): void {
    if (this.operationsOffset <= 0 || this.isLoadingOperations) return;
    this.loadOperations(Math.max(0, this.operationsOffset - this.operationsLimit));
  }

  nextOperationsPage(): void {
    if (!this.operationsHasMore || this.isLoadingOperations) return;
    this.loadOperations(this.operationsOffset + this.operationsLimit);
  }

  openOperation(operation: ContractBulkUpdateHistoryOperation): void {
    const id = getContractBulkUpdateOperationId(operation);
    if (!id) return;
    void this.router.navigate(['/home/contracts/bulk-update-history', id]);
  }

  operationDate(operation: ContractBulkUpdateHistoryOperation): string {
    return this.formatDate(operation.startedAt ?? operation.createdAt);
  }

  private formatDate(value: string | null | undefined): string {
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

  private apiMessage(error: HttpErrorResponse, fallback: string): string {
    const body = error.error as { message?: string } | string | null;
    if (typeof body === 'string' && body.trim()) return body;
    if (body && typeof body === 'object' && typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
    return fallback;
  }
}
