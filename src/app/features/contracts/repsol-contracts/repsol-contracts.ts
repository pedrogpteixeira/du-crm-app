import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, 
  //DestroyRef 
} from '@angular/core';
import { RouterLink } from '@angular/router';
//import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Client, ClientService } from '../../../core/services/client';

import {
  RepsolContract,
  RepsolContractService,
  RepsolContractStatus,
} from '../../../core/services/repsol-contract';
import { SocketService } from '../../../core/services/socket';
import { PreferencesService } from '../../../core/services/preferences';
import { environment } from '../../../../environments/environment.development';



@Component({
  selector: 'app-repsol-contracts',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './repsol-contracts.html',
  styleUrl: './repsol-contracts.scss',
})
export class RepsolContracts implements OnInit {
  private readonly repsolContractService = inject(RepsolContractService);
  private readonly socketService = inject(SocketService);
  //private readonly destroyRef = inject(DestroyRef);
  private readonly preferencesService = inject(PreferencesService);
  private readonly clientService = inject(ClientService);
  
  contracts: RepsolContract[] = [];

  isLoading = false;
  errorMessage = '';

  showCreateModal = false;
  isCheckingClient = false;
  isCreatingContract = false;
  clientWasFound = false;

  viewMode: 'table' | 'kanban' = this.preferencesService.getContractsDefaultView();

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

  newContract = {
    clientId: '',
    companyId: environment.repsolId,
    estado: 'Pedido de Chamada' as RepsolContractStatus,
    nomeClienteEmpresa: '',
    nif: null as number | null,
    email: '',
    telefone: null as number | null,
    tipoSegmento: 'Empresarial',
    tipoProduto: 'Luz + Gás',
    contratacao: 'Contratação Digital',
    teams: [] as string[],
    followers: [] as string[],
  };

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

  openCreateContractModal(): void {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    this.newContract.teams = currentUser.teams?.map((team: any) => team.id) || [];

    if (currentUser.defaultTeam?.id && !this.newContract.teams.includes(currentUser.defaultTeam.id)) {
      this.newContract.teams.push(currentUser.defaultTeam.id);
    }

    this.showCreateModal = true;
  }

  closeCreateContractModal(): void {
    this.showCreateModal = false;
    this.clientWasFound = false;
    this.errorMessage = '';

    this.newContract = {
      clientId: '',
      companyId: 'cmp_njRqliQBpR',
      estado: 'Pedido de Chamada',
      nomeClienteEmpresa: '',
      nif: null,
      email: '',
      telefone: null,
      tipoSegmento: 'Empresarial',
      tipoProduto: 'Luz + Gás',
      contratacao: 'Contratação Digital',
      teams: [],
      followers: [],
    };
  }

  checkClientByNif(): void {
    if (!this.newContract.nif) {
      this.errorMessage = 'O NIF é obrigatório.';
      return;
    }

    this.isCheckingClient = true;
    this.errorMessage = '';
    this.clientWasFound = false;

    this.clientService.getClientByNif(this.newContract.nif).subscribe({
      next: (client: Client) => {
        this.newContract.clientId = client.id;
        this.newContract.nomeClienteEmpresa = client.name;
        this.newContract.nif = client.nif;
        this.clientWasFound = true;
      },
      error: (error) => {
        if (error?.status === 404) {
          this.newContract.clientId = '';
          this.clientWasFound = false;
          return;
        }

        this.errorMessage = 'Não foi possível verificar o cliente.';
      },
      complete: () => {
        this.isCheckingClient = false;
      },
    });
  }
}