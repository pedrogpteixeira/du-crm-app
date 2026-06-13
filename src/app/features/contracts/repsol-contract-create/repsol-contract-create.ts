import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  Client,
  ClientService,
} from '../../../core/services/client';

import {
  Campaign,
  CampaignService,
} from '../../../core/services/campaign';

import {
  RepsolContractService,
  RepsolContractStatus,
} from '../../../core/services/repsol-contract';
import { environment } from '../../../../environments/environment.development';

type TipoSegmento = 'Residencial' | 'Empresarial' | 'Condomínios';
type TipoProduto = 'Luz' | 'Luz + Gás' | 'Gás';
type Contratacao = 'Contratação Papel' | 'Contratação Digital';
type TipoContratacao =
  | 'Mudança de Comercializadora'
  | 'Mudança de Comercializadora & AT'
  | 'Entrada Direta';

@Component({
  selector: 'app-repsol-contract-create',
  imports: [CommonModule, FormsModule],
  templateUrl: './repsol-contract-create.html',
  styleUrl: './repsol-contract-create.scss',
})
export class RepsolContractCreate implements OnInit{
  private readonly clientService = inject(ClientService);
  private readonly repsolContractService = inject(RepsolContractService);
  private readonly campaignService = inject(CampaignService);
  private readonly router = inject(Router);

  nif: number | null = null;
  clientName = '';
  client: Client | null = null;

  campaigns: Campaign[] = [];

  isCheckingClient = false;
  isCreatingClient = false;
  isCreatingContract = false;

  clientChecked = false;
  clientNotFound = false;

  errorMessage = '';
  successMessage = '';

  tipoSegmentoOptions: TipoSegmento[] = [
    'Residencial',
    'Empresarial',
    'Condomínios',
  ];

  tipoProdutoOptions: TipoProduto[] = [
    'Luz',
    'Luz + Gás',
    'Gás',
  ];

  contratacaoOptions: Contratacao[] = [
    'Contratação Papel',
    'Contratação Digital',
  ];

  tipoContratacaoOptions: TipoContratacao[] = [
    'Mudança de Comercializadora',
    'Mudança de Comercializadora & AT',
    'Entrada Direta',
  ];

  estadoOptions: RepsolContractStatus[] = [
    'Pedido de Chamada',
    'Em validação',
    'Chamada Efetuada',
    'Pendente Assinatura Digital',
    'Não Conformidade',
    'Pendente Docs',
    'Documentos Enviados',
    'Atribuído',
  ];

  cicloHorarioOptions = [
    'Simples',
    'Bi-Horário Diário',
    'Bi-Horário Semanal',
    'Tri-Horário Diário',
    'Tri-Horário Semanal',
    'Tetra-Horário',
  ];

  nivelTensaoOptions = [
    'Monofásico',
    'Trifásico',
  ];

  escalaoOptions = [1, 2, 3, 4];

  contractForm = {
    companyId: environment.repsolId,

    tipoSegmento: '' as TipoSegmento | '',
    tipoProduto: '' as TipoProduto | '',
    contratacao: '' as Contratacao | '',

    tipoContratacaoLuz: '' as TipoContratacao | '',
    tipoContratacaoGas: '' as TipoContratacao | '',

    controleQualidade: '',
    codigoRegistoCE: '',
    nomeRegistoCE: '',

    estado: 'Pedido de Chamada' as RepsolContractStatus,

    agendamento: '',
    dataAssinatura: '',
    dataContrato: '',
    dataRegisto: '',
    dataAtivacaoCPE: '',
    dataBaixaCPE: '',
    dataAtivacaoCUI: '',
    dataBaixaCUI: '',

    telefone: null as number | null,
    email: '',
    cae: '',
    crc: '',

    moradaFaturacaoSelecao: 'Igual à de Instalação',

    moradaInstalacaoRua: '',
    moradaInstalacaoCidade: '',
    moradaInstalacaoDistrito: '',
    moradaInstalacaoCodigoPostal: '',
    moradaInstalacaoPais: '',

    moradaFaturacaoRua: '',
    moradaFaturacaoCidade: '',
    moradaFaturacaoDistrito: '',
    moradaFaturacaoCodigoPostal: '',
    moradaFaturacaoPais: '',

    faturaEletronica: false,
    sva: false,
    debitoDireto: false,
    iban: '',

    campanha: '',
    antigaComercializadora: '',
    cpe: '',
    cui: '',
    potencia: '',
    escalao: null as number | null,
    cicloHorario: '',
    nivelTensao: '',

    observacoes: '',

    teams: [] as string[],
  };

