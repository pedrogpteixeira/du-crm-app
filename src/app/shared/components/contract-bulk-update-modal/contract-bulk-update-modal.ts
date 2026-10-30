import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  CONTRACT_CANCELLATION_REASONS,
  isContractCancellationState,
} from '../../../core/constants/contract-cancellation-reasons';
import { ContractBulkUpdateService } from '../../../core/services/contract-bulk-update';
import { Team, TeamService } from '../../../core/services/team';
import { ToastService } from '../../../core/services/toast';
import { ProfileUser, UserService } from '../../../core/services/user';
import {
  ContractBulkUpdateChange,
  ContractBulkUpdateExecuteRequest,
  ContractBulkUpdateExecuteResponse,
  ContractBulkUpdateField,
  ContractBulkUpdateMode,
  ContractBulkUpdateOperation,
  ContractBulkUpdatePreviewRequest,
  ContractBulkUpdatePreviewResponse,
  ContractBulkUpdateProvider,
  ContractBulkUpdateValue,
  getBulkUpdateStatusLabel,
} from '../../../core/utils/contract-bulk-update';
import { ContractApiFilters } from '../../../core/utils/contract-kanban';

interface BulkFieldState {
  field: ContractBulkUpdateField;
  enabled: boolean;
  operation: ContractBulkUpdateOperation;
  value: string | number | boolean | null;
  teamIds: string[];
}

type BulkUpdateModalPhase = 'configure' | 'review' | 'result';

@Component({
  selector: 'app-contract-bulk-update-modal',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './contract-bulk-update-modal.html',
  styleUrl: './contract-bulk-update-modal.scss',
})
export class ContractBulkUpdateModalComponent implements OnInit {
  @Input({ required: true }) provider!: ContractBulkUpdateProvider;
  @Input({ required: true }) supplierLabel = '';
  @Input() manualSelectedIds: readonly string[] = [];
  @Input() filteredTotal = 0;
  @Input() filters: ContractApiFilters = {};
  @Input() initialMode: ContractBulkUpdateMode = 'filtered';

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly completed = new EventEmitter<ContractBulkUpdateExecuteResponse>();

  private readonly bulkService = inject(ContractBulkUpdateService);
  private readonly userService = inject(UserService);
  private readonly teamService = inject(TeamService);
  private readonly toast = inject(ToastService);

  readonly maxContracts = 250;
  readonly statusLabel = getBulkUpdateStatusLabel;
  readonly cancellationReasonOptions = CONTRACT_CANCELLATION_REASONS;

  phase: BulkUpdateModalPhase = 'configure';
  mode: ContractBulkUpdateMode = 'filtered';
  fieldStates: BulkFieldState[] = [];
  users: ProfileUser[] = [];
  teams: Team[] = [];

  isLoadingFields = true;
  isLoadingUsers = false;
  isLoadingTeams = false;
  isPreviewing = false;
  isExecuting = false;
  fieldsError = '';
  actionError = '';

  previewResponse: ContractBulkUpdatePreviewResponse | null = null;
  executionResult: ContractBulkUpdateExecuteResponse | null = null;
  idempotencyKey = '';
  private cancellationReasonAutoEnabled = false;

  ngOnInit(): void {
    this.mode = this.resolveInitialMode();
    this.loadFields();
  }

  get selectionCount(): number {
    return this.mode === 'selected' ? this.manualSelectedIds.length : this.filteredTotal;
  }

  get scopeExceedsLimit(): boolean {
    return this.selectionCount > this.maxContracts;
  }

  get enabledStates(): BulkFieldState[] {
    return this.fieldStates.filter((state) => state.enabled);
  }


  get visibleFieldStates(): BulkFieldState[] {
    return this.fieldStates.filter((state) => state.field.key !== 'motivoAnulacaoOutras');
  }

  get estadoState(): BulkFieldState | undefined {
    return this.fieldStates.find((state) => state.field.key === 'estado');
  }

  get cancellationReasonState(): BulkFieldState | undefined {
    return this.fieldStates.find((state) => state.field.key === 'motivoAnulacao');
  }

  get cancellationOtherState(): BulkFieldState | undefined {
    return this.fieldStates.find((state) => state.field.key === 'motivoAnulacaoOutras');
  }

