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
import { EDP_POWER_GAS_COMPANY_ID } from '../config/edp-power-gas-access';

export type EdpPowerGasContractStatus =
  | 'Pedido de Contratação'
  | 'Pedido de Proposta'
  | 'Pendente Docs'
  | 'Documentos Enviados'
  | 'Não Conformidade'
  | 'Pendente Assinatura'
  | 'Registo Plataforma EDP'
  | 'Cancelado'
  | 'Ativo'
  | 'Parcialmente Baixa'
  | 'Baixa';

export const EDP_POWER_GAS_CONTRACT_STATUSES: readonly EdpPowerGasContractStatus[] = [
  'Pedido de Contratação',
  'Pedido de Proposta',
  'Pendente Docs',
  'Documentos Enviados',
  'Não Conformidade',
  'Pendente Assinatura',
  'Registo Plataforma EDP',
  'Cancelado',
  'Ativo',
  'Parcialmente Baixa',
  'Baixa',
];

export const EDP_POWER_GAS_SEGMENT_OPTIONS = ['Empresarial', 'Condomínios'] as const;
export const EDP_POWER_GAS_TARIFF_TYPE_OPTIONS = ['MT', 'BTE', 'BTN'] as const;
export const EDP_POWER_GAS_LOYALTY_OPTIONS = ['12 meses', '24 meses'] as const;

export interface EdpPowerGasContractListUser {
  id: string;
  name: string;
}

export interface EdpPowerGasContract {
  id: string;
  nomeClienteEmpresa: string;
  nif: number;
  estado: EdpPowerGasContractStatus;
  tipoSegmento?: string;
  tipoProduto?: string;
  tipoTarifa?: string;
  user: EdpPowerGasContractListUser | null;
  nomeRegistoCE?: string;
  observacoes?: string;
  observacoesInternas?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EdpPowerGasContractUser {
  id: string;
  name: string;
}

export interface EdpPowerGasContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface EdpPowerGasContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface EdpPowerGasContractTeam {
  id: string;
  name: string;
  registrationNumber: number;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface EdpPowerGasContractFollower {
  id: string;
  name: string;
}

export interface EdpPowerGasContractCampaign {
  id: string | null;
  name: string;
}

export interface EdpPowerGasContractDetail {
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

  estado: EdpPowerGasContractStatus;

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

  campaign: EdpPowerGasContractCampaign | null;
  campaigns?: Campaign[];
  fidelizacao?: string | null;
  antigaComercializadora: string;

  cpe: string;
  cui: string;
  potencia: string | number;
  escalao?: number;
  cicloHorario: string;
  nivelTensao: string;

  documentos: EdpPowerGasContractDocument[];

  observacoes: string;
  observacoesInternas?: string;

  user: EdpPowerGasContractUser | null;
  teams: EdpPowerGasContractTeam[];
  followers: EdpPowerGasContractFollower[];

  createdAt: string;
  updatedAt: string;

  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
}

export interface CreateEdpPowerGasContractRequest {
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

  estado?: EdpPowerGasContractStatus;

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
  teams?: EdpPowerGasContractTeamVisibility[];
}

export type UpdateEdpPowerGasContractRequest = Partial<
  Omit<
    CreateEdpPowerGasContractRequest,
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

export type EdpPowerGasContractList = ContractListItemBase<EdpPowerGasContractStatus>;

@Injectable({ providedIn: 'root' })
export class EdpPowerGasContractService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/api/contracts/edp-power-gas`;

  readonly companyId = EDP_POWER_GAS_COMPANY_ID;

  getEdpPowerGasContracts(
    userId: string,
    query: ContractKanbanQuery = {},
  ): Observable<ContractKanbanResponse<EdpPowerGasContractList>> {
    const params = buildContractFiltersParams(query.filters, query.offset ?? 5, query.estado);

    return this.http.get<ContractKanbanResponse<EdpPowerGasContractList>>(
      `${this.baseUrl}/followers/${encodeURIComponent(userId)}`,
      { params },
    );
  }

  getTableContracts(
    userId: string,
    query: ContractTableQuery = {},
  ): Observable<ContractTableResponse<EdpPowerGasContractList>> {
    const params = buildContractTableParams(query);

    return this.http.get<ContractTableResponse<EdpPowerGasContractList>>(
      `${this.baseUrl}/followers/${encodeURIComponent(userId)}/table`,
      { params },
    );
  }

  getEdpPowerGasContractById(contractId: string): Observable<EdpPowerGasContractDetail> {
    return this.http.get<EdpPowerGasContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}`,
    );
  }

  createEdpPowerGasContract(
    payload: CreateEdpPowerGasContractRequest,
  ): Observable<ContractCreationResponse<EdpPowerGasContractDetail>> {
    return this.http.post<ContractCreationResponse<EdpPowerGasContractDetail>>(this.baseUrl, {
      ...payload,
      companyId: EDP_POWER_GAS_COMPANY_ID,
    });
  }

  updateEdpPowerGasContract(
    contractId: string,
    payload: UpdateEdpPowerGasContractRequest,
  ): Observable<EdpPowerGasContractDetail> {
    return this.http.patch<EdpPowerGasContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}`,
      payload,
    );
  }

  deleteContract(contractId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${encodeURIComponent(contractId)}`);
  }

  uploadAttachments(contractId: string, files: File[]): Observable<EdpPowerGasContractDetail> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));

    return this.http.post<EdpPowerGasContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments`,
      formData,
    );
  }

  deleteAttachment(contractId: string, fileName: string): Observable<EdpPowerGasContractDetail> {
    return this.http.delete<EdpPowerGasContractDetail>(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments/${encodeURIComponent(fileName)}`,
    );
  }

  downloadDocument(contractId: string, document: EdpPowerGasContractDocument): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${encodeURIComponent(contractId)}/attachments/${encodeURIComponent(document.fileName)}/download`,
      { responseType: 'blob' },
    );
  }
}
