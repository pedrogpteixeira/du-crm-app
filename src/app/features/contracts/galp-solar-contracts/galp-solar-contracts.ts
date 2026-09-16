import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  GALP_SOLAR_STATUSES,
  GalpSolarContract,
  GalpSolarContractService,
  GalpSolarContractStatus,
} from '../../../core/services/galp-solar-contract';

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
  matchesContractFilterValue,
} from '../../../core/utils/contract-list-filters';

@Component({
  selector: 'app-galp-solar-contracts',
  imports: [CommonModule, RouterLink, FormsModule],
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

  contracts: GalpSolarContract[] = [];

  filteredContracts: GalpSolarContract[] = [];

  filters: BaseContractFilters & { numeroLead: string; offer: string; registrationCode: string; panelType: string; panelCount: string; paymentMethod: string } = {
    ...createBaseContractFilters(),
    numeroLead: '',
      offer: '',
      registrationCode: '',
      panelType: '',
      panelCount: '',
      paymentMethod: '',
  };

  availableSegments: string[] = [];
  availableProducts: string[] = [];
  availableUsers: ContractFilterUserOption[] = [];

  showFilters = false;

  isLoading = false;
  errorMessage = '';

  viewMode: 'table' | 'kanban' = this.preferencesService.getContractsDefaultView();

  statuses: GalpSolarContractStatus[] = [...GALP_SOLAR_STATUSES];

  ngOnInit(): void {
    this.loadContracts();

    this.socketService
      .listenGalpSolarContractCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadContracts(false);
      });

    this.socketService
      .listenGalpSolarContractUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadContracts(false);
      });
  }

  loadContracts(showLoading = true): void {
    const currentUserId = this.auth.getCurrentUser()?.id;

    if (!currentUserId) {
      this.contracts = [];
      this.applyFilters();

      this.errorMessage = 'Não foi possível identificar o utilizador autenticado.';

      return;
    }

    if (showLoading) {
      this.isLoading = true;
    }

    this.errorMessage = '';

    this.galpSolarContractService
      .getByFollowerId(currentUserId)
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
            error?.error?.message || 'Não foi possível carregar os contratos Galp Solar.';
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
    this.viewMode = mode;
  }

  applyFilters(): void {
    this.filteredContracts = this.contracts.filter((contract) =>
      matchesBaseContractFilters(contract, this.filters) &&
        matchesContractFilterValue(contract.numeroLead, this.filters.numeroLead) &&
        matchesContractFilterValue(contract.offer, this.filters.offer) &&
        matchesContractFilterValue(contract.codigoRegistoCE, this.filters.registrationCode) &&
        matchesContractFilterValue(contract.tipoPainel, this.filters.panelType) &&
        matchesContractFilterValue(contract.numeroPaineisSolares, this.filters.panelCount) &&
        matchesContractFilterValue(contract.metodoPagamento, this.filters.paymentMethod),
    );
  }

  clearFilters(): void {
    this.filters = {
      ...createBaseContractFilters(),
      numeroLead: '',
      offer: '',
      registrationCode: '',
      panelType: '',
      panelCount: '',
      paymentMethod: '',
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

  get visibleStatuses(): readonly GalpSolarContractStatus[] {
    return getVisibleContractStatuses(this.statuses, this.filters.status);
  }

  getContractsByStatus(status: GalpSolarContractStatus): GalpSolarContract[] {
    return this.filteredContracts.filter((contract) => contract.estado === status);
  }

  getContractUserName(contract: GalpSolarContract): string {
    return contract.user?.name?.trim() || '—';
  }

  getValue(value: string | number | null | undefined): string | number {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return value;
  }
}