  get requiresCancellationReasonContext(): boolean {
    const state = this.estadoState;
    return Boolean(state?.enabled && isContractCancellationState(String(state.value ?? '')));
  }

  get cancellationContextError(): string {
    if (!this.requiresCancellationReasonContext) return '';
    if (!this.cancellationReasonState) {
      return 'O catálogo desta comercializadora não disponibiliza o campo Motivo de anulação.';
    }
    if (!this.cancellationReasonState.enabled || !this.cancellationReasonState.value) {
      return 'Selecione o motivo de anulação antes de continuar.';
    }
    if (this.cancellationReasonState.value === 'Outras') {
      const otherState = this.cancellationOtherState;
      if (!otherState) {
        return 'O catálogo desta comercializadora não disponibiliza o campo Descreva o motivo.';
      }
      if (!otherState.enabled || !String(otherState.value ?? '').trim()) {
        return 'Descreva o motivo da anulação antes de continuar.';
      }
    }
    return '';
  }

  get canPreview(): boolean {
    return (
      !this.isLoadingFields &&
      !this.isPreviewing &&
      !this.isExecuting &&
      this.selectionCount > 0 &&
      !this.scopeExceedsLimit &&
      this.enabledStates.length > 0 &&
      !this.cancellationContextError &&
      this.enabledStates.every((state) => this.isStateValid(state))
    );
  }

  get previewTotal(): number {
    const response = this.previewResponse;
    const value = response?.total ?? response?.matched ?? response?.count;
    return Number.isFinite(value) ? Number(value) : this.selectionCount;
  }

  get recoveryUncertainCount(): number {
    return Number(
      this.executionResult?.recovery?.uncertain ??
      this.executionResult?.recovery?.uncertainCount ??
      0,
    ) || 0;
  }

  get recoveryPendingCount(): number {
    return Number(
      this.executionResult?.recovery?.pending ??
      this.executionResult?.recovery?.pendingCount ??
      0,
    ) || 0;
  }

  loadFields(): void {
    this.isLoadingFields = true;
    this.fieldsError = '';

    this.bulkService
      .getFields(this.provider)
      .pipe(finalize(() => (this.isLoadingFields = false)))
      .subscribe({
        next: (response) => {
          this.fieldStates = (response.fields ?? []).map((field) => ({
            field,
            enabled: false,
            operation: this.defaultOperation(field),
            value: null,
            teamIds: [],
          }));
          this.cancellationReasonAutoEnabled = false;

          if (!this.fieldStates.length) {
            this.fieldsError = 'Não existem campos disponíveis para atualização em massa.';
            return;
          }

          if (this.fieldStates.some((state) => state.field.type === 'user')) {
            this.loadUsers();
          }
          if (this.fieldStates.some((state) => state.field.type === 'teams')) {
            this.loadTeams();
          }
        },
        error: () => {
          this.fieldStates = [];
          this.fieldsError = 'Não foi possível carregar os campos disponíveis para atualização.';
        },
      });
  }

  setMode(mode: ContractBulkUpdateMode): void {
    if (mode === 'selected' && !this.manualSelectedIds.length) return;
    if (mode === 'filtered' && this.filteredTotal <= 0) return;
    this.mode = mode;
    this.invalidateReview();
  }

  toggleField(state: BulkFieldState, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    state.enabled = target.checked;

    if (state.field.key === 'motivoAnulacao') {
      this.cancellationReasonAutoEnabled = false;
      if (!state.enabled) {
        state.value = null;
        this.disableCancellationOtherState();
      }
    }

    if (state.field.key === 'estado') {
      this.syncCancellationReasonContext();
    }

    this.invalidateReview();
  }

  setOperation(state: BulkFieldState, operation: string): void {
    if (!state.field.operations.includes(operation as ContractBulkUpdateOperation)) return;
    state.operation = operation as ContractBulkUpdateOperation;
    this.invalidateReview();
  }

  setValue(state: BulkFieldState, value: string): void {
    state.value = value;

    if (state.field.key === 'estado' || state.field.key === 'motivoAnulacao') {
      this.syncCancellationReasonContext();
    }

    this.invalidateReview();
  }

