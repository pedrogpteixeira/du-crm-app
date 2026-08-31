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
  GALP_SOLAR_STATUSES,
  GalpSolarContract,
  GalpSolarContractService,
  GalpSolarContractStatus,
} from '../../../core/services/galp-solar-contract';

import { SocketService } from '../../../core/services/socket';
import { PreferencesService } from '../../../core/services/preferences';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-galp-solar-contracts',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
  ],
  templateUrl: './galp-solar-contracts.html',
  changeDetection:
    ChangeDetectionStrategy.Eager,
  styleUrl: './galp-solar-contracts.scss',
})
export class GalpSolarContracts
  implements OnInit {

  private readonly galpSolarContractService =
    inject(GalpSolarContractService);

  private readonly socketService =
    inject(SocketService);

  private readonly preferencesService =
    inject(PreferencesService);

  private readonly auth =
    inject(Auth);

  private readonly destroyRef =
    inject(DestroyRef);

  contracts: GalpSolarContract[] = [];

  isLoading = false;
  errorMessage = '';

  viewMode: 'table' | 'kanban' =
    this.preferencesService
      .getContractsDefaultView();

  statuses: GalpSolarContractStatus[] = [
    ...GALP_SOLAR_STATUSES,
  ];

  ngOnInit(): void {
    this.loadContracts();

    this.socketService
      .listenGalpSolarContractCreated()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(() => {
        this.loadContracts(false);
      });

    this.socketService
      .listenGalpSolarContractUpdated()
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

    this.galpSolarContractService
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
          this.contracts =
            contracts ?? [];
        },

        error: (error) => {
          this.contracts = [];

          this.errorMessage =
            error?.error?.message ||
            'Não foi possível carregar os contratos Galp Solar.';
        },
      });
  }

  getStatusClass(
    status: GalpSolarContractStatus,
  ): string {
    return {
      'Pedido de Proposta':
        'status-proposal-request',

      'Proposta enviada':
        'status-proposal-sent',

      'Envio Quality Check':
        'status-quality-check',

      'Pendente Docs':
        'status-docs',

      'Documentos enviados':
        'status-docs-sent',

      'Em instalação':
        'status-installation',

      Ativo:
        'status-active',

      Cancelado:
        'status-cancelled',
    }[status];
  }

  setViewMode(
    mode: 'table' | 'kanban',
  ): void {
    this.viewMode = mode;
  }

  getContractsByStatus(
    status: GalpSolarContractStatus,
  ): GalpSolarContract[] {
    return this.contracts.filter(
      (contract) =>
        contract.estado === status,
    );
  }

  getContractUserName(
    contract: GalpSolarContract,
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