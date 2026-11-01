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
import { PORTULOGOS_B2B_COMPANY_ID } from '../config/portulogos-b2b-access';

export type PortulogosB2BContractStatus =
  | 'Pedido de Contratação'
  | 'Pedido de Proposta'
  | 'Pendente Docs'
  | 'Documentos Enviados'
  | 'Não Conformidade'
  | 'Pendente Assinatura'
  | 'Registo Plataforma Portulogos'
  | 'Cancelado'
  | 'Ativo'
  | 'Parcialmente Baixa'
  | 'Baixa';

export const PORTULOGOS_B2B_CONTRACT_STATUSES: readonly PortulogosB2BContractStatus[] = [
  'Pedido de Contratação',
  'Pedido de Proposta',
  'Pendente Docs',
  'Documentos Enviados',
  'Não Conformidade',
  'Pendente Assinatura',
  'Registo Plataforma Portulogos',
  'Cancelado',
  'Ativo',
  'Parcialmente Baixa',
  'Baixa',
];

export const PORTULOGOS_B2B_SEGMENT_OPTIONS = ['Empresarial', 'Condomínios'] as const;
export const PORTULOGOS_B2B_TARIFF_TYPE_OPTIONS = ['MT', 'BTE', 'BTN'] as const;

export interface PortulogosB2BContractListUser {
  id: string;
  name: string;
}

export interface PortulogosB2BContract {
  id: string;
  nomeClienteEmpresa: string;
  nif: number;
  estado: PortulogosB2BContractStatus;
  tipoSegmento?: string;
  tipoProduto?: string;
  tipoTarifa?: string;
  user: PortulogosB2BContractListUser | null;
  nomeRegistoCE?: string;
  observacoes?: string;
  observacoesInternas?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PortulogosB2BContractUser {
  id: string;
  name: string;
}

export interface PortulogosB2BContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface PortulogosB2BContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface PortulogosB2BContractTeam {
  id: string;
  name: string;
  registrationNumber: number;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface PortulogosB2BContractFollower {
  id: string;
  name: string;
}

export interface PortulogosB2BContractCampaign {
  id: string | null;
  name: string;
}

export interface PortulogosB2BContractDetail {
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

  estado: PortulogosB2BContractStatus;

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
  contactoResponsavel?: string;
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

  campaign: PortulogosB2BContractCampaign | null;
  campaigns?: Campaign[];
  antigaComercializadora: string;

  cpe: string;
  cui: string;
  potencia: string | number;
  escalao?: number;
  cicloHorario: string;
  nivelTensao: string;

  documentos: PortulogosB2BContractDocument[];

  observacoes: string;
  observacoesInternas?: string;

  user: PortulogosB2BContractUser | null;
  teams: PortulogosB2BContractTeam[];
  followers: PortulogosB2BContractFollower[];

  createdAt: string;
  updatedAt: string;

  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
}

export interface CreatePortulogosB2BContractRequest {
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

  estado?: PortulogosB2BContractStatus;

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
  contactoResponsavel?: string;
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
  teams?: PortulogosB2BContractTeamVisibility[];
}

export type UpdatePortulogosB2BContractRequest = Partial<
  Omit<
    CreatePortulogosB2BContractRequest,
    | 'clientId'
    | 'companyId'
    | 'userId'
    | 'teams'
    | 'nif'
    | 'telefone'
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
  potencia?: string | number | null;
  escalao?: number | null;
  observacoesInternas?: string;
};

export type PortulogosB2BContractList = ContractListItemBase<PortulogosB2BContractStatus>;

@Injectable({ providedIn: 'root' })
export class PortulogosB2BContractService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/api/contracts/portulogos-b2b`;

  readonly companyId = PORTULOGOS_B2B_COMPANY_ID;

  getPortulogosB2BContracts(
    userId: string,
    query: ContractKanbanQuery = {},
  ): Observable<ContractKanbanResponse<PortulogosB2BContractList>> {
    const params = buildContractFiltersParams(query.filters, query.offset ?? 5, query.estado);

    return this.http.get<ContractKanbanResponse<PortulogosB2BContractList>>(
      `${this.baseUrl}/followers/${encodeURIComponent(userId)}`,
      { params },
    );
  }

  getTableContracts(
    userId: string,
    query: ContractTableQuery = {},
  ): Observable<ContractTableResponse<PortulogosB2BContractList>> {
    const params = buildContractTableParams(query);

    return this.http.get<ContractTableResponse<PortulogosB2BContractList>>(
      `${this.baseUrl}/followers/${encodeURIComponent(userId)}/table`,
      { params },
    );
  }

  getPortulogosB2BContractById(contractId: string): Observable<PortulogosB2BContractDetail> {
    return this.http.get<PortulogosB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}`,
    );
  }

  createPortulogosB2BContract(
    payload: CreatePortulogosB2BContractRequest,
  ): Observable<ContractCreationResponse<PortulogosB2BContractDetail>> {
    return this.http.post<ContractCreationResponse<PortulogosB2BContractDetail>>(this.baseUrl, {
      ...payload,
      companyId: PORTULOGOS_B2B_COMPANY_ID,
    });
  }

  updatePortulogosB2BContract(
    contractId: string,
    payload: UpdatePortulogosB2BContractRequest,
  ): Observable<PortulogosB2BContractDetail> {
    return this.http.patch<PortulogosB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}`,
      payload,
    );
  }

  uploadAttachments(contractId: string, files: File[]): Observable<PortulogosB2BContractDetail> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));

    return this.http.post<PortulogosB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments`,
      formData,
    );
  }

  deleteAttachment(contractId: string, fileName: string): Observable<PortulogosB2BContractDetail> {
    return this.http.delete<PortulogosB2BContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments/${encodeURIComponent(fileName)}`,
    );
  }

  downloadDocument(contractId: string, document: PortulogosB2BContractDocument): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments/${encodeURIComponent(document.fileName)}/download`,
      { responseType: 'blob' },
    );
  }
}