  fieldOptions(state: BulkFieldState): readonly string[] {
    if (state.field.key === 'motivoAnulacao') {
      return this.cancellationReasonOptions;
    }
    return state.field.options ?? [];
  }

  setNumericValue(state: BulkFieldState, value: string | number | null): void {
    if (value === '' || value === null) {
      state.value = null;
    } else {
      const parsed = Number(value);
      state.value = Number.isFinite(parsed) ? parsed : null;
    }
    this.invalidateReview();
  }

  setBooleanValue(state: BulkFieldState, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    state.value = target.value === 'true';
    this.invalidateReview();
  }

  toggleTeam(state: BulkFieldState, teamId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const selected = new Set(state.teamIds);
    if (target.checked) selected.add(teamId);
    else selected.delete(teamId);
    state.teamIds = Array.from(selected);
    this.invalidateReview();
  }

  isTeamSelected(state: BulkFieldState, teamId: string): boolean {
    return state.teamIds.includes(teamId);
  }

  preview(): void {
    if (!this.canPreview) return;

    const payload = this.buildPreviewRequest();
    this.isPreviewing = true;
    this.actionError = '';

    this.bulkService
      .preview(this.provider, payload)
      .pipe(finalize(() => (this.isPreviewing = false)))
      .subscribe({
        next: (response) => {
          this.previewResponse = response;
          this.idempotencyKey = this.createIdempotencyKey();
          this.phase = 'review';
        },
        error: (error: HttpErrorResponse) => {
          this.actionError = this.getApiErrorMessage(
            error,
            'Não foi possível pré-visualizar a atualização em massa.',
          );
        },
      });
  }

  backToConfigure(): void {
    if (this.isExecuting) return;
    this.phase = 'configure';
    this.previewResponse = null;
    this.idempotencyKey = '';
    this.actionError = '';
  }

  execute(): void {
    if (this.isExecuting || this.phase !== 'review' || !this.idempotencyKey) return;

    const payload: ContractBulkUpdateExecuteRequest = {
      ...this.buildPreviewRequest(),
      idempotencyKey: this.idempotencyKey,
    };

    this.isExecuting = true;
    this.actionError = '';

    this.bulkService
      .execute(this.provider, payload)
      .pipe(finalize(() => (this.isExecuting = false)))
      .subscribe({
        next: (response) => {
          this.executionResult = response;
          this.phase = 'result';
          this.completed.emit(response);

          if (response.status === 'completed') {
            this.toast.success('Atualização em massa concluída com sucesso.');
          } else if (response.status === 'completed_with_errors') {
            this.toast.warning('Atualização concluída com alguns erros.');
          } else if (response.status === 'interrupted') {
            this.toast.warning('A atualização foi interrompida e necessita de verificação.');
          } else if (response.status === 'failed') {
            this.toast.error('A atualização em massa falhou. Consulte o detalhe da operação.');
          }
        },
        error: (error: HttpErrorResponse) => {
          this.actionError = this.getExecuteErrorMessage(error);
        },
      });
  }

  closeModal(): void {
    if (!this.isPreviewing && !this.isExecuting) this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeModal();
  }

  displayChangeValue(state: BulkFieldState): string {
    const change = this.buildChange(state);
    const value = change.value;

    if (state.field.type === 'boolean') return value === true ? 'Sim' : 'Não';

    if (state.field.type === 'user') {
      return this.users.find((user) => user.id === value)?.name ?? String(value ?? '—');
    }

    if (state.field.type === 'teams' && Array.isArray(value)) {
      const names = value.map((id) => this.teams.find((team) => team.id === id)?.name ?? id);
      return names.join(', ') || '—';
    }

    return value === null || value === '' ? '—' : String(value);
  }

  operationLabel(operation: ContractBulkUpdateOperation): string {
    const labels: Record<ContractBulkUpdateOperation, string> = {
      set: 'Definir',
      add: 'Adicionar',
      remove: 'Remover',
      replace: 'Substituir',
    };
    return labels[operation];
  }

