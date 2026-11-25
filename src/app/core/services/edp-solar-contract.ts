import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { ContractFlowEntry, ContractTicketSummary } from '../models/contract-activity';

import { environment } from '../../../environments/environment';

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
export type EdpSolarContractStatus =
  | 'Pedido de Proposta'
  | 'Proposta enviada'
  | 'Envio Quality Check'
  | 'Pendente Docs'
  | 'Documentos Enviados'
  | 'Em instalação'
  | 'Ativo'
  | 'Cancelado';

export const EDP_SOLAR_STATUSES: EdpSolarContractStatus[] = [
  'Pedido de Proposta',
  'Proposta enviada',
  'Envio Quality Check',
  'Pendente Docs',
  'Documentos Enviados',
  'Em instalação',
  'Ativo',
  'Cancelado',
];

export const EDP_SOLAR_PANEL_SUGGESTIONS = [
  'Special - 380W',
  'Premium - 355W',
  'Start - 415W',
  'Advanced - 405W',
  'Painéis 480WP',
  'Painéis 485WP',
  'Painéis 540WP',
] as const;

export const EDP_SOLAR_PAYMENT_METHOD_SUGGESTIONS = [
  'Pronto Pagamento',
  '48 meses',
  '60 meses',
] as const;

export interface EdpSolarContractListUser {
  id: string;
  name: string;
}

export interface EdpSolarContractDocument {
  originalName: string;
  fileName: string;
  path?: string;
  storageKey?: string;
  storageProvider?: string;
  mimetype?: string;
  size?: number;
  _id?: string;
}

export interface EdpSolarContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface EdpSolarContractTeam {
  id: string;
  name: string;
  registrationNumber?: number | null;
  minimumPositionIndex?: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface EdpSolarContractFollower {
  id: string;
  name: string;
}

export interface EdpSolarContract {
  id: string;
  companyId: string;
  clientId: string;
  contratacao?: string;
  tipoSegmento?: string;
  tipoProduto?: string;
  controleQualidade?: string;
  codigoRegistoCE?: string;
  nomeRegistoCE?: string;
  estado: EdpSolarContractStatus;

  motivoAnulacao?: string | null;
  motivoAnulacaoOutras?: string | null;
  agendamento?: string;
  dataAssinatura?: string;
  dataContrato?: string;
  dataRegisto?: string;
  dataPrevistaInstalacao?: string;
  dataInstalacao?: string;
  dataAtivacao?: string;
  dataBaixa?: string;
  numeroLead?: string;
  offer?: string;
  nomeClienteEmpresa: string;
  nif: number;
  telefone?: number | null;
  email?: string;
  cae?: string;
  crc?: string;
  moradaInstalacao?: string;
  moradaFaturacao?: string;
  faturaEletronica?: boolean;
  debitoDireto?: boolean;
  nib?: string;
  tipoPainel: string;
  microinversor?: boolean;
  baterias?: boolean;
  numeroPaineisSolares: number;
  metodoPagamento?: string;
  documentos?: EdpSolarContractDocument[];
  observacoes?: string;
  observacoesInternas?: string;
  userId?: string;
  user?: EdpSolarContractListUser | null;
  teams?: EdpSolarContractTeam[];
  followers?: EdpSolarContractFollower[];
  createdAt?: string;
  updatedAt?: string;

  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
}

export interface CreateEdpSolarContractRequest {
  companyId: string;
  clientId: string;
  userId: string;
  teams?: EdpSolarContractTeamVisibility[];
  contratacao?: string;
  tipoSegmento?: string;
  tipoProduto?: string;
  controleQualidade?: string;
  codigoRegistoCE?: string;
  nomeRegistoCE?: string;
  estado?: EdpSolarContractStatus;

  motivoAnulacao?: string | null;
  motivoAnulacaoOutras?: string | null;
  agendamento?: string;
  dataAssinatura?: string;
  dataContrato?: string;
  dataRegisto?: string;
  dataPrevistaInstalacao?: string;
  dataInstalacao?: string;
  dataAtivacao?: string;
  dataBaixa?: string;
  numeroLead?: string;
  offer?: string;
  nomeClienteEmpresa: string;
  nif: number;
  telefone?: number | null;
  email?: string;
  cae?: string;
  crc?: string;
  moradaInstalacao?: string;
  moradaFaturacao?: string;
  faturaEletronica?: boolean;
  debitoDireto?: boolean;
  nib?: string;
  tipoPainel: string;
  microinversor?: boolean;
  baterias?: boolean;
  numeroPaineisSolares: number;
  metodoPagamento?: string;
  observacoes?: string;
  observacoesInternas?: string;
}

export type UpdateEdpSolarContractRequest = Partial<
  Omit<
    CreateEdpSolarContractRequest,
    'companyId' | 'clientId' | 'userId' | 'teams' | 'dataRegisto' | 'dataAtivacao'
  >
> & {
  dataRegisto?: string | null;
  dataAtivacao?: string | null;
};

export type EdpSolarContractList = ContractListItemBase<EdpSolarContractStatus>;

@Injectable({ providedIn: 'root' })
export class EdpSolarContractService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/contracts/edp-solar`;

  getAll(): Observable<EdpSolarContract[]> {
    return this.http.get<EdpSolarContract[]>(this.baseUrl);
  }

  getById(id: string): Observable<EdpSolarContract> {
    return this.http.get<EdpSolarContract>(`${this.baseUrl}/${id}`);
  }

  getByCompanyId(companyId: string): Observable<EdpSolarContract[]> {
    return this.http.get<EdpSolarContract[]>(`${this.baseUrl}/company/${companyId}`);
  }

  getByUserId(userId: string): Observable<EdpSolarContract[]> {
    return this.http.get<EdpSolarContract[]>(`${this.baseUrl}/user/${userId}`);
  }

  getByFollowerId(
    userId: string,
    query: ContractKanbanQuery = {},
  ): Observable<ContractKanbanResponse<EdpSolarContractList>> {
    const params = buildContractFiltersParams(query.filters, query.offset ?? 5, query.estado);

    return this.http.get<ContractKanbanResponse<EdpSolarContractList>>(
      `${this.baseUrl}/followers/${userId}`,
      { params },
    );
  }

  getTableContracts(
    userId: string,
    query: ContractTableQuery = {},
  ): Observable<ContractTableResponse<EdpSolarContractList>> {
    const params = buildContractTableParams(query);

    return this.http.get<ContractTableResponse<EdpSolarContractList>>(
      `${this.baseUrl}/followers/${userId}/table`,
      { params },
    );
  }

  create(payload: CreateEdpSolarContractRequest): Observable<EdpSolarContract> {
    return this.http.post<EdpSolarContract>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateEdpSolarContractRequest): Observable<EdpSolarContract> {
    return this.http.patch<EdpSolarContract>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  uploadAttachment(id: string, file: File): Observable<EdpSolarContract> {
    return this.uploadAttachments(id, [file]);
  }

  deleteContract(contractId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${encodeURIComponent(contractId)}`);
  }

  uploadAttachments(id: string, files: File[]): Observable<EdpSolarContract> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));
    return this.http.post<EdpSolarContract>(`${this.baseUrl}/${id}/attachments`, formData);
  }

  deleteAttachment(id: string, fileName: string): Observable<EdpSolarContract> {
    return this.http.delete<EdpSolarContract>(
      `${this.baseUrl}/${id}/attachments/${encodeURIComponent(fileName)}`,
    );
  }

  downloadAttachment(id: string, fileName: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${id}/attachments/${encodeURIComponent(fileName)}/download`,
      { responseType: 'blob' },
    );
  }
}