  moradaFaturacaoOptions = [
    'Igual à de Instalação',
    'Outra',
  ];

  ngOnInit(): void {
    this.loadCampaigns();
  }

  private loadCampaigns(): void {
    this.campaignService
      .getCampaignsByCompanyId(environment.repsolId)
      .subscribe({
        next: (campaigns) => {
          this.campaigns = campaigns;

          if (
            !this.contractForm.campanha &&
            campaigns.length
          ) {
            this.contractForm.campanha = campaigns[0].id;
          }
        },
        error: () => {
          this.errorMessage =
            'Não foi possível carregar as campanhas.';
        },
      });
  }

  checkClientByNif(): void {
    if (!this.nif) {
      this.errorMessage = 'O NIF é obrigatório.';
      return;
    }

    this.isCheckingClient = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.client = null;
    this.clientChecked = false;
    this.clientNotFound = false;

    this.clientService.getClientByNif(this.nif).subscribe({
      next: (client) => {
        this.client = client;
        this.clientName = client.name;
        this.clientChecked = true;
        this.clientNotFound = false;
        this.successMessage = 'Cliente encontrado.';
      },
      error: (error) => {
        this.clientChecked = true;

        if (error?.status === 404) {
          this.clientNotFound = true;
          this.client = null;
          this.clientName = '';
          return;
        }

        this.errorMessage = 'Não foi possível verificar o cliente.';
      },
      complete: () => {
        this.isCheckingClient = false;
      },
    });
  }

  createClient(): void {
    if (!this.nif || !this.clientName.trim()) {
      this.errorMessage = 'O NIF e o nome do cliente são obrigatórios.';
      return;
    }

    this.isCreatingClient = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.clientService
      .createClient({
        name: this.clientName.trim(),
        nif: this.nif,
      })
      .subscribe({
        next: (client) => {
          this.client = client;
          this.clientName = client.name;
          this.clientNotFound = false;
          this.clientChecked = true;
          this.successMessage = 'Cliente criado com sucesso.';
        },
        error: () => {
          this.errorMessage = 'Não foi possível criar o cliente.';
        },
        complete: () => {
          this.isCreatingClient = false;
        },
      });
  }