  private syncCancellationReasonContext(): void {
    const reasonState = this.cancellationReasonState;
    const otherState = this.cancellationOtherState;

    if (this.requiresCancellationReasonContext) {
      if (reasonState && !reasonState.enabled) {
        reasonState.enabled = true;
        reasonState.operation = 'set';
        reasonState.value = null;
        this.cancellationReasonAutoEnabled = true;
      }
    } else if (this.cancellationReasonAutoEnabled && reasonState) {
      reasonState.enabled = false;
      reasonState.value = null;
      this.cancellationReasonAutoEnabled = false;
    }

    if (reasonState?.enabled && reasonState.value === 'Outras') {
      if (otherState) {
        otherState.enabled = true;
        otherState.operation = 'set';
      }
    } else {
      this.disableCancellationOtherState();
    }
  }

  private disableCancellationOtherState(): void {
    const otherState = this.cancellationOtherState;
    if (!otherState) return;
    otherState.enabled = false;
    otherState.value = null;
  }

  private loadUsers(): void {
    this.isLoadingUsers = true;
    this.userService
      .getAssignableUsers()
      .pipe(finalize(() => (this.isLoadingUsers = false)))
      .subscribe({
        next: (users) => (this.users = users.filter((user) => user.active !== false)),
        error: () => (this.users = []),
      });
  }

  private loadTeams(): void {
    this.isLoadingTeams = true;
    this.teamService
      .getTeams()
      .pipe(finalize(() => (this.isLoadingTeams = false)))
      .subscribe({
        next: (teams) => (this.teams = teams.filter((team) => team.active === true)),
        error: () => (this.teams = []),
      });
  }

  private resolveInitialMode(): ContractBulkUpdateMode {
    if (this.initialMode === 'selected' && this.manualSelectedIds.length) return 'selected';
    return 'filtered';
  }

  private defaultOperation(field: ContractBulkUpdateField): ContractBulkUpdateOperation {
    if (field.operations.includes('set')) return 'set';
    return field.operations[0] ?? 'set';
  }

  private isStateValid(state: BulkFieldState): boolean {
    if (!state.enabled) return true;
    if (state.field.type === 'teams') return state.teamIds.length > 0;
    if (state.field.type === 'boolean') return typeof state.value === 'boolean';
    if (state.field.type === 'number') return typeof state.value === 'number' && Number.isFinite(state.value);
    return typeof state.value === 'string' && state.value.trim().length > 0;
  }

  private buildChange(state: BulkFieldState): ContractBulkUpdateChange {
    const value: ContractBulkUpdateValue = state.field.type === 'teams'
      ? [...state.teamIds]
      : state.value;

    return {
      field: state.field.key,
      operation: state.operation,
      value,
    };
  }

  private buildPreviewRequest(): ContractBulkUpdatePreviewRequest {
    const changes = this.enabledStates.map((state) => this.buildChange(state));

    if (this.mode === 'selected') {
      return {
        mode: 'selected',
        ids: [...this.manualSelectedIds],
        changes,
      };
    }

    return {
      mode: 'filtered',
      filters: { ...this.filters },
      changes,
    };
  }

  private invalidateReview(): void {
    if (this.phase !== 'configure') this.phase = 'configure';
    this.previewResponse = null;
    this.executionResult = null;
    this.idempotencyKey = '';
    this.actionError = '';
  }

  private createIdempotencyKey(): string {
    const cryptoObject = globalThis.crypto;
    const suffix = typeof cryptoObject?.randomUUID === 'function'
      ? cryptoObject.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    return `bulk-update-${suffix}`;
  }

  private getExecuteErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 413) {
      return 'A operação excede o limite de 250 contratos. Restrinja a seleção ou os filtros.';
    }
    if (error.status === 409) {
      return 'Foi detetado um conflito de idempotência. Consulte o histórico antes de repetir a operação.';
    }
    if (error.status === 0 || error.status === 408 || error.status === 504) {
      return 'Não foi possível confirmar o resultado da operação. Não repita a atualização automaticamente; consulte o histórico para verificar o estado.';
    }

    return this.getApiErrorMessage(error, 'Não foi possível executar a atualização em massa.');
  }

  private getApiErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const body = error.error as { message?: string } | string | null;
    if (typeof body === 'string' && body.trim()) return body;
    if (body && typeof body === 'object' && typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
    return fallback;
  }
}
