import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  WALLBOX_CONTRACT_STATUSES,
  WallboxContract,
  WallboxContractService,
  WallboxContractStatus,
} from '../../../core/services/wallbox-contract';

import { Auth } from '../../../core/services/auth';
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
  selector: 'app-wallbox-contracts',
  imports: [CommonModule, RouterLink, FormsModule],
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

  contracts: WallboxContract[] = [];

  filteredContracts: WallboxContract[] = [];

  filters: BaseContractFilters & { numeroLead: string; offer: string; registrationCode: string } = {
    ...createBaseContractFilters(),
    numeroLead: '',
      offer: '',
      registrationCode: '',
  };

  availableSegments: string[] = [];
  availableProducts: string[] = [];
  availableUsers: ContractFilterUserOption[] = [];

  showFilters = false;

  isLoading = false;
  errorMessage = '';

  viewMode: 'table' | 'kanban' = this.preferencesService.getContractsDefaultView();

  readonly statuses: WallboxContractStatus[] = [...WALLBOX_CONTRACT_STATUSES];

  ngOnInit(): void {
    this.loadContracts();

    this.socketService
      .listenWallboxContractCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadContracts(false);
      });

    this.socketService
      .listenWallboxContractUpdated()
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

    this.wallboxContractService
      .getWallboxContracts(currentUserId)
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
            error?.error?.message || 'Não foi possível carregar os contratos Wallbox.';
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
    this.viewMode = mode;
  }

  applyFilters(): void {
    this.filteredContracts = this.contracts.filter((contract) =>
      matchesBaseContractFilters(contract, this.filters) &&
        matchesContractFilterValue(contract.numeroLead, this.filters.numeroLead) &&
        matchesContractFilterValue(contract.offer, this.filters.offer) &&
        matchesContractFilterValue(contract.codigoRegistoCE, this.filters.registrationCode),
    );
  }

  clearFilters(): void {
    this.filters = {
      ...createBaseContractFilters(),
      numeroLead: '',
      offer: '',
      registrationCode: '',
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

  get visibleStatuses(): readonly WallboxContractStatus[] {
    return getVisibleContractStatuses(this.statuses, this.filters.status);
  }

  getContractsByStatus(status: WallboxContractStatus): WallboxContract[] {
    return this.filteredContracts.filter((contract) => contract.estado === status);
  }

  getContractUserName(contract: WallboxContract): string {
    const contractWithUser = contract as WallboxContract & {
      user?: {
        name?: string;
      } | null;
    };

    return contractWithUser.user?.name?.trim() || '—';
  }

  getValue(value: string | number | null | undefined): string | number {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return value;
  }
}
