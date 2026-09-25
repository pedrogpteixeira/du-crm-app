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
  IBERDROLA_CONTRACT_STATUSES,
  IberdrolaContractList,
  IberdrolaContractService,
  IberdrolaContractStatus,
} from '../../../core/services/iberdrola-contract';
import {
  BaseContractFilterOptions,
  ContractFilterFieldDefinition,
  ContractFilterUserOption,
  EnergyContractFilters,
  buildBaseContractFilterOptions,
  buildContractApiFiltersFromDefinitions,
  cloneContractFilters,
  countActiveContractFilters,
  getVisibleContractStatuses,
  mergeBaseContractFilterOptions,
  buildEnergyContractFilterFields,
  createEnergyContractFilters,
} from '../../../core/utils/contract-list-filters';
import {
  ContractApiFilters,
  ContractKanbanColumnState,
  ContractKanbanResponse,
  hasAnyMoreContracts,
  mergeContractsById,
  prependContractById,
} from '../../../core/utils/contract-kanban';
import { ContractListFiltersComponent } from '../../../shared/components/contract-list-filters/contract-list-filters';

@Component({
  selector: 'app-iberdrola-contracts',
  imports: [CommonModule, RouterLink, FormsModule, ContractListFiltersComponent],
  templateUrl: './iberdrola-contracts.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './iberdrola-contracts.scss',
})
export class IberdrolaContracts implements OnInit {
  private readonly iberdrolaContractService = inject(IberdrolaContractService);
  private readonly socketService = inject(SocketService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);
  private loadRequestId = 0;

  contracts: IberdrolaContractList[] = [];
  filteredContracts: IberdrolaContractList[] = [];
  contractsByStatus: Record<string, IberdrolaContractList[]> = {};
  paginationByStatus: Record<string, ContractKanbanColumnState> = {};

  filters: EnergyContractFilters & { idVenda: string } = {
    ...createEnergyContractFilters(),
    idVenda: '',
  };
  appliedFilters: EnergyContractFilters & { idVenda: string } = cloneContractFilters(this.filters);

  availableSegments: string[] = [];
  availableProducts: string[] = [];
  availableUsers: ContractFilterUserOption[] = [];
  private filterOptions: BaseContractFilterOptions = { segments: [], products: [], users: [] };
  filterFields: ContractFilterFieldDefinition[] = [];

  totalContracts = 0;

  showFilters = false;
  isLoading = false;
  errorMessage = '';

  viewMode: 'table' | 'kanban' = this.preferencesService.getContractsDefaultView();
  readonly statuses: IberdrolaContractStatus[] = [...IBERDROLA_CONTRACT_STATUSES];

  ngOnInit(): void {
    this.refreshFilterFields();
    this.loadContracts();

    this.socketService
      .listenIberdrolaContractCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleSocketContract(event, true));

    this.socketService
      .listenIberdrolaContractUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleSocketContract(event, false));
  }

  loadContracts(showLoading = true): void {
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
      this.isLoading = true;
    }

    this.errorMessage = '';

    this.iberdrolaContractService
      .getIberdrolaContracts(userId, {
        offset: 5,
        estado: this.appliedFilters.status,
        filters: this.buildApiFilters(),
      })
      .pipe(
        finalize(() => {
          if (showLoading && requestId === this.loadRequestId) {
            this.isLoading = false;
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
            error?.error?.message || 'Não foi possível carregar os contratos Iberdrola.';
        },
      });
  }

  loadMore(status: IberdrolaContractStatus): void {
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

    this.iberdrolaContractService
      .getIberdrolaContracts(userId, {
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

  getStatusClass(status: IberdrolaContractStatus): string {
    const classes: Record<IberdrolaContractStatus, string> = {
      'Pedido de Contratação': 'status-contract-request',
      'Pedido de Simulação': 'status-simulation',
      'Pendente Validação Comercial': 'status-commercial-validation',
      'Pedido SMS (RGPD)': 'status-rgpd',
      'Pedido VTV': 'status-vtv',
      'Pendente SMS "Cond Contratuais"': 'status-contractual-sms',
      'Não Conformidade': 'status-non-compliance',
      'Pendente Docs': 'status-docs',
      'Documentos Enviados': 'status-docs-sent',
      BackOffice: 'status-backoffice',
      Controle: 'status-control',
      'Pedido de Fornecimento': 'status-supply-request',
      'Em fornecimento': 'status-supply',
      Ativo: 'status-active',
      'Parcialmente Baixa': 'status-partial-low',
      Cancelado: 'status-cancelled',
      Baixa: 'status-low',
    };

    return classes[status];
  }

  setViewMode(mode: 'table' | 'kanban'): void {
    this.viewMode = mode;
  }

  applyFilters(): void {
    this.appliedFilters = cloneContractFilters(this.filters);
    this.loadContracts();
  }

  clearFilters(): void {
    this.filters = { ...createEnergyContractFilters(), idVenda: '' };
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
    return hasAnyMoreContracts(this.paginationByStatus);
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  hasMoreForStatus(status: IberdrolaContractStatus): boolean {
    return this.paginationByStatus[status]?.hasMore ?? false;
  }

  isLoadingStatus(status: IberdrolaContractStatus): boolean {
    return this.paginationByStatus[status]?.isLoading ?? false;
  }

  get visibleStatuses(): readonly IberdrolaContractStatus[] {
    return getVisibleContractStatuses(this.statuses, this.appliedFilters.status);
  }

  getContractsByStatus(status: IberdrolaContractStatus): IberdrolaContractList[] {
    return this.contractsByStatus[status] ?? [];
  }

  private buildApiFilters(): ContractApiFilters {
    return buildContractApiFiltersFromDefinitions(this.appliedFilters, this.filterFields);
  }

  private replaceWithResponse(response: ContractKanbanResponse<IberdrolaContractList>): void {
    this.totalContracts = Number.isFinite(response.total) ? Math.max(0, response.total) : 0;

    const contractsByStatus: Record<string, IberdrolaContractList[]> = {};
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

    this.filterFields = [
      ...buildEnergyContractFilterFields(context, {
        includeCitizenCard: true,
        includeSva: true,
      }),
      {
        key: 'idVenda',
        label: 'ID Venda',
        apiKey: 'idVenda__contains',
        type: 'search',
        group: 'Identificação',
      },
    ];
  }

  private handleSocketContract(
    event: { contractId?: string; estado?: string },
    isCreated: boolean,
  ): void {
    const contractId = event.contractId;

    if (!contractId) {
      return;
    }

    let existing: IberdrolaContractList | undefined;

    Object.values(this.contractsByStatus).some((contracts) => {
      existing = contracts.find((contract) => contract.id === contractId);
      return Boolean(existing);
    });

    if (!existing && (!isCreated || this.hasActiveFilters())) {
      return;
    }

    const nextStatus = String(event.estado ?? existing?.estado ?? '') as IberdrolaContractStatus;

    if (!nextStatus || !this.statuses.includes(nextStatus)) {
      return;
    }

    const updatedContract = {
      ...(existing ?? {}),
      ...event,
      id: contractId,
      estado: nextStatus,
    } as IberdrolaContractList;

    const nextColumns: Record<string, IberdrolaContractList[]> = {};
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

  getContractUserName(contract: IberdrolaContractList): string {
    return contract.user?.name?.trim() || '—';
  }

  getValue(value: string | number | null | undefined): string | number {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return value;
  }
}
