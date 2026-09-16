import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Auth } from '../../../core/services/auth';
import {
  IBERDROLA_SOLAR_CONTRACT_STATUSES,
  IberdrolaSolarContract,
  IberdrolaSolarContractService,
  IberdrolaSolarContractStatus,
} from '../../../core/services/iberdrola-solar-contract';
import { PreferencesService } from '../../../core/services/preferences';
import { SocketService } from '../../../core/services/socket';
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
  selector: 'app-iberdrola-solar-contracts',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './iberdrola-solar-contracts.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './iberdrola-solar-contracts.scss',
})
export class IberdrolaSolarContracts implements OnInit {
  private readonly service = inject(IberdrolaSolarContractService);

  private readonly socketService = inject(SocketService);

  private readonly preferencesService = inject(PreferencesService);

  private readonly auth = inject(Auth);

  private readonly destroyRef = inject(DestroyRef);

  contracts: IberdrolaSolarContract[] = [];

  filteredContracts: IberdrolaSolarContract[] = [];

  filters: BaseContractFilters & { numeroLead: string; offer: string; registrationCode: string; campaign: string; panelCount: string; paymentMethod: string } = {
    ...createBaseContractFilters(),
    numeroLead: '',
      offer: '',
      registrationCode: '',
      campaign: '',
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

  readonly statuses: readonly IberdrolaSolarContractStatus[] = IBERDROLA_SOLAR_CONTRACT_STATUSES;

  ngOnInit(): void {
    this.loadContracts();

    this.socketService
      .listenIberdrolaSolarContractCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadContracts(false);
      });

    this.socketService
      .listenIberdrolaSolarContractUpdated()
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

    this.service
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
            error?.error?.message || 'Não foi possível carregar os contratos Iberdrola Solar.';
        },
      });
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
        matchesContractFilterValue(contract.campaign?.name, this.filters.campaign) &&
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
      campaign: '',
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

  get visibleStatuses(): readonly IberdrolaSolarContractStatus[] {
    return getVisibleContractStatuses(this.statuses, this.filters.status);
  }

  getContractsByStatus(status: IberdrolaSolarContractStatus): IberdrolaSolarContract[] {
    return this.filteredContracts.filter((contract) => contract.estado === status);
  }

  getStatusClass(status: IberdrolaSolarContractStatus): string {
    const classes: Record<IberdrolaSolarContractStatus, string> = {
      'Pedido de Proposta': 'status-proposal-request',
      'Proposta Enviada': 'status-proposal-sent',
      'Pendente Docs': 'status-docs',
      'Documentos Enviados': 'status-docs-sent',
      'Em instalação': 'status-installation',
      Cancelado: 'status-cancelled',
      Ativo: 'status-active',
    };

    return classes[status];
  }

  getContractUserName(contract: IberdrolaSolarContract): string {
    return contract.user?.name?.trim() || '—';
  }

  getCampaignName(contract: IberdrolaSolarContract): string {
    return contract.campaign?.name?.trim() || '—';
  }

  getValue(value: string | number | null | undefined): string | number {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return value;
  }
}
