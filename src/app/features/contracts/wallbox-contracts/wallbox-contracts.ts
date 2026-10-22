import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Auth } from '../../../core/services/auth';
import { PreferencesService } from '../../../core/services/preferences';
import { SocketService } from '../../../core/services/socket';
import {
  WALLBOX_CONTRACT_STATUSES,
  WallboxContractList,
  WallboxContractService,
  WallboxContractStatus,
} from '../../../core/services/wallbox-contract';
import {
  ContractFilterFieldDefinition,
  WallboxContractFilters,
  buildContractApiFiltersFromDefinitions,
  cloneContractFilters,
  countActiveContractFilters,
  getVisibleContractStatuses,
  buildWallboxContractFilterFields,
  createWallboxContractFilters,
} from '../../../core/utils/contract-list-filters';
import {
  ContractApiFilters,
  ContractListSocketPayload,
  formatContractListDate,
  mergeContractListSocketPayload,
  ContractKanbanColumnState,
  ContractKanbanResponse,
  hasAnyMoreContracts,
  mergeContractsById,
  prependContractById,
} from '../../../core/utils/contract-kanban';
import { ContractTableResponse } from '../../../core/utils/contract-table';
import {
  buildContractExportFilters,
  ContractExportSelection,
} from '../../../core/utils/contract-export';
import { ContractListFiltersComponent } from '../../../shared/components/contract-list-filters/contract-list-filters';
import { ContractExportModalComponent } from '../../../shared/components/contract-export-modal/contract-export-modal';
import { ContractBulkUpdateModalComponent } from '../../../shared/components/contract-bulk-update-modal/contract-bulk-update-modal';

@Component({
  selector: 'app-wallbox-contracts',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ContractListFiltersComponent,
    ContractExportModalComponent,
    ContractBulkUpdateModalComponent,
  ],
  templateUrl: './wallbox-contracts.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './wallbox-contracts.scss',
})
export class WallboxContracts implements OnInit {
  private readonly wallboxContractService = inject(WallboxContractService);
  private readonly socketService = inject(SocketService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);
  private loadRequestId = 0;

  readonly exportSelection = new ContractExportSelection();
  bulkUpdateModalOpen = false;
  bulkUpdateNeedsRefresh = false;

  contracts: WallboxContractList[] = [];
  filteredContracts: WallboxContractList[] = [];
  contractsByStatus: Record<string, WallboxContractList[]> = {};
  paginationByStatus: Record<string, ContractKanbanColumnState> = {};

  filters: WallboxContractFilters = createWallboxContractFilters();
  appliedFilters: WallboxContractFilters = cloneContractFilters(this.filters);

  filterFields: ContractFilterFieldDefinition[] = [];

  totalContracts = 0;
  tableOffset = 0;
  tableLimit = 0;
  tableHasMore = false;
  tableNextOffset: number | null = null;

  showFilters = false;
  isLoadingTable = false;
  isLoadingKanban = false;
  isLoadingMore = false;
  errorMessage = '';

  get isLoading(): boolean {
    return this.viewMode === 'table' ? this.isLoadingTable : this.isLoadingKanban;
  }

  viewMode: 'table' | 'kanban' = this.preferencesService.getContractsDefaultView();
  readonly statuses: WallboxContractStatus[] = [...WALLBOX_CONTRACT_STATUSES];

  readonly formatListDate = formatContractListDate;

  ngOnInit(): void {
    this.refreshFilterFields();
    this.loadContracts();

    this.socketService
      .listenWallboxContractCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleSocketContract(event, true));

