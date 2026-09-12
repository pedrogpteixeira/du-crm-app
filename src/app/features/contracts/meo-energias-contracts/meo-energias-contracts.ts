import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Auth } from '../../../core/services/auth';
import { PreferencesService } from '../../../core/services/preferences';
import { SocketService } from '../../../core/services/socket';
import {
  MEO_ENERGIAS_CONTRACT_STATUSES,
  MeoEnergiasContract,
  MeoEnergiasContractService,
  MeoEnergiasContractStatus,
} from '../../../core/services/meo-energias-contract';
import { sortContractsByUpdatedAtDesc } from '../../../core/utils/contract-sorting';

interface AuthenticatedUserLike {
  id?: string;
  _id?: string;
}

@Component({
  selector: 'app-meo-energias-contracts',
  imports: [
    CommonModule,
    RouterLink,
  ],
  templateUrl: './meo-energias-contracts.html',
  changeDetection:
    ChangeDetectionStrategy.Eager,
  styleUrl: './meo-energias-contracts.scss',
})
export class MeoEnergiasContracts implements OnInit {
  private readonly destroyRef =
    inject(DestroyRef);

  private readonly auth =
    inject(Auth);

  private readonly preferencesService =
    inject(PreferencesService);

  private readonly socketService =
    inject(SocketService);

  private readonly meoEnergiasContractService =
    inject(MeoEnergiasContractService);

  contracts: MeoEnergiasContract[] = [];

  isLoading = false;
  errorMessage = '';

  viewMode: 'table' | 'kanban' =
    this.preferencesService
      .getContractsDefaultView();

  readonly statuses:
    MeoEnergiasContractStatus[] = [
      ...MEO_ENERGIAS_CONTRACT_STATUSES,
    ];

  ngOnInit(): void {
    this.loadContracts();

    this.socketService
      .listenMeoEnergiasContractCreated()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(() => {
        this.loadContracts(false);
      });

    this.socketService
      .listenMeoEnergiasContractUpdated()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(() => {
        this.loadContracts(false);
      });
  }

  loadContracts(
    showLoading = true,
  ): void {
    const currentUser =
      this.auth
        .getCurrentUser() as
        | AuthenticatedUserLike
        | null;

    const userId =
      currentUser?.id ??
      currentUser?._id ??
      '';

    if (!userId) {
      this.contracts = [];
      this.errorMessage =
        'Não foi possível identificar o utilizador atual.';
      return;
    }

    if (showLoading) {
      this.isLoading = true;
    }

    this.errorMessage = '';

    this.meoEnergiasContractService
      .getMeoEnergiasContracts(userId)
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
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.message ||
            'Não foi possível carregar os contratos Meo Energias.';
        },
      });
  }

  setViewMode(
    mode: 'table' | 'kanban',
  ): void {
    this.viewMode = mode;
  }

  getContractsByStatus(
    status: MeoEnergiasContractStatus,
  ): MeoEnergiasContract[] {
    return this.contracts.filter(
      (contract) =>
        contract.estado === status,
    );
  }

  getStatusClass(
    status: MeoEnergiasContractStatus,
  ): string {
    const classes:
      Record<
        MeoEnergiasContractStatus,
        string
      > = {
        'Pedido de Chamada':
          'status-call-request',
        'Em validação':
          'status-validation',
        'Não Conformidade':
          'status-non-compliance',
        'Pendente Docs':
          'status-docs',
        'Documentos Enviados':
          'status-docs-sent',
        'Registo MEO':
          'status-meo-registration',
        Anulado:
          'status-cancelled',
        Ativo:
          'status-active',
        Baixa:
          'status-low',
      };

    return classes[status];
  }

  getContractUserName(
    contract: MeoEnergiasContract,
  ): string {
    return (
      contract.user?.name?.trim() ||
      '—'
    );
  }

  getValue(
    value:
      | string
      | number
      | null
      | undefined,
  ): string | number {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return '—';
    }

    return value;
  }
}
