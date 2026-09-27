import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { Campaign } from './campaign';

import { ContractCreationResponse } from './contract-preflight';

import type { ContractFlowEntry, ContractTicketSummary } from '../models/contract-activity';

import { environment } from '../../../environments/environment';

import {
  ContractKanbanQuery,
  ContractKanbanResponse,
  buildContractFiltersParams,
} from '../utils/contract-kanban';
import {
  ContractTableQuery,
  ContractTableResponse,
  buildContractTableParams,
} from '../utils/contract-table';
export const VODAFONE_COMPANY_ID = 'cmp_UL2eeL1SvE' as const;

export type VodafoneTipoSegmento = 'Residencial' | 'Empresarial';

export type VodafoneTipoProduto = 'Luz' | 'Luz + Gás' | 'Gás';

export type VodafoneContratacao = 'Contratação Digital' | 'Contratação Papel';

export type VodafoneTipoContratacao =
  'Mudança de Comercializadora' | 'Mudança de Comercializadora & AT' | 'Entrada Direta';

export type VodafoneContractStatus =
  | 'Pedido de Chamada'
  | 'Em validação'
  | 'Não Conformidade'
  | 'Pendente Docs'
  | 'Documentos Enviados'
  | 'Registo VODAFONE'
  | 'Anulado'
  | 'Ativo'
  | 'Baixa';

export const VODAFONE_CONTRACT_STATUSES: readonly VodafoneContractStatus[] = [
  'Pedido de Chamada',
  'Em validação',
  'Não Conformidade',
  'Pendente Docs',
  'Documentos Enviados',
  'Registo VODAFONE',
  'Anulado',
  'Ativo',
  'Baixa',
];

export type VodafoneCicloHorario =
  | 'Simples'
  | 'Bi-Horário Diário'
  | 'Bi-Horário Semanal'
  | 'Tri-Horário Diário'
  | 'Tri-Horário Semanal'
  | 'Tetra-Horário';

export type VodafoneNivelTensao = 'Monofásico' | 'Trifásico';

export const VODAFONE_POWER_SUGGESTIONS = [
  '1.15',
  '2.30',
  '3.45',
  '4.60',
  '5.75',
  '6.90',
  '10.35',
  '13.80',
  '17.25',
  '20.70',
  '27.60',
  '34.50',
  '41.40',
] as const;

export const VODAFONE_GAS_LEVEL_SUGGESTIONS = ['1', '2', '3', '4'] as const;

export interface VodafoneContractListUser {
  id: string;
  name: string;
}

export interface VodafoneContract {
  id: string;
  nomeClienteEmpresa: string;
  nif: number;
  estado: VodafoneContractStatus;
  tipoSegmento?: VodafoneTipoSegmento;
  tipoProduto?: VodafoneTipoProduto;
  nomeRegistoCE?: string;
  user: VodafoneContractListUser | null;
  observacoes?: string;
  observacoesInternas?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface VodafoneContractUser {
  id: string;
  name: string;
}

export interface VodafoneContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface VodafoneContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface VodafoneContractTeam {
  id: string;
  name: string;
  registrationNumber: number | null;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface VodafoneContractFollower {
  id: string;
  name: string;
}

export interface VodafoneContractCampaign {
  id: string | null;
  name: string;
}

export interface VodafoneContractDetail {
  id: string;
  companyId: string;
  clientId: string;

  tipoSegmento: VodafoneTipoSegmento;
  tipoProduto: VodafoneTipoProduto;
  contratacao: VodafoneContratacao;
  tipoContratacaoLuz?: VodafoneTipoContratacao;
  tipoContratacaoGas?: VodafoneTipoContratacao;

  /*
   * Os módulos atuais de contratos de energia tratam controleQualidade como texto livre.
   * Mantemos string e não criamos enum artificial.
   */
  controleQualidade?: string;
  nomeRegistoCE?: string;
  codigoRegistoCE?: string;
  estado: VodafoneContractStatus;

  agendamento?: string;
  dataAssinatura?: string;
  dataContrato?: string;
  dataRegisto?: string;
  dataAtivacaoCPE?: string;
  dataBaixaCPE?: string;
  dataAtivacaoCUI?: string;
  dataBaixaCUI?: string;

  nomeClienteEmpresa: string;
  nif: number;
  telefone: number;
  email?: string;
  cae?: string;
  crc?: string;

  moradaInstalacao?: string;
  moradaFaturacao?: string;

  faturaEletronica: boolean;
  debitoDireto: boolean;
  tarifaSocial: boolean;
  iban?: string;

  campaign: VodafoneContractCampaign | null;
  campaigns?: Campaign[];
  antigaComercializadora?: string;
  cpe?: string;
  cui?: string;
  potencia?: string;
  escalao?: string;
  cicloHorario?: VodafoneCicloHorario;
  nivelTensao?: VodafoneNivelTensao;

  documentos: VodafoneContractDocument[];
  observacoes?: string;
  observacoesInternas?: string;

