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

@Component({
  selector: 'app-wallbox-contracts',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
  ],
  templateUrl: './wallbox-contracts.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './wallbox-contracts.scss',
})
export class WallboxContracts implements OnInit {
  private readonly wallboxContractService =
    inject(WallboxContractService);

  private readonly socketService =
    inject(SocketService);

  private readonly preferencesService =
    inject(PreferencesService);

  private readonly auth =
    inject(Auth);

  private readonly destroyRef =
    inject(DestroyRef);

  contracts: WallboxContract[] = [];

  isLoading = false;
  errorMessage = '';

  viewMode: 'table' | 'kanban' =
    this.preferencesService
      .getContractsDefaultView();

  readonly statuses: WallboxContractStatus[] = [
    ...WALLBOX_CONTRACT_STATUSES,
  ];

  ngOnInit(): void {
    this.loadContracts();

    this.socketService
      .listenWallboxContractCreated()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(() => {
        this.loadContracts(false);
      });

    this.socketService
      .listenWallboxContractUpdated()
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

    this.wallboxContractService
      .getWallboxContracts(
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
          this.contracts =
            contracts ?? [];
        },

        error: (error) => {
          this.contracts = [];

          this.errorMessage =
            error?.error?.message ||
            'Não foi possível carregar os contratos Wallbox.';
        },
      });
  }

  getStatusClass(
    status: WallboxContractStatus,
  ): string {
    const classes: Record<
      WallboxContractStatus,
      string
    > = {
      'Pedido de Chamada':
        'status-call-request',

      'Registo Plataforma Galp':
        'status-signature',

      'Não conformidade':
        'status-non-compliance',

      'Em Ativação':
        'status-assigned',

      'Ativo':
        'status-active',

      'Anulado':
        'status-cancelled',
    };

    return classes[status];
  }

  setViewMode(
    mode: 'table' | 'kanban',
  ): void {
    this.viewMode = mode;
  }

  getContractsByStatus(
    status: WallboxContractStatus,
  ): WallboxContract[] {
    return this.contracts.filter(
      (contract) =>
        contract.estado === status,
    );
  }

  getContractUserName(
    contract: WallboxContract,
  ): string {
    const contractWithUser =
      contract as WallboxContract & {
        user?: {
          name?: string;
        } | null;
      };

    return (
      contractWithUser.user?.name?.trim() ||
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