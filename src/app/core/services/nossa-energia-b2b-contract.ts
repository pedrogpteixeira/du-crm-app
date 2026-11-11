import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { Campaign } from './campaign';
import { ContractCreationResponse } from './contract-preflight';
import type { ContractFlowEntry, ContractTicketSummary } from '../models/contract-activity';
import {
  ContractKanbanQuery,
  ContractListItemBase,
  ContractKanbanResponse,
  buildContractFiltersParams,
} from '../utils/contract-kanban';
import {
  ContractTableQuery,
  ContractTableResponse,
  buildContractTableParams,
} from '../utils/contract-table';
import { NOSSA_ENERGIA_B2B_COMPANY_ID } from '../config/nossa-energia-b2b-access';

export type NossaEnergiaB2BContractStatus =
  | 'Pedido de Contratação'
  | 'Pedido de Proposta'
  | 'Pendente Docs'
  | 'Documentos Enviados'
  | 'Não Conformidade'
  | 'Pendente Assinatura'
  | 'Registo Plataforma Nossa Energia'
  | 'Cancelado'
  | 'Ativo'
  | 'Parcialmente Baixa'
  | 'Baixa';

export const NOSSA_ENERGIA_B2B_CONTRACT_STATUSES: readonly NossaEnergiaB2BContractStatus[] = [
  'Pedido de Contratação',
  'Pedido de Proposta',
  'Pendente Docs',
  'Documentos Enviados',
  'Não Conformidade',
  'Pendente Assinatura',
  'Registo Plataforma Nossa Energia',
  'Cancelado',
  'Ativo',
  'Parcialmente Baixa',
  'Baixa',
];

export const NOSSA_ENERGIA_B2B_SEGMENT_OPTIONS = ['Empresarial', 'Condomínios'] as const;
export const NOSSA_ENERGIA_B2B_TARIFF_TYPE_OPTIONS = ['MT', 'BTE', 'BTN'] as const;
export const NOSSA_ENERGIA_B2B_LOYALTY_OPTIONS = ['12 meses', '24 meses'] as const;

export interface NossaEnergiaB2BContractListUser {
  id: string;
  name: string;
}

export interface NossaEnergiaB2BContract {
  id: string;
  nomeClienteEmpresa: string;
  nif: number;
  estado: NossaEnergiaB2BContractStatus;
  tipoSegmento?: string;
  tipoProduto?: string;
  tipoTarifa?: string;
  user: NossaEnergiaB2BContractListUser | null;
  nomeRegistoCE?: string;
  observacoes?: string;
  observacoesInternas?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NossaEnergiaB2BContractUser {
  id: string;
  name: string;
}

export interface NossaEnergiaB2BContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface NossaEnergiaB2BContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface NossaEnergiaB2BContractTeam {
  id: string;
  name: string;
  registrationNumber: number;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface NossaEnergiaB2BContractFollower {
  id: string;
  name: string;
}

export interface NossaEnergiaB2BContractCampaign {
  id: string | null;
  name: string;
}

export interface NossaEnergiaB2BContractDetail {
  id: string;
  companyId: string;
  clientId: string;

  tipoSegmento: string;
  tipoProduto: string;
  tipoTarifa?: string;
  contratacao: string;
  tipoContratacaoLuz: string;
  tipoContratacaoGas: string;

  controleQualidade: string;
  codigoRegistoCE: string;
  nomeRegistoCE: string;

  estado: NossaEnergiaB2BContractStatus;

  motivoAnulacao?: string | null;
  motivoAnulacaoOutras?: string | null;

  agendamento?: string;
  dataAssinatura?: string;
  dataContrato?: string;
  dataRegisto?: string;
  dataAtivacaoCPE?: string;
  dataBaixaCPE?: string;
  dataAtivacaoCUI?: string;
  dataBaixaCUI?: string;

  nomeClienteEmpresa: string;
  nomeGerente?: string;
  nomeResponsavel?: string;
  contactoResponsavel?: number | null;
  nif: number;
  telefone: number;
  email: string;
  cae: string;
  crc: string;

  moradaInstalacao: string;
  moradaFaturacao: string;

  faturaEletronica: boolean;
  debitoDireto: boolean;
  iban: string;

  campaign: NossaEnergiaB2BContractCampaign | null;
  campaigns?: Campaign[];
  fidelizacao?: string | null;
  antigaComercializadora: string;

  cpe: string;
  cui: string;
  potencia: string | number;
  escalao?: number;
  cicloHorario: string;
  nivelTensao: string;

  documentos: NossaEnergiaB2BContractDocument[];

  observacoes: string;
  observacoesInternas?: string;

  user: NossaEnergiaB2BContractUser | null;
  teams: NossaEnergiaB2BContractTeam[];
  followers: NossaEnergiaB2BContractFollower[];

  createdAt: string;
  updatedAt: string;

  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
}

export interface CreateNossaEnergiaB2BContractRequest {
  clientId: string;
  companyId: string;

  tipoSegmento?: string;
  tipoProduto?: string;
  tipoTarifa?: string;
  contratacao?: string;
  tipoContratacaoLuz?: string;
  tipoContratacaoGas?: string;