    this.socketService
      .listenWallboxContractUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleSocketContract(event, false));
  }

  loadContracts(showLoading = true): void {
    if (this.viewMode === 'table') {
      this.isLoadingKanban = false;
      this.loadTableContracts(showLoading);
      return;
    }

    this.isLoadingTable = false;
    this.isLoadingMore = false;
    this.loadKanbanContracts(showLoading);
  }

  private loadTableContracts(showLoading = true): void {
    const currentUser = this.auth.getCurrentUser() as { id?: string; _id?: string } | null;
    const userId = currentUser?.id ?? currentUser?._id;

    if (!userId) {
      this.resetLoadedContracts();
      this.errorMessage = 'Não foi possível identificar o utilizador autenticado.';
      return;
    }

    const requestId = ++this.loadRequestId;
    this.resetLoadedContracts();

    if (showLoading) {
      this.isLoadingTable = true;
    }

    this.errorMessage = '';

    this.wallboxContractService
      .getTableContracts(userId, {
        offset: 0,
        estado: this.appliedFilters.status,
        filters: this.buildApiFilters(),
      })
      .pipe(
        finalize(() => {
          if (showLoading && requestId === this.loadRequestId) {
            this.isLoadingTable = false;
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.loadRequestId || this.viewMode !== 'table') {
            return;
          }

          this.replaceWithTableResponse(response);

        },
        error: (error) => {
          if (requestId !== this.loadRequestId || this.viewMode !== 'table') {
            return;
          }

          this.resetLoadedContracts();
          this.errorMessage =
            error?.error?.message || 'Não foi possível carregar os contratos Wallbox.';
        },
      });
  }

  loadMoreTable(): void {
    const currentUser = this.auth.getCurrentUser() as { id?: string; _id?: string } | null;
    const userId = currentUser?.id ?? currentUser?._id;
    const nextOffset = this.tableNextOffset;
    const requestId = this.loadRequestId;

    if (
      !userId ||
      !this.tableHasMore ||
      nextOffset === null ||
      this.isLoadingMore ||
      this.viewMode !== 'table'
    ) {
      return;
    }

    this.isLoadingMore = true;
    this.errorMessage = '';

    this.wallboxContractService
      .getTableContracts(userId, {
        offset: nextOffset,
        estado: this.appliedFilters.status,
        filters: this.buildApiFilters(),
      })
      .pipe(
        finalize(() => {
          if (requestId === this.loadRequestId) {
            this.isLoadingMore = false;
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.loadRequestId || this.viewMode !== 'table') {
            return;
          }

          this.replaceWithTableResponse(response, true);
        },
        error: (error) => {
          if (requestId !== this.loadRequestId || this.viewMode !== 'table') {
            return;
          }

          this.errorMessage = error?.error?.message || 'Não foi possível carregar mais contratos.';
        },
      });
  }

  private loadKanbanContracts(showLoading = true): void {
    const currentUser = this.auth.getCurrentUser() as { id?: string; _id?: string } | null;
    const userId = currentUser?.id ?? currentUser?._id;

    if (!userId) {
      this.resetLoadedContracts();
      this.errorMessage = 'Não foi possível identificar o utilizador autenticado.';
      return;
    }

    const requestId = ++this.loadRequestId;
    this.resetLoadedContracts();

    if (showLoading) {
      this.isLoadingKanban = true;
    }

    this.errorMessage = '';

    this.wallboxContractService
      .getWallboxContracts(userId, {
        offset: 5,
        estado: this.appliedFilters.status,
        filters: this.buildApiFilters(),
      })
      .pipe(
        finalize(() => {
          if (showLoading && requestId === this.loadRequestId) {
            this.isLoadingKanban = false;
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          this.replaceWithResponse(response);
        },
        error: (error) => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          this.resetLoadedContracts();
          this.errorMessage =
            error?.error?.message || 'Não foi possível carregar os contratos Wallbox.';
        },
      });
  }

  loadMore(status: WallboxContractStatus): void {
    const user = this.auth.getCurrentUser() as { id?: string; _id?: string } | null;
    const userId = user?.id ?? user?._id;
    const column = this.paginationByStatus[status];
    const requestId = this.loadRequestId;

    if (!userId || !column?.hasMore || !column.nextOffset || column.isLoading) {
      return;
    }

    this.paginationByStatus = {
      ...this.paginationByStatus,
      [status]: { ...column, isLoading: true },
    };

    this.wallboxContractService
      .getWallboxContracts(userId, {
        offset: column.nextOffset,
        estado: status,
        filters: this.buildApiFilters(),
      })
      .pipe(
        finalize(() => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          const latest = this.paginationByStatus[status];
          if (latest) {
            this.paginationByStatus = {
              ...this.paginationByStatus,
              [status]: { ...latest, isLoading: false },
            };
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          const state = response.states.find((item) => item.estado === status);

          if (!state) {
            this.paginationByStatus = {
              ...this.paginationByStatus,
              [status]: { hasMore: false, nextOffset: null, isLoading: false },
            };
            return;
          }

          this.contractsByStatus = {
            ...this.contractsByStatus,
            [status]: mergeContractsById(
              this.contractsByStatus[status] ?? [],
              state.contracts ?? [],
            ),
          };
          this.paginationByStatus = {
            ...this.paginationByStatus,
            [status]: {
              hasMore: state.hasMore,
              nextOffset: state.nextOffset,
              isLoading: false,
            },
          };

          this.syncFlatContracts();
        },
        error: (error) => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          this.errorMessage = error?.error?.message || 'Não foi possível carregar mais contratos.';
        },
      });
  }

  getStatusClass(status: WallboxContractStatus): string {
    const classes: Record<WallboxContractStatus, string> = {
      'Pedido de Chamada': 'status-call-request',

      'Registo Plataforma Galp': 'status-signature',

      'Não conformidade': 'status-non-compliance',

      'Pendente Docs': 'status-docs',

      'Documentos Enviados': 'status-docs-sent',

      'Em Ativação': 'status-assigned',

      Ativo: 'status-active',

      Anulado: 'status-cancelled',
    };

    return classes[status];
  }

  setViewMode(mode: 'table' | 'kanban'): void {
    if (this.viewMode === mode) {
      return;
    }

    this.viewMode = mode;
    this.loadContracts();
  }

  applyFilters(): void {
    this.appliedFilters = cloneContractFilters(this.filters);
    this.exportSelection.clear();
    this.loadContracts();
  }

  clearFilters(): void {
    this.filters = createWallboxContractFilters();
    this.appliedFilters = cloneContractFilters(this.filters);
    this.exportSelection.clear();
    this.loadContracts();
  }

  hasActiveFilters(): boolean {
    return this.activeFilterCount > 0;
  }

  get activeFilterCount(): number {
    return countActiveContractFilters(this.appliedFilters);
  }

  get hasMoreInAnyState(): boolean {
    return this.viewMode === 'table'
      ? this.tableHasMore
      : hasAnyMoreContracts(this.paginationByStatus);
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  hasMoreForStatus(status: WallboxContractStatus): boolean {
    return this.paginationByStatus[status]?.hasMore ?? false;
  }

  isLoadingStatus(status: WallboxContractStatus): boolean {
    return this.paginationByStatus[status]?.isLoading ?? false;
  }

  get visibleStatuses(): readonly WallboxContractStatus[] {
    return getVisibleContractStatuses(this.statuses, this.appliedFilters.status);
  }

  getContractsByStatus(status: WallboxContractStatus): WallboxContractList[] {
    return this.contractsByStatus[status] ?? [];
  }

  get canBulkUpdateContracts(): boolean {
    return this.auth.roleIncludes(['Super Admin', 'DU']);
  }

  openBulkUpdateModal(): void {
    if (!this.canBulkUpdateContracts || this.viewMode !== 'table') {
      return;
    }

    this.bulkUpdateNeedsRefresh = false;
    this.bulkUpdateModalOpen = true;
  }

  markBulkUpdateCompleted(): void {
    this.bulkUpdateNeedsRefresh = true;
  }

  closeBulkUpdateModal(): void {
    this.bulkUpdateModalOpen = false;

    if (!this.bulkUpdateNeedsRefresh) {
      return;
    }

    this.bulkUpdateNeedsRefresh = false;
    this.exportSelection.clear();
    this.loadContracts();
  }

  getExportFilters(): ContractApiFilters {
    return buildContractExportFilters(this.buildApiFilters(), this.appliedFilters.status);
  }

  private buildApiFilters(): ContractApiFilters {
    return buildContractApiFiltersFromDefinitions(this.appliedFilters, this.filterFields);
  }

  private replaceWithTableResponse(
    response: ContractTableResponse<WallboxContractList>,
    append = false,
  ): void {
    this.totalContracts = Number.isFinite(response.total) ? Math.max(0, response.total) : 0;
    this.tableOffset = Number.isFinite(response.offset) ? Math.max(0, response.offset) : 0;
    this.tableLimit = Number.isFinite(response.limit) ? Math.max(0, response.limit) : 0;
    this.tableHasMore = response.hasMore === true;
    this.tableNextOffset = response.nextOffset ?? null;

    const incomingContracts = response.contracts ?? [];
    this.contracts = append
      ? mergeContractsById(this.contracts, incomingContracts)
      : [...incomingContracts];
    this.filteredContracts = this.contracts;
  }

  private replaceWithResponse(response: ContractKanbanResponse<WallboxContractList>): void {
    this.totalContracts = Number.isFinite(response.total) ? Math.max(0, response.total) : 0;

    const contractsByStatus: Record<string, WallboxContractList[]> = {};
    const paginationByStatus: Record<string, ContractKanbanColumnState> = {};

    this.statuses.forEach((status) => {
      contractsByStatus[status] = [];
      paginationByStatus[status] = { hasMore: false, nextOffset: null, isLoading: false };
    });

    (response.states ?? []).forEach((state) => {
      contractsByStatus[state.estado] = mergeContractsById([], state.contracts ?? []);
      paginationByStatus[state.estado] = {
        hasMore: state.hasMore,
        nextOffset: state.nextOffset,
        isLoading: false,
      };
    });

    this.contractsByStatus = contractsByStatus;
    this.paginationByStatus = paginationByStatus;
    this.syncFlatContracts();
  }

  private syncFlatContracts(): void {
    const knownStatuses = new Set<string>(this.statuses);
    const ordered = this.statuses.flatMap((status) => this.contractsByStatus[status] ?? []);
    const additional = Object.entries(this.contractsByStatus)
      .filter(([status]) => !knownStatuses.has(status))
      .flatMap(([, contracts]) => contracts);

    this.contracts = mergeContractsById([], [...ordered, ...additional]);
    this.filteredContracts = this.contracts;
  }

  private resetLoadedContracts(): void {
    this.totalContracts = 0;
    this.contracts = [];
    this.filteredContracts = [];
    this.contractsByStatus = {};
    this.paginationByStatus = {};
    this.tableOffset = 0;
    this.tableLimit = 0;
    this.tableHasMore = false;
    this.tableNextOffset = null;
    this.isLoadingMore = false;
  }

  private refreshFilterFields(): void {
    const context = {
      segments: [],
      products: [],
      users: [],
    };

    this.filterFields = buildWallboxContractFilterFields(context);
  }

  private handleSocketContract(
    event: ContractListSocketPayload,
    isCreated: boolean,
  ): void {
    const contractId = event.contractId?.trim();

    if (!contractId) {
      return;
    }

    if (this.hasActiveFilters()) {
      if (this.viewMode === 'table') {
        this.loadTableContracts(false);
      } else {
        this.loadKanbanContracts(false);
      }

      return;
    }

    if (this.viewMode === 'table') {
      const existing = this.contracts.find((contract) => contract.id === contractId);
      const nextStatus = String(event.estado ?? existing?.estado ?? '') as WallboxContractStatus;

      if (!nextStatus || !this.statuses.includes(nextStatus)) {
        return;
      }

      const updatedContract: WallboxContractList = mergeContractListSocketPayload(
        existing,
        event,
        nextStatus,
      );

      if (isCreated && !existing) {
        this.totalContracts += 1;
      }

      this.contracts = prependContractById(this.contracts, updatedContract);
      this.filteredContracts = this.contracts;
      return;
    }

    let existing: WallboxContractList | undefined;

    Object.values(this.contractsByStatus).some((contracts) => {
      existing = contracts.find((contract) => contract.id === contractId);
      return Boolean(existing);
    });

    const nextStatus = String(event.estado ?? existing?.estado ?? '') as WallboxContractStatus;

    if (!nextStatus || !this.statuses.includes(nextStatus)) {
      return;
    }

    if (isCreated && !existing) {
      this.totalContracts += 1;
    }

    const updatedContract: WallboxContractList = mergeContractListSocketPayload(
      existing,
      event,
      nextStatus,
    );

    const nextColumns: Record<string, WallboxContractList[]> = {};
    Object.entries(this.contractsByStatus).forEach(([columnStatus, contracts]) => {
      nextColumns[columnStatus] = contracts.filter((contract) => contract.id !== contractId);
    });

    nextColumns[nextStatus] = prependContractById(nextColumns[nextStatus] ?? [], updatedContract);

    this.contractsByStatus = nextColumns;
    this.syncFlatContracts();
  }

  getValue(value: string | number | null | undefined): string | number {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return value;
  }
}
