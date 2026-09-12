import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';



import {
  GALP_POWER_GAS_STATUSES,
  GalpPowerGasContract,
  GalpPowerGasContractService,
  GalpPowerGasContractStatus,
} from '../../../core/services/galp-power-gas-contract';

import {
  SocketService,
} from '../../../core/services/socket';

import {
  PreferencesService,
} from '../../../core/services/preferences';

import {
  Auth,
} from '../../../core/services/auth';
import { sortContractsByUpdatedAtDesc } from '../../../core/utils/contract-sorting';

@Component({
  selector:
    'app-galp-power-gas-contracts',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
  ],
  templateUrl:
    './galp-power-gas-contracts.html',
  changeDetection:
    ChangeDetectionStrategy.Eager,
  styleUrl:
    './galp-power-gas-contracts.scss',
})
export class GalpPowerGasContracts
  implements OnInit {

    galpPowerGasContractService =
      inject(
        GalpPowerGasContractService,
      );

  private readonly socketService =
    inject(SocketService);

  private readonly preferencesService =
    inject(PreferencesService);

  private readonly auth =
    inject(Auth);

  private readonly destroyRef =
    inject(DestroyRef);

  contracts:
    GalpPowerGasContract[] = [];

  isLoading = false;
  errorMessage = '';

  viewMode: 'table' | 'kanban' =
    this.preferencesService
      .getContractsDefaultView();

  statuses:
    GalpPowerGasContractStatus[] =
      [...GALP_POWER_GAS_STATUSES];

  ngOnInit(): void {
    this.loadContracts();

    this.socketService
      .listenGalpPowerGasContractCreated()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(() => {
        this.loadContracts(false);
      });

    this.socketService
      .listenGalpPowerGasContractUpdated()
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
    const currentUserId =
      this.auth.getCurrentUser()?.id;

    if (!currentUserId) {
      this.contracts = [];

      this.errorMessage =
        'Não foi possível identificar o utilizador autenticado.';

      return;
    }

    if (showLoading) {
      this.isLoading = true;
    }

    this.errorMessage = '';

    this.galpPowerGasContractService
      .getByFollowerId(
        currentUserId,
      )
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
          this.contracts = [];

          this.errorMessage =
            error?.error?.message ||
            'Não foi possível carregar os contratos Galp Power & Gás.';
        },
      });
  }

  getStatusClass(
    status:
      GalpPowerGasContractStatus,
  ): string {
    return {
      'Pedido de chamada':
        'status-call-request',

      'Em validação':
        'status-validation',

      'Não Conformidade':
        'status-non-compliance',

      'Documentos Enviados':
        'status-docs-sent',

      'Sem Registo':
        'status-no-registration',

      'Registo Plataforma Galp':
        'status-platform-registration',

      'Pendente Docs':
        'status-docs',

      'Em ativação':
        'status-activation',

      Ativo:
        'status-active',

      'Parcialmente Baixa':
        'status-partially-terminated',

      Cancelado:
        'status-cancelled',

      Baixa:
        'status-terminated',
    }[status];
  }

  setViewMode(
    mode: 'table' | 'kanban',
  ): void {
    this.viewMode = mode;
  }

  getContractsByStatus(
    status:
      GalpPowerGasContractStatus,
  ): GalpPowerGasContract[] {
    return this.contracts.filter(
      (contract) =>
        contract.estado === status,
    );
  }

  getContractUserName(
    contract:
      GalpPowerGasContract,
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