  user: VodafoneContractUser | null;
  teams: VodafoneContractTeam[];
  followers: VodafoneContractFollower[];
  createdAt: string;
  updatedAt: string;

  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
}

export interface CreateVodafoneContractRequest {
  companyId: typeof VODAFONE_COMPANY_ID;
  clientId: string;

  tipoSegmento: VodafoneTipoSegmento;
  tipoProduto: VodafoneTipoProduto;
  contratacao: VodafoneContratacao;
  tipoContratacaoLuz?: VodafoneTipoContratacao;
  tipoContratacaoGas?: VodafoneTipoContratacao;

  controleQualidade?: string;
  nomeRegistoCE?: string;
  codigoRegistoCE?: string;
  estado?: VodafoneContractStatus;

  agendamento?: string;
  dataAssinatura?: string;
  dataContrato?: string;
  dataRegisto?: string;
  dataAtivacaoCPE?: string;
  dataBaixaCPE?: string;
  dataAtivacaoCUI?: string;
  dataBaixaCUI?: string;

  nomeClienteEmpresa: string;
  nif: number;
  telefone: number;
  email?: string;
  cae?: string;
  crc?: string;

  moradaInstalacao?: string;
  moradaFaturacao?: string;

  faturaEletronica?: boolean;
  debitoDireto?: boolean;
  tarifaSocial?: boolean;
  iban?: string;

  campanha: string;
  antigaComercializadora?: string;
  cpe?: string;
  cui?: string;
  potencia?: string;
  escalao?: string;
  cicloHorario?: VodafoneCicloHorario;
  nivelTensao?: VodafoneNivelTensao;

  observacoes?: string;
  observacoesInternas?: string;
  userId: string;
  teams?: VodafoneContractTeamVisibility[];
}

export type UpdateVodafoneContractRequest = Partial<
  Omit<CreateVodafoneContractRequest, 'companyId' | 'clientId' | 'userId' | 'teams'>
> & {
  nif?: number | null;
  telefone?: number | null;
  observacoes?: string;
  observacoesInternas?: string;
};

export type VodafoneContractList = Omit<VodafoneContract, 'observacoes' | 'observacoesInternas'> & {
  userId?: string;
  campanha?: string;
} & Partial<
    Omit<
      VodafoneContractDetail,
      | keyof Omit<VodafoneContract, 'observacoes' | 'observacoesInternas'>
      | 'documentos'
      | 'observacoes'
      | 'observacoesInternas'
      | 'fluxo'
      | 'tickets'
      | 'moradaInstalacao'
      | 'moradaFaturacao'
      | 'followers'
    >
  >;

@Injectable({
  providedIn: 'root',
})
export class VodafoneContractService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getVodafoneContracts(
    userId: string,
    query: ContractKanbanQuery = {},
  ): Observable<ContractKanbanResponse<VodafoneContractList>> {
    const params = buildContractFiltersParams(query.filters, query.offset ?? 5, query.estado);

    return this.http.get<ContractKanbanResponse<VodafoneContractList>>(
      `${this.apiUrl}/api/contracts/vodafone/followers/${userId}`,
      { params },
    );
  }

  getTableContracts(
    userId: string,
    query: ContractTableQuery = {},
  ): Observable<ContractTableResponse<VodafoneContractList>> {
    const params = buildContractTableParams(query);

    return this.http.get<ContractTableResponse<VodafoneContractList>>(
      `${this.apiUrl}/api/contracts/vodafone/followers/${userId}/table`,
      { params },
    );
  }

  getVodafoneContractById(contractId: string): Observable<VodafoneContractDetail> {
    return this.http.get<VodafoneContractDetail>(
      `${this.apiUrl}/api/contracts/vodafone/${contractId}`,
    );
  }

  createVodafoneContract(
    payload: CreateVodafoneContractRequest,
  ): Observable<ContractCreationResponse<VodafoneContractDetail>> {
    return this.http.post<ContractCreationResponse<VodafoneContractDetail>>(`${this.apiUrl}/api/contracts/vodafone`, payload);
  }

  updateVodafoneContract(
    contractId: string,
    payload: UpdateVodafoneContractRequest,
  ): Observable<VodafoneContractDetail> {
    return this.http.patch<VodafoneContractDetail>(
      `${this.apiUrl}/api/contracts/vodafone/${contractId}`,
      payload,
    );
  }

  uploadAttachments(contractId: string, files: File[]): Observable<VodafoneContractDetail> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file, file.name);
    });

    return this.http.post<VodafoneContractDetail>(
      `${this.apiUrl}/api/contracts/vodafone/${contractId}/attachments`,
      formData,
    );
  }

  deleteAttachment(contractId: string, fileName: string): Observable<VodafoneContractDetail> {
    return this.http.delete<VodafoneContractDetail>(
      `${this.apiUrl}/api/contracts/vodafone/${contractId}/attachments/${encodeURIComponent(
        fileName,
      )}`,
    );
  }

  downloadDocument(contractId: string, document: VodafoneContractDocument): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/api/contracts/vodafone/${contractId}/attachments/${encodeURIComponent(
        document.fileName,
      )}/download`,
      { responseType: 'blob' },
    );
  }
}
