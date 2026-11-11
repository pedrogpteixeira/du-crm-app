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
import { PLENITUDE_B2B_COMPANY_ID } from '../config/plenitude-b2b-access';

export type PlenitudeB2BContractStatus =
  | 'Pedido de Contratação'
  | 'Pedido de Proposta'
  | 'Pendente Docs'
  | 'Documentos Enviados'
  | 'Não Conformidade'
  | 'Pendente Assinatura'
  | 'Registo Plataforma Plenitude'
  | 'Cancelado'
  | 'Ativo'
  | 'Parcialmente Baixa'
  | 'Baixa';

export const PLENITUDE_B2B_CONTRACT_STATUSES: readonly PlenitudeB2BContractStatus[] = [
  'Pedido de Contratação',
  'Pedido de Proposta',
  'Pendente Docs',
  'Documentos Enviados',
  'Não Conformidade',
  'Pendente Assinatura',
  'Registo Plataforma Plenitude',
  'Cancelado',
  'Ativo',
  'Parcialmente Baixa',
  'Baixa',
];

export const PLENITUDE_B2B_SEGMENT_OPTIONS = ['Empresarial', 'Condomínios'] as const;
export const PLENITUDE_B2B_TARIFF_TYPE_OPTIONS = ['MT', 'BTE', 'BTN'] as const;
export const PLENITUDE_B2B_LOYALTY_OPTIONS = ['12 meses', '24 meses'] as const;

export interface PlenitudeB2BContractListUser {
  id: string;
  name: string;
}

export interface PlenitudeB2BContract {
  id: string;
  nomeClienteEmpresa: string;
  nif: number;
  estado: PlenitudeB2BContractStatus;
  tipoSegmento?: string;
  tipoProduto?: string;
  tipoTarifa?: string;
  user: PlenitudeB2BContractListUser | null;
  nomeRegistoCE?: string;
  observacoes?: string;
  observacoesInternas?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlenitudeB2BContractUser {
  id: string;
  name: string;
}

export interface PlenitudeB2BContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface PlenitudeB2BContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface PlenitudeB2BContractTeam {
  id: string;
  name: string;
  registrationNumber: number;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface PlenitudeB2BContractFollower {
  id: string;
  name: string;
}

export interface PlenitudeB2BContractCampaign {
  id: string | null;
  name: string;
}

export interface PlenitudeB2BContractDetail {
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

  estado: PlenitudeB2BContractStatus;

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

  campaign: PlenitudeB2BContractCampaign | null;
  campaigns?: Campaign[];
  fidelizacao?: string | null;
  antigaComercializadora: string;

  cpe: string;
  cui: string;
  potencia: string | number;
  escalao?: number;
  cicloHorario: string;
  nivelTensao: string;

  documentos: PlenitudeB2BContractDocument[];

  observacoes: string;
  observacoesInternas?: string;

  user: PlenitudeB2BContractUser | null;
  teams: PlenitudeB2BContractTeam[];
  followers: PlenitudeB2BContractFollower[];

  createdAt: string;
  updatedAt: string;

  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
}

export interface CreatePlenitudeB2BContractRequest {
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

  estado?: PlenitudeB2BContractStatus;

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
  teams?: PlenitudeB2BContractTeamVisibility[];
}

export type UpdatePlenitudeB2BContractRequest = Partial<
  Omit<
    CreatePlenitudeB2BContractRequest,
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

export type PlenitudeB2BContractList = ContractListItemBase<PlenitudeB2BContractStatus>;

@Injectable({ providedIn: 'root' })
export class PlenitudeB2BContractService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/api/contracts/plenitude-b2b`;

  readonly companyId = PLENITUDE_B2B_COMPANY_ID;

  getPlenitudeB2BContracts(
    userId: string,
    query: ContractKanbanQuery = {},
  ): Observable<ContractKanbanResponse<PlenitudeB2BContractList>> {
    const params = buildContractFiltersParams(query.filters, query.offset ?? 5, query.estado);

    return this.http.get<ContractKanbanResponse<PlenitudeB2BContractList>>(
      `${this.baseUrl}/followers/${encodeURIComponent(userId)}`,
      { params },
    );
  }

  getTableContracts(
    userId: string,
    query: ContractTableQuery = {},
  ): Observable<ContractTableResponse<PlenitudeB2BContractList>> {
    const params = buildContractTableParams(query);

    return this.http.get<ContractTableResponse<PlenitudeB2BContractList>>(
      `${this.baseUrl}/followers/${encodeURIComponent(userId)}/table`,
      { params },
    );
  }

  getPlenitudeB2BContractById(contractId: string): Observable<PlenitudeB2BContractDetail> {
    return this.http.get<PlenitudeB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}`,
    );
  }

  createPlenitudeB2BContract(
    payload: CreatePlenitudeB2BContractRequest,
  ): Observable<ContractCreationResponse<PlenitudeB2BContractDetail>> {
    return this.http.post<ContractCreationResponse<PlenitudeB2BContractDetail>>(this.baseUrl, {
      ...payload,
      companyId: PLENITUDE_B2B_COMPANY_ID,
    });
  }

  updatePlenitudeB2BContract(
    contractId: string,
    payload: UpdatePlenitudeB2BContractRequest,
  ): Observable<PlenitudeB2BContractDetail> {
    return this.http.patch<PlenitudeB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}`,
      payload,
    );
  }

  uploadAttachments(contractId: string, files: File[]): Observable<PlenitudeB2BContractDetail> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));

    return this.http.post<PlenitudeB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments`,
      formData,
    );
  }

  deleteAttachment(contractId: string, fileName: string): Observable<PlenitudeB2BContractDetail> {
    return this.http.delete<PlenitudeB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments/${encodeURIComponent(fileName)}`,
    );
  }

  downloadDocument(contractId: string, document: PlenitudeB2BContractDocument): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments/${encodeURIComponent(document.fileName)}/download`,
      { responseType: 'blob' },
    );
  }
}