  controleQualidade?: string;
  codigoRegistoCE?: string;
  nomeRegistoCE?: string;

  estado?: NossaEnergiaB2BContractStatus;

  motivoAnulacao?: string | null;
  motivoAnulacaoOutras?: string | null;

  agendamento?: string;
  dataAssinatura?: string;
  dataContrato?: string;
  dataRegisto?: string;
  dataAtivacaoCPE?: string;
  dataBaixaCPE?: string;
  dataAtivacaoCUI?: string;
  dataBaixaCUI?: string;

  nomeClienteEmpresa: string;
  nomeGerente?: string;
  nomeResponsavel?: string;
  contactoResponsavel?: number;
  nif: number;
  telefone?: number;
  email?: string;
  cae?: string;
  crc?: string;

  moradaInstalacao?: string;
  moradaFaturacao?: string;

  faturaEletronica?: boolean;
  debitoDireto?: boolean;
  iban?: string;

  campanha?: string;
  fidelizacao?: string;
  antigaComercializadora?: string;

  cpe?: string;
  cui?: string;
  potencia?: string | number;
  escalao?: number;
  cicloHorario?: string;
  nivelTensao?: string;

  observacoes?: string;
  observacoesInternas?: string;

  userId: string;
  teams?: NossaEnergiaB2BContractTeamVisibility[];
}

export type UpdateNossaEnergiaB2BContractRequest = Partial<
  Omit<
    CreateNossaEnergiaB2BContractRequest,
    | 'clientId'
    | 'companyId'
    | 'userId'
    | 'teams'
    | 'nif'
    | 'telefone'
    | 'contactoResponsavel'
    | 'potencia'
    | 'escalao'
    | 'dataRegisto'
    | 'dataAtivacaoCPE'
    | 'dataBaixaCPE'
    | 'dataAtivacaoCUI'
    | 'dataBaixaCUI'
  >
> & {
  dataRegisto?: string | null;
  dataAtivacaoCPE?: string | null;
  dataBaixaCPE?: string | null;
  dataAtivacaoCUI?: string | null;
  dataBaixaCUI?: string | null;
  nif?: number | null;
  telefone?: number | null;
  contactoResponsavel?: number | null;
  potencia?: string | number | null;
  escalao?: number | null;
  observacoesInternas?: string;
};

export type NossaEnergiaB2BContractList = ContractListItemBase<NossaEnergiaB2BContractStatus>;

@Injectable({ providedIn: 'root' })
export class NossaEnergiaB2BContractService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/api/contracts/nossa-energia-b2b`;

  readonly companyId = NOSSA_ENERGIA_B2B_COMPANY_ID;

  getNossaEnergiaB2BContracts(
    userId: string,
    query: ContractKanbanQuery = {},
  ): Observable<ContractKanbanResponse<NossaEnergiaB2BContractList>> {
    const params = buildContractFiltersParams(query.filters, query.offset ?? 5, query.estado);

    return this.http.get<ContractKanbanResponse<NossaEnergiaB2BContractList>>(
      `${this.baseUrl}/followers/${encodeURIComponent(userId)}`,
      { params },
    );
  }

  getTableContracts(
    userId: string,
    query: ContractTableQuery = {},
  ): Observable<ContractTableResponse<NossaEnergiaB2BContractList>> {
    const params = buildContractTableParams(query);

    return this.http.get<ContractTableResponse<NossaEnergiaB2BContractList>>(
      `${this.baseUrl}/followers/${encodeURIComponent(userId)}/table`,
      { params },
    );
  }

  getNossaEnergiaB2BContractById(contractId: string): Observable<NossaEnergiaB2BContractDetail> {
    return this.http.get<NossaEnergiaB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}`,
    );
  }

  createNossaEnergiaB2BContract(
    payload: CreateNossaEnergiaB2BContractRequest,
  ): Observable<ContractCreationResponse<NossaEnergiaB2BContractDetail>> {
    return this.http.post<ContractCreationResponse<NossaEnergiaB2BContractDetail>>(this.baseUrl, {
      ...payload,
      companyId: NOSSA_ENERGIA_B2B_COMPANY_ID,
    });
  }

  updateNossaEnergiaB2BContract(
    contractId: string,
    payload: UpdateNossaEnergiaB2BContractRequest,
  ): Observable<NossaEnergiaB2BContractDetail> {
    return this.http.patch<NossaEnergiaB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}`,
      payload,
    );
  }

  uploadAttachments(contractId: string, files: File[]): Observable<NossaEnergiaB2BContractDetail> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));

    return this.http.post<NossaEnergiaB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments`,
      formData,
    );
  }

  deleteAttachment(contractId: string, fileName: string): Observable<NossaEnergiaB2BContractDetail> {
    return this.http.delete<NossaEnergiaB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments/${encodeURIComponent(fileName)}`,
    );
  }

  downloadDocument(contractId: string, document: NossaEnergiaB2BContractDocument): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments/${encodeURIComponent(document.fileName)}/download`,
      { responseType: 'blob' },
    );
  }
}
