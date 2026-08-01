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
  RepsolContract,
  RepsolContractService,
  RepsolContractStatus,
} from '../../../core/services/repsol-contract';

import { SocketService } from '../../../core/services/socket';
import { PreferencesService } from '../../../core/services/preferences';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-repsol-contracts',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
  ],
  templateUrl: './repsol-contracts.html',
  changeDetection:
    ChangeDetectionStrategy.Eager,
  styleUrl: './repsol-contracts.scss',
})
export class RepsolContracts
  implements OnInit {
  private readonly repsolContractService =
    inject(RepsolContractService);

  private readonly socketService =
    inject(SocketService);

  private readonly preferencesService =
    inject(PreferencesService);

  private readonly auth =
    inject(Auth);

  private readonly destroyRef =
    inject(DestroyRef);

  contracts: RepsolContract[] = [];

  isLoading = false;
  errorMessage = '';

  viewMode: 'table' | 'kanban' =
    this.preferencesService
      .getContractsDefaultView();

  statuses: RepsolContractStatus[] = [
    'Pedido de Chamada',
    'Em validação',
    'Chamada Efetuada',
    'Pendente Assinatura Digital',
    'Não Conformidade',
    'Pendente Docs',
    'Documentos Enviados',
    'Atribuído',
  ];

  ngOnInit(): void {
    this.loadContracts();

    this.socketService
      .listenRepsolContractCreated()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(() => {
        this.loadContracts();
      });

    this.socketService
      .listenRepsolContractUpdated()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(() => {
        this.loadContracts();
      });
  }

  loadContracts(): void {
    const currentUserId =
      this.auth.getCurrentUser()?.id;

    if (!currentUserId) {
      this.contracts = [];
      this.errorMessage =
        'Não foi possível identificar o utilizador autenticado.';

      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.repsolContractService
      .getRepsolContracts(
        currentUserId,
      )
      .pipe(
        finalize(() => {
          this.isLoading = false;
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
            'Não foi possível carregar os contratos Repsol.';
        },
      });
  }

  getStatusClass(
    status: RepsolContractStatus,
  ): string {
    return {
      'Pedido de Chamada':
        'status-call-request',

      'Em validação':
        'status-validation',

      'Chamada Efetuada':
        'status-call-done',

      'Pendente Assinatura Digital':
        'status-signature',

      'Não Conformidade':
        'status-non-compliance',

      'Pendente Docs':
        'status-docs',

      'Documentos Enviados':
        'status-docs-sent',

      Atribuído:
        'status-assigned',
    }[status];
  }

  setViewMode(
    mode: 'table' | 'kanban',
  ): void {
    this.viewMode = mode;
  }

  getContractsByStatus(
    status: RepsolContractStatus,
  ): RepsolContract[] {
    return this.contracts.filter(
      (contract) =>
        contract.estado === status,
    );
  }

  getContractUserName(
    contract: RepsolContract,
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