  createContract(): void {
    if (!this.client) {
      this.errorMessage = 'É necessário identificar ou criar o cliente.';
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    if (!currentUser.id) {
      this.errorMessage = 'Não foi possível identificar o utilizador autenticado.';
      return;
    }

    if (
      !this.contractForm.tipoSegmento ||
      !this.contractForm.tipoProduto ||
      !this.contractForm.contratacao
    ) {
      this.errorMessage =
        'Tipo de segmento, tipo de produto e contratação são obrigatórios.';
      return;
    }

    const teams =
      currentUser.teams?.map((team: { id: string }) => team.id) || [];

    this.isCreatingContract = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload: any = {
      clientId: this.client.id,
      companyId: this.contractForm.companyId,
      nomeClienteEmpresa: this.client.name,
      nif: this.client.nif,
      userId: currentUser.id,
      teams,
      estado: this.contractForm.estado,
    };

    this.addIfFilled(payload, 'tipoSegmento', this.contractForm.tipoSegmento);
    this.addIfFilled(payload, 'tipoProduto', this.contractForm.tipoProduto);
    this.addIfFilled(payload, 'contratacao', this.contractForm.contratacao);

    if (this.shouldShowLuzFields()) {
      this.addIfFilled(
        payload,
        'tipoContratacaoLuz',
        this.contractForm.tipoContratacaoLuz,
      );
    }

    if (this.shouldShowGasFields()) {
      this.addIfFilled(
        payload,
        'tipoContratacaoGas',
        this.contractForm.tipoContratacaoGas,
      );
    }

    this.addIfFilled(payload, 'controleQualidade', this.contractForm.controleQualidade);
    this.addIfFilled(payload, 'codigoRegistoCE', this.contractForm.codigoRegistoCE);
    this.addIfFilled(payload, 'nomeRegistoCE', this.contractForm.nomeRegistoCE);

    this.addIfFilled(payload, 'agendamento', this.contractForm.agendamento);
    this.addIfFilled(payload, 'dataAssinatura', this.contractForm.dataAssinatura);
    this.addIfFilled(payload, 'dataContrato', this.contractForm.dataContrato);
    this.addIfFilled(payload, 'dataRegisto', this.contractForm.dataRegisto);
    this.addIfFilled(payload, 'dataAtivacaoCPE', this.contractForm.dataAtivacaoCPE);
    this.addIfFilled(payload, 'dataBaixaCPE', this.contractForm.dataBaixaCPE);
    this.addIfFilled(payload, 'dataAtivacaoCUI', this.contractForm.dataAtivacaoCUI);
    this.addIfFilled(payload, 'dataBaixaCUI', this.contractForm.dataBaixaCUI);

    this.addIfFilled(payload, 'telefone', this.contractForm.telefone);
    this.addIfFilled(payload, 'email', this.contractForm.email);
    this.addIfFilled(payload, 'cae', this.contractForm.cae);
    this.addIfFilled(payload, 'crc', this.contractForm.crc);

    this.addIfFilled(payload, 'moradaInstalacao', this.getMoradaInstalacao());
    this.addIfFilled(payload, 'moradaFaturacao', this.getMoradaFaturacao());

    payload.faturaEletronica = this.contractForm.faturaEletronica;
    payload.sva = this.contractForm.sva;
    payload.debitoDireto = this.contractForm.debitoDireto;

    this.addIfFilled(payload, 'iban', this.contractForm.iban);
    this.addIfFilled(payload, 'campanha', this.contractForm.campanha);
    this.addIfFilled(payload, 'antigaComercializadora', this.contractForm.antigaComercializadora);
    this.addIfFilled(payload, 'cpe', this.contractForm.cpe);
    this.addIfFilled(payload, 'cui', this.contractForm.cui);
    this.addIfFilled(payload, 'potencia', this.contractForm.potencia);
    this.addIfFilled(payload, 'escalao', this.contractForm.escalao);
    this.addIfFilled(payload, 'cicloHorario', this.contractForm.cicloHorario);
    this.addIfFilled(payload, 'nivelTensao', this.contractForm.nivelTensao);
    this.addIfFilled(payload, 'observacoes', this.contractForm.observacoes);

    this.repsolContractService
    .createRepsolContract(payload)
    .subscribe({
      next: (contract) => {
        this.router.navigate(['/home/contracts/repsol', contract.id]);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.details?.join(' ') ||
          error?.error?.message ||
          'Não foi possível criar o contrato Repsol.';
      },
      complete: () => {
        this.isCreatingContract = false;
      },
    });
  }

  shouldShowLuzFields(): boolean {
    return (
      this.contractForm.tipoProduto === 'Luz' ||
      this.contractForm.tipoProduto === 'Luz + Gás'
    );
  }

  shouldShowGasFields(): boolean {
    return (
      this.contractForm.tipoProduto === 'Gás' ||
      this.contractForm.tipoProduto === 'Luz + Gás'
    );
  }

  shouldShowBillingAddress(): boolean {
    return this.contractForm.moradaFaturacaoSelecao === 'Outra';
  }

  private buildAddress(
    rua: string,
    cidade: string,
    distrito: string,
    codigoPostal: string,
    pais: string,
  ): string {
    return [
      rua,
      cidade,
      distrito,
      codigoPostal,
      pais,
    ]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(', ');
  }

  private getMoradaInstalacao(): string {
    return this.buildAddress(
      this.contractForm.moradaInstalacaoRua,
      this.contractForm.moradaInstalacaoCidade,
      this.contractForm.moradaInstalacaoDistrito,
      this.contractForm.moradaInstalacaoCodigoPostal,
      this.contractForm.moradaInstalacaoPais,
    );
  }

  private getMoradaFaturacao(): string {
    if (this.contractForm.moradaFaturacaoSelecao === 'Igual à de Instalação') {
      return this.getMoradaInstalacao();
    }

    return this.buildAddress(
      this.contractForm.moradaFaturacaoRua,
      this.contractForm.moradaFaturacaoCidade,
      this.contractForm.moradaFaturacaoDistrito,
      this.contractForm.moradaFaturacaoCodigoPostal,
      this.contractForm.moradaFaturacaoPais,
    );
  }

  private addIfFilled(
    payload: Record<string, unknown>,
    key: string,
    value: unknown,
  ): void {
    if (value === null || value === undefined || value === '') {
      return;
    }

    payload[key] = value;
  }
}