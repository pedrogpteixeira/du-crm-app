import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { Auth } from '../../../core/services/auth';
import { PreferencesService } from '../../../core/services/preferences';
import { SocketService } from '../../../core/services/socket';
import {
  YES_ENERGY_CONTRACT_STATUSES,
  YesEnergyContract,
  YesEnergyContractService,
  YesEnergyContractStatus,
} from '../../../core/services/yes-energy-contract';
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

interface AuthenticatedUserLike {
  id?: string;
  _id?: string;
}

@Component({
  selector: 'app-yes-energy-contracts',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './yes-energy-contracts.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './yes-energy-contracts.scss',
})
export class YesEnergyContracts implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  private readonly auth = inject(Auth);

  private readonly preferencesService = inject(PreferencesService);

  private readonly socketService = inject(SocketService);

  private readonly yesEnergyContractService = inject(YesEnergyContractService);

  contracts: YesEnergyContract[] = [];

  filteredContracts: YesEnergyContract[] = [];

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

  readonly statuses: YesEnergyContractStatus[] = [...YES_ENERGY_CONTRACT_STATUSES];

  ngOnInit(): void {
    this.loadContracts();

    this.socketService
      .listenYesEnergyContractCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadContracts(false);
      });

    this.socketService
      .listenYesEnergyContractUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadContracts(false);
      });
  }

  loadContracts(showLoading = true): void {
    const currentUser = this.auth.getCurrentUser() as AuthenticatedUserLike | null;

    const userId = currentUser?.id ?? currentUser?._id ?? '';

    if (!userId) {
      this.contracts = [];
      this.applyFilters();
      this.errorMessage = 'Não foi possível identificar o utilizador atual.';
      return;
    }

    if (showLoading) {
      this.isLoading = true;
    }

    this.errorMessage = '';

    this.yesEnergyContractService
      .getYesEnergyContracts(userId)
      .pipe(
        finalize(() => {
          if (showLoading) {
            this.isLoading = false;
          }
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
            error?.error?.message || 'Não foi possível carregar os contratos Yes Energy.';
        },
      });
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

  get visibleStatuses(): readonly YesEnergyContractStatus[] {
    return getVisibleContractStatuses(this.statuses, this.filters.status);
  }

  getContractsByStatus(status: YesEnergyContractStatus): YesEnergyContract[] {
    return this.filteredContracts.filter((contract) => contract.estado === status);
  }

  getStatusClass(status: YesEnergyContractStatus): string {
    const classes: Record<YesEnergyContractStatus, string> = {
      'Pedido de Contratação': 'status-contract-request',

      'Pendente Assinatura Digital': 'status-signature',

      'Pendente (ATR)': 'status-atr',

      'Não Conformidade': 'status-non-compliance',

      'Pendente Docs': 'status-docs',

      'Documentos Enviados': 'status-docs-sent',

      'Desistência/Recuperar': 'status-contract-sent',

      'Em Ativação': 'status-activation',

      Ativo: 'status-active',

      'Parcialmente Baixa': 'status-partial-low',

      Baixa: 'status-low',

      Anulado: 'status-cancelled',
    };

    return classes[status];
  }

  getContractUserName(contract: YesEnergyContract): string {
    return contract.user?.name?.trim() || '—';
  }

  getValue(value: string | number | null | undefined): string | number {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return value;
  }
}
