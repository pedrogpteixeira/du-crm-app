import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  RepsolContract,
  RepsolContractService,
  RepsolContractStatus,
} from '../../../core/services/repsol-contract';

@Component({
  selector: 'app-repsol-contracts',
  imports: [CommonModule, RouterLink],
  templateUrl: './repsol-contracts.html',
  styleUrl: './repsol-contracts.scss',
})
export class RepsolContracts implements OnInit {
  private readonly repsolContractService = inject(RepsolContractService);

  contracts: RepsolContract[] = [];

  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadContracts();
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
}