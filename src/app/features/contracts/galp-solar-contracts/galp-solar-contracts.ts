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
  GALP_SOLAR_STATUSES,
  GalpSolarContractList,
  GalpSolarContractService,
  GalpSolarContractStatus,
} from '../../../core/services/galp-solar-contract';
import {
  BaseContractFilterOptions,
  ContractFilterFieldDefinition,
  ContractFilterUserOption,
  SolarContractFilters,
  buildBaseContractFilterOptions,
  buildContractApiFiltersFromDefinitions,
  cloneContractFilters,
  countActiveContractFilters,
  getVisibleContractStatuses,
  mergeBaseContractFilterOptions,
  buildSolarContractFilterFields,
  createSolarContractFilters,
} from '../../../core/utils/contract-list-filters';
import {
  ContractApiFilters,
  ContractKanbanColumnState,
  ContractKanbanResponse,
  hasAnyMoreContracts,
  mergeContractsById,
  prependContractById,
} from '../../../core/utils/contract-kanban';
import { ContractTableResponse } from '../../../core/utils/contract-table';
import { ContractListFiltersComponent } from '../../../shared/components/contract-list-filters/contract-list-filters';

@Component({
  selector: 'app-galp-solar-contracts',
  imports: [CommonModule, RouterLink, FormsModule, ContractListFiltersComponent],
  templateUrl: './galp-solar-contracts.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './galp-solar-contracts.scss',
})
export class GalpSolarContracts implements OnInit {
  private readonly galpSolarContractService = inject(GalpSolarContractService);
  private readonly socketService = inject(SocketService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);
  private loadRequestId = 0;

  contracts: GalpSolarContractList[] = [];
  filteredContracts: GalpSolarContractList[] = [];
  contractsByStatus: Record<string, GalpSolarContractList[]> = {};
  paginationByStatus: Record<string, ContractKanbanColumnState> = {};

  filters: SolarContractFilters = createSolarContractFilters();
  appliedFilters: SolarContractFilters = cloneContractFilters(this.filters);

  availableSegments: string[] = [];
  availableProducts: string[] = [];
  availableUsers: ContractFilterUserOption[] = [];
  private filterOptions: BaseContractFilterOptions = { segments: [], products: [], users: [] };
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
  readonly statuses: GalpSolarContractStatus[] = [...GALP_SOLAR_STATUSES];

  ngOnInit(): void {
    this.refreshFilterFields();
    this.loadContracts();

    this.socketService
      .listenGalpSolarContractCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleSocketContract(event, true));

    this.socketService
      .listenGalpSolarContractUpdated()
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

    this.galpSolarContractService
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
            error?.error?.message || 'Não foi possível carregar os contratos Galp Solar.';
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

    this.galpSolarContractService
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

    this.galpSolarContractService
      .getByFollowerId(userId, {
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
            error?.error?.message || 'Não foi possível carregar os contratos Galp Solar.';
        },
      });
  }

  loadMore(status: GalpSolarContractStatus): void {
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

    this.galpSolarContractService
      .getByFollowerId(userId, {
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
          this.buildFilterOptions();
        },
        error: (error) => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          this.errorMessage = error?.error?.message || 'Não foi possível carregar mais contratos.';
        },
      });
  }

  getStatusClass(status: GalpSolarContractStatus): string {
    return {
      'Pedido de Proposta': 'status-proposal-request',

      'Proposta enviada': 'status-proposal-sent',

      'Envio Quality Check': 'status-quality-check',

      'Pendente Docs': 'status-docs',

      'Documentos Enviados': 'status-docs-sent',

      'Em instalação': 'status-installation',

      Ativo: 'status-active',

      Cancelado: 'status-cancelled',
    }[status];
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
    this.loadContracts();
  }

  clearFilters(): void {
    this.filters = createSolarContractFilters();
    this.appliedFilters = cloneContractFilters(this.filters);
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

  hasMoreForStatus(status: GalpSolarContractStatus): boolean {
    return this.paginationByStatus[status]?.hasMore ?? false;
  }

  isLoadingStatus(status: GalpSolarContractStatus): boolean {
    return this.paginationByStatus[status]?.isLoading ?? false;
  }

  get visibleStatuses(): readonly GalpSolarContractStatus[] {
    return getVisibleContractStatuses(this.statuses, this.appliedFilters.status);
  }

  getContractsByStatus(status: GalpSolarContractStatus): GalpSolarContractList[] {
    return this.contractsByStatus[status] ?? [];
  }

  private buildApiFilters(): ContractApiFilters {
    return buildContractApiFiltersFromDefinitions(this.appliedFilters, this.filterFields);
  }

  private replaceWithTableResponse(
    response: ContractTableResponse<GalpSolarContractList>,
    append = false,
  ): void {
    this.totalContracts = Number.isFinite(response.total) ? Math.max(0, response.total) : 0;
    this.tableOffset = Number.isFinite(response.offset) ? Math.max(0, response.offset) : 0;
    this.tableLimit = Number.isFinite(response.limit) ? Math.max(0, response.limit) : 0;
    this.tableHasMore = response.hasMore === true;
    this.tableNextOffset = response.nextOffset ?? null;

    const incomingContracts = response.contracts ?? [];
    this.contracts = append ? [...this.contracts, ...incomingContracts] : [...incomingContracts];
    this.filteredContracts = this.contracts;
    this.buildFilterOptions();
  }

  private replaceWithResponse(response: ContractKanbanResponse<GalpSolarContractList>): void {
    this.totalContracts = Number.isFinite(response.total) ? Math.max(0, response.total) : 0;

    const contractsByStatus: Record<string, GalpSolarContractList[]> = {};
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
    this.buildFilterOptions();
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

  private buildFilterOptions(): void {
    this.filterOptions = mergeBaseContractFilterOptions(
      this.filterOptions,
      buildBaseContractFilterOptions(this.contracts),
    );

    this.availableSegments = this.filterOptions.segments;
    this.availableProducts = this.filterOptions.products;
    this.availableUsers = this.filterOptions.users;
    this.refreshFilterFields();
  }

  private refreshFilterFields(): void {
    const context = {
      segments: this.availableSegments,
      products: this.availableProducts,
      users: this.availableUsers,
    };

    this.filterFields = buildSolarContractFilterFields(context, {
      includeExpectedInstallation: true,
      includePanelType: true,
    });
  }

  private handleSocketContract(
    event: { contractId?: string; estado?: string },
    isCreated: boolean,
  ): void {
    const contractId = event.contractId;

    if (!contractId) {
      return;
    }

    if (this.viewMode === 'table') {
      this.loadTableContracts(false);
      return;
    }

    let existing: GalpSolarContractList | undefined;

    Object.values(this.contractsByStatus).some((contracts) => {
      existing = contracts.find((contract) => contract.id === contractId);
      return Boolean(existing);
    });

    if (!existing && (!isCreated || this.hasActiveFilters())) {
      return;
    }

    const nextStatus = String(event.estado ?? existing?.estado ?? '') as GalpSolarContractStatus;

    if (!nextStatus || !this.statuses.includes(nextStatus)) {
      return;
    }

    const updatedContract = {
      ...(existing ?? {}),
      ...event,
      id: contractId,
      estado: nextStatus,
    } as GalpSolarContractList;

    const nextColumns: Record<string, GalpSolarContractList[]> = {};
    Object.entries(this.contractsByStatus).forEach(([status, contracts]) => {
      nextColumns[status] = contracts.filter((contract) => contract.id !== contractId);
    });

    const stateFilterAllowsContract =
      !this.appliedFilters.status.length || this.appliedFilters.status.includes(nextStatus);

    if (stateFilterAllowsContract) {
      nextColumns[nextStatus] = prependContractById(nextColumns[nextStatus] ?? [], updatedContract);
    }

    this.contractsByStatus = nextColumns;
    this.syncFlatContracts();
    this.buildFilterOptions();
  }

  getContractUserName(contract: GalpSolarContractList): string {
    return contract.user?.name?.trim() || '—';
  }

  getValue(value: string | number | null | undefined): string | number {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return value;
  }
}
