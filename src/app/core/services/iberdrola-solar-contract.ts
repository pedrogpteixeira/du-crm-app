import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { ContractFlowEntry, ContractTicketSummary } from '../models/contract-activity';

import { environment } from '../../../environments/environment';

export const IBERDROLA_SOLAR_COMPANY_ID =
  'cmp_FKsS04kTr7' as const;

export type IberdrolaSolarTipoSegmento =
  | 'Residencial'
  | 'Empresarial';

export type IberdrolaSolarTipoProduto =
  'Painéis Solares';

export type IberdrolaSolarContratacao =
  | 'Contratação Digital'
  | 'Contratação Papel';

export type IberdrolaSolarMetodoPagamento =
  | 'Pronto Pagamento'
  | '12 Meses'
  | '36 Meses';

export const IBERDROLA_SOLAR_PAYMENT_METHODS:
  readonly IberdrolaSolarMetodoPagamento[] = [
    'Pronto Pagamento',
    '12 Meses',
    '36 Meses',
  ];

export type IberdrolaSolarContractStatus =
  | 'Pedido de Proposta'
  | 'Proposta Enviada'
  | 'Pendente Docs'
  | 'Em instalação'
  | 'Cancelado'
  | 'Ativo';

export const IBERDROLA_SOLAR_CONTRACT_STATUSES:
  readonly IberdrolaSolarContractStatus[] = [
    'Pedido de Proposta',
    'Proposta Enviada',
    'Pendente Docs',
    'Em instalação',
    'Cancelado',
    'Ativo',
  ];

export interface IberdrolaSolarContractListUser {
  id: string;
  name: string;
}

export interface IberdrolaSolarContractDocument {
  originalName: string;
  fileName: string;
  path?: string;
  storageKey?: string;
  storageProvider?: string;
  mimetype?: string;
  size?: number;
  _id?: string;
}

export interface IberdrolaSolarContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface IberdrolaSolarContractTeam {
  id: string;
  name: string;
  registrationNumber?: number | null;
  minimumPositionIndex?: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface IberdrolaSolarContractFollower {
  id: string;
  name: string;
}

export interface IberdrolaSolarContractCampaign {
  id: string | null;
  name: string;
}

export interface IberdrolaSolarContract {
  id: string;
  companyId: string;
  clientId: string;

  tipoSegmento: IberdrolaSolarTipoSegmento;
  tipoProduto: IberdrolaSolarTipoProduto;
  contratacao: IberdrolaSolarContratacao;

  controleQualidade?: string;
  nomeRegistoCE?: string;
  codigoRegistoCE?: string;

  estado: IberdrolaSolarContractStatus;

  agendamento?: string;
  dataAssinatura?: string;
  dataContrato?: string;
  dataRegisto?: string;
  dataInstalacao?: string;
  dataAtivacao?: string;
  dataBaixa?: string;

  numeroLead?: string;
  offer?: string;

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
  nib?: string;

  microinversor: boolean;
  baterias: boolean;
  numeroPaineisSolares: number;
  metodoPagamento: IberdrolaSolarMetodoPagamento;

  campaign: IberdrolaSolarContractCampaign | null;

  documentos: IberdrolaSolarContractDocument[];
  observacoes?: string;
  observacoesInternas?: string;

  userId?: string;
  user: IberdrolaSolarContractListUser | null;
  teams: IberdrolaSolarContractTeam[];
  followers: IberdrolaSolarContractFollower[];

  createdAt?: string;
  updatedAt?: string;

  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
}

export type IberdrolaSolarContractDetail =
  IberdrolaSolarContract;

export interface CreateIberdrolaSolarContractRequest {
  companyId: typeof IBERDROLA_SOLAR_COMPANY_ID;
  clientId: string;
  userId: string;
  teams?: IberdrolaSolarContractTeamVisibility[];

  tipoSegmento: IberdrolaSolarTipoSegmento;
  tipoProduto: IberdrolaSolarTipoProduto;
  contratacao: IberdrolaSolarContratacao;

  controleQualidade?: string;
  nomeRegistoCE?: string;
  codigoRegistoCE?: string;

  estado?: IberdrolaSolarContractStatus;

  agendamento?: string;
  dataAssinatura?: string;
  dataContrato?: string;
  dataRegisto?: string;
  dataInstalacao?: string;
  dataAtivacao?: string;
  dataBaixa?: string;

  numeroLead?: string;
  offer?: string;

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
  nib?: string;

  microinversor: boolean;
  baterias: boolean;
  numeroPaineisSolares: number;
  metodoPagamento: IberdrolaSolarMetodoPagamento;

  observacoes?: string;
  observacoesInternas?: string;
}

export type UpdateIberdrolaSolarContractRequest =
  Partial<
    Omit<
      CreateIberdrolaSolarContractRequest,
      'companyId' | 'clientId' | 'userId' | 'teams'
    >
  >;

@Injectable({ providedIn: 'root' })
export class IberdrolaSolarContractService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl =
    `${environment.apiUrl}/api/contracts/iberdrola-solar`;

  getAll(): Observable<IberdrolaSolarContract[]> {
    return this.http.get<IberdrolaSolarContract[]>(
      this.baseUrl,
    );
  }

  getById(
    id: string,
  ): Observable<IberdrolaSolarContract> {
    return this.http.get<IberdrolaSolarContract>(
      `${this.baseUrl}/${id}`,
    );
  }

  getByCompanyId(
    companyId: string,
  ): Observable<IberdrolaSolarContract[]> {
    return this.http.get<IberdrolaSolarContract[]>(
      `${this.baseUrl}/company/${companyId}`,
    );
  }

  getByUserId(
    userId: string,
  ): Observable<IberdrolaSolarContract[]> {
    return this.http.get<IberdrolaSolarContract[]>(
      `${this.baseUrl}/user/${userId}`,
    );
  }

  getByFollowerId(
    userId: string,
  ): Observable<IberdrolaSolarContract[]> {
    return this.http.get<IberdrolaSolarContract[]>(
      `${this.baseUrl}/followers/${userId}`,
    );
  }

  create(
    payload: CreateIberdrolaSolarContractRequest,
  ): Observable<IberdrolaSolarContract> {
    return this.http.post<IberdrolaSolarContract>(
      this.baseUrl,
      payload,
    );
  }

  update(
    id: string,
    payload: UpdateIberdrolaSolarContractRequest,
  ): Observable<IberdrolaSolarContract> {
    return this.http.patch<IberdrolaSolarContract>(
      `${this.baseUrl}/${id}`,
      payload,
    );
  }

  delete(
    id: string,
  ): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/${id}`,
    );
  }

  uploadAttachment(
    id: string,
    file: File,
  ): Observable<IberdrolaSolarContract> {
    return this.uploadAttachments(id, [file]);
  }

  uploadAttachments(
    id: string,
    files: File[],
  ): Observable<IberdrolaSolarContract> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append(
        'files',
        file,
        file.name,
      );
    });

    return this.http.post<IberdrolaSolarContract>(
      `${this.baseUrl}/${id}/attachments`,
      formData,
    );
  }

  deleteAttachment(
    id: string,
    fileName: string,
  ): Observable<IberdrolaSolarContract> {
    return this.http.delete<IberdrolaSolarContract>(
      `${this.baseUrl}/${id}/attachments/${encodeURIComponent(fileName)}`,
    );
  }

  downloadAttachment(
    id: string,
    fileName: string,
  ): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${id}/attachments/${encodeURIComponent(fileName)}/download`,
      {
        responseType: 'blob',
      },
    );
  }
}
