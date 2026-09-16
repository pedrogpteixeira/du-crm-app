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
  IBERDROLA_CONTRACT_STATUSES,
  IberdrolaContract,
  IberdrolaContractService,
  IberdrolaContractStatus,
} from '../../../core/services/iberdrola-contract';
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

interface AuthenticatedUserLike {
  id?: string;
  _id?: string;
}

@Component({
  selector: 'app-iberdrola-contracts',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './iberdrola-contracts.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './iberdrola-contracts.scss',
})
export class IberdrolaContracts implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  private readonly auth = inject(Auth);

  private readonly preferencesService = inject(PreferencesService);

  private readonly socketService = inject(SocketService);

  private readonly iberdrolaContractService = inject(IberdrolaContractService);

  contracts: IberdrolaContract[] = [];

  filteredContracts: IberdrolaContract[] = [];

  filters: BaseContractFilters & { idVenda: string } = {
    ...createBaseContractFilters(),
      idVenda: '',
  };

  availableSegments: string[] = [];
  availableProducts: string[] = [];
  availableUsers: ContractFilterUserOption[] = [];

  showFilters = false;

  isLoading = false;
  errorMessage = '';

  viewMode: 'table' | 'kanban' = this.preferencesService.getContractsDefaultView();

  readonly statuses: IberdrolaContractStatus[] = [...IBERDROLA_CONTRACT_STATUSES];

  ngOnInit(): void {
    this.loadContracts();

    this.socketService
      .listenIberdrolaContractCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadContracts(false);
      });

    this.socketService
      .listenIberdrolaContractUpdated()
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

    this.iberdrolaContractService
      .getIberdrolaContracts(userId)
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
            error?.error?.message || 'Não foi possível carregar os contratos Iberdrola.';
        },
      });
  }

  setViewMode(mode: 'table' | 'kanban'): void {
    this.viewMode = mode;
  }

  applyFilters(): void {
    this.filteredContracts = this.contracts.filter((contract) =>
      matchesBaseContractFilters(contract, this.filters) &&
        matchesContractFilterValue(contract.idVenda, this.filters.idVenda),
    );
  }

  clearFilters(): void {
    this.filters = {
      ...createBaseContractFilters(),
      idVenda: '',
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

  get visibleStatuses(): readonly IberdrolaContractStatus[] {
    return getVisibleContractStatuses(this.statuses, this.filters.status);
  }

  getContractsByStatus(status: IberdrolaContractStatus): IberdrolaContract[] {
    return this.filteredContracts.filter((contract) => contract.estado === status);
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
      Cancelada: 'status-cancelled',
      Baixa: 'status-low',
    };

    return classes[status];
  }

  getContractUserName(contract: IberdrolaContract): string {
    return contract.user?.name?.trim() || '—';
  }

  getValue(value: string | number | null | undefined): string | number {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return value;
  }
}
