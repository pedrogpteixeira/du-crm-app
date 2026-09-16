import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  REPSOL_CONTRACT_STATUSES,
  RepsolContract,
  RepsolContractService,
  RepsolContractStatus,
} from '../../../core/services/repsol-contract';

import { SocketService } from '../../../core/services/socket';
import { PreferencesService } from '../../../core/services/preferences';
import { Auth } from '../../../core/services/auth';
import { sortContractsByUpdatedAtDesc } from '../../../core/utils/contract-sorting';
import {
  BaseContractFilters,
  ContractFilterUserOption,
  buildBaseContractFilterOptions,
  countActiveContractFilters,
  createBaseContractFilters,
  getVisibleContractStatuses,
  matchesBaseContractFilters,
} from '../../../core/utils/contract-list-filters';

@Component({
  selector: 'app-repsol-contracts',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './repsol-contracts.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './repsol-contracts.scss',
})
export class RepsolContracts implements OnInit {
  private readonly repsolContractService = inject(RepsolContractService);

  private readonly socketService = inject(SocketService);

  private readonly preferencesService = inject(PreferencesService);

  private readonly auth = inject(Auth);

  private readonly destroyRef = inject(DestroyRef);

  contracts: RepsolContract[] = [];

  filteredContracts: RepsolContract[] = [];

  filters: BaseContractFilters = {
    ...createBaseContractFilters(),
  };

  availableSegments: string[] = [];
  availableProducts: string[] = [];
  availableUsers: ContractFilterUserOption[] = [];

  showFilters = false;

  isLoading = false;
  errorMessage = '';

  viewMode: 'table' | 'kanban' = this.preferencesService.getContractsDefaultView();

  statuses: RepsolContractStatus[] = [...REPSOL_CONTRACT_STATUSES];

  ngOnInit(): void {
    this.loadContracts();

    this.socketService
      .listenRepsolContractCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadContracts();
      });

    this.socketService
      .listenRepsolContractUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadContracts();
      });
  }

  loadContracts(): void {
    const currentUserId = this.auth.getCurrentUser()?.id;

    if (!currentUserId) {
      this.contracts = [];
      this.applyFilters();
      this.errorMessage = 'Não foi possível identificar o utilizador autenticado.';

      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.repsolContractService
      .getRepsolContracts(currentUserId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (contracts) => {
          this.contracts = sortContractsByUpdatedAtDesc(contracts ?? []);
          this.buildFilterOptions();
          this.applyFilters();
        },
        error: (error) => {
          this.contracts = [];
          this.applyFilters();

          this.errorMessage =
            error?.error?.message || 'Não foi possível carregar os contratos Repsol.';
        },
      });
  }

  getStatusClass(status: RepsolContractStatus): string {
    return {
      'Pedido de Chamada': 'status-call-request',

      'Em validação': 'status-validation',

      'Chamada Efetuada': 'status-call-done',

      'Pendente Assinatura Digital': 'status-signature',

      'Não Conformidade': 'status-non-compliance',

      'Pendente Docs': 'status-docs',

      'Documentos Enviados': 'status-docs-sent',

      Atribuído: 'status-assigned',

      Cancelado: 'status-cancelled',
    }[status];
  }

  setViewMode(mode: 'table' | 'kanban'): void {
    this.viewMode = mode;
  }

  applyFilters(): void {
    this.filteredContracts = this.contracts.filter((contract) =>
      matchesBaseContractFilters(contract, this.filters),
    );
  }

  clearFilters(): void {
    this.filters = {
      ...createBaseContractFilters(),
    };

    this.applyFilters();
    this.showFilters = false;
  }

  hasActiveFilters(): boolean {
    return this.activeFilterCount > 0;
  }

  get activeFilterCount(): number {
    return countActiveContractFilters(this.filters);
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  private buildFilterOptions(): void {
    const options = buildBaseContractFilterOptions(this.contracts);

    this.availableSegments = options.segments;
    this.availableProducts = options.products;
    this.availableUsers = options.users;
  }

  get visibleStatuses(): readonly RepsolContractStatus[] {
    return getVisibleContractStatuses(this.statuses, this.filters.status);
  }

  getContractsByStatus(status: RepsolContractStatus): RepsolContract[] {
    return this.filteredContracts.filter((contract) => contract.estado === status);
  }

  getContractUserName(contract: RepsolContract): string {
    return contract.user?.name?.trim() || '—';
  }

  getValue(value: string | number | null | undefined): string | number {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return value;
  }
}
