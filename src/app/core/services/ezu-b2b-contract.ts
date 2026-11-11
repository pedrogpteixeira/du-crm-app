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
import { EZU_B2B_COMPANY_ID } from '../config/ezu-b2b-access';

export type EzuB2BContractStatus =
  | 'Pedido de Contratação'
  | 'Pedido de Proposta'
  | 'Pendente Docs'
  | 'Documentos Enviados'
  | 'Não Conformidade'
  | 'Pendente Assinatura'
  | 'Registo Plataforma Ezu'
  | 'Cancelado'
  | 'Ativo'
  | 'Parcialmente Baixa'
  | 'Baixa';

export const EZU_B2B_CONTRACT_STATUSES: readonly EzuB2BContractStatus[] = [
  'Pedido de Contratação',
  'Pedido de Proposta',
  'Pendente Docs',
  'Documentos Enviados',
  'Não Conformidade',
  'Pendente Assinatura',
  'Registo Plataforma Ezu',
  'Cancelado',
  'Ativo',
  'Parcialmente Baixa',
  'Baixa',
];

export const EZU_B2B_SEGMENT_OPTIONS = ['Empresarial', 'Condomínios'] as const;
export const EZU_B2B_TARIFF_TYPE_OPTIONS = ['MT', 'BTE', 'BTN'] as const;
export const EZU_B2B_LOYALTY_OPTIONS = ['12 meses', '24 meses'] as const;

export interface EzuB2BContractListUser {
  id: string;
  name: string;
}

export interface EzuB2BContract {
  id: string;
  nomeClienteEmpresa: string;
  nif: number;
  estado: EzuB2BContractStatus;
  tipoSegmento?: string;
  tipoProduto?: string;
  tipoTarifa?: string;
  user: EzuB2BContractListUser | null;
  nomeRegistoCE?: string;
  observacoes?: string;
  observacoesInternas?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EzuB2BContractUser {
  id: string;
  name: string;
}

export interface EzuB2BContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface EzuB2BContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface EzuB2BContractTeam {
  id: string;
  name: string;
  registrationNumber: number;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface EzuB2BContractFollower {
  id: string;
  name: string;
}

export interface EzuB2BContractCampaign {
  id: string | null;
  name: string;
}

export interface EzuB2BContractDetail {
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

  estado: EzuB2BContractStatus;

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

  campaign: EzuB2BContractCampaign | null;
  campaigns?: Campaign[];
  fidelizacao?: string | null;
  antigaComercializadora: string;

  cpe: string;
  cui: string;
  potencia: string | number;
  escalao?: number;
  cicloHorario: string;
  nivelTensao: string;

  documentos: EzuB2BContractDocument[];

  observacoes: string;
  observacoesInternas?: string;

  user: EzuB2BContractUser | null;
  teams: EzuB2BContractTeam[];
  followers: EzuB2BContractFollower[];

  createdAt: string;
  updatedAt: string;

  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
}

export interface CreateEzuB2BContractRequest {
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

  estado?: EzuB2BContractStatus;

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
  teams?: EzuB2BContractTeamVisibility[];
}

export type UpdateEzuB2BContractRequest = Partial<
  Omit<
    CreateEzuB2BContractRequest,
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

export type EzuB2BContractList = ContractListItemBase<EzuB2BContractStatus>;

@Injectable({ providedIn: 'root' })
export class EzuB2BContractService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/api/contracts/ezu-b2b`;

  readonly companyId = EZU_B2B_COMPANY_ID;

  getEzuB2BContracts(
    userId: string,
    query: ContractKanbanQuery = {},
  ): Observable<ContractKanbanResponse<EzuB2BContractList>> {
    const params = buildContractFiltersParams(query.filters, query.offset ?? 5, query.estado);

    return this.http.get<ContractKanbanResponse<EzuB2BContractList>>(
      `${this.baseUrl}/followers/${encodeURIComponent(userId)}`,
      { params },
    );
  }

  getTableContracts(
    userId: string,
    query: ContractTableQuery = {},
  ): Observable<ContractTableResponse<EzuB2BContractList>> {
    const params = buildContractTableParams(query);

    return this.http.get<ContractTableResponse<EzuB2BContractList>>(
      `${this.baseUrl}/followers/${encodeURIComponent(userId)}/table`,
      { params },
    );
  }

  getEzuB2BContractById(contractId: string): Observable<EzuB2BContractDetail> {
    return this.http.get<EzuB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}`,
    );
  }

  createEzuB2BContract(
    payload: CreateEzuB2BContractRequest,
  ): Observable<ContractCreationResponse<EzuB2BContractDetail>> {
    return this.http.post<ContractCreationResponse<EzuB2BContractDetail>>(this.baseUrl, {
      ...payload,
      companyId: EZU_B2B_COMPANY_ID,
    });
  }

  updateEzuB2BContract(
    contractId: string,
    payload: UpdateEzuB2BContractRequest,
  ): Observable<EzuB2BContractDetail> {
    return this.http.patch<EzuB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}`,
      payload,
    );
  }

  uploadAttachments(contractId: string, files: File[]): Observable<EzuB2BContractDetail> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));

    return this.http.post<EzuB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments`,
      formData,
    );
  }

  deleteAttachment(contractId: string, fileName: string): Observable<EzuB2BContractDetail> {
    return this.http.delete<EzuB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments/${encodeURIComponent(fileName)}`,
    );
  }

  downloadDocument(contractId: string, document: EzuB2BContractDocument): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments/${encodeURIComponent(document.fileName)}/download`,
      { responseType: 'blob' },
    );
  }
}
