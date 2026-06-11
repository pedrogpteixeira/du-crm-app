import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  RepsolContract,
  RepsolContractService,
  RepsolContractStatus,
} from '../../../core/services/repsol-contract';
import { SocketService } from '../../../core/services/socket';



@Component({
  selector: 'app-repsol-contracts',
  imports: [CommonModule, RouterLink],
  templateUrl: './repsol-contracts.html',
  styleUrl: './repsol-contracts.scss',
})
export class RepsolContracts implements OnInit {
  private readonly repsolContractService = inject(RepsolContractService);
  private readonly socketService = inject(SocketService);
  private readonly destroyRef = inject(DestroyRef);
  
  contracts: RepsolContract[] = [];

  isLoading = false;
  errorMessage = '';

  viewMode: 'table' | 'kanban' = 'table';

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
      .subscribe(() => {
        this.loadContracts();
      });

    this.socketService
      .listenRepsolContractUpdated()
      .subscribe(() => {
        this.loadContracts();
      });
  }

  loadContracts(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const teamId = currentUser.defaultTeam?.id || currentUser.defaultTeam || '';

    this.repsolContractService.getRepsolContracts().subscribe({
      next: (contracts) => {
        this.contracts = contracts;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar os contratos Repsol.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  getStatusClass(status: RepsolContractStatus): string {
    return {
      'Pedido de Chamada': 'status-call-request',
      'Em validação': 'status-validation',
      'Chamada Efetuada': 'status-call-done',
      'Pendente Assinatura Digital': 'status-signature',
      'Não Conformidade': 'status-non-compliance',
      'Pendente Docs': 'status-docs',
      'Documentos Enviados': 'status-docs-sent',
      Atribuído: 'status-assigned',
    }[status];
  }

  setViewMode(mode: 'table' | 'kanban'): void {
    this.viewMode = mode;
  }

  getContractsByStatus(status: RepsolContractStatus): RepsolContract[] {
    return this.contracts.filter((contract) => contract.estado === status);
  }
}