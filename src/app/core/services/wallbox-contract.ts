import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type WallboxTipoSegmento =
  | 'Residencial'
  | 'Empresarial';

export type WallboxTipoProduto =
  | 'Luz'
  | 'Luz + Gás'
  | 'Gás';

export type WallboxContractStatus =
  | 'Pedido de Chamada'
  | 'Registo Plataforma Galp'
  | 'Não conformidade'
  | 'Em Ativação'
  | 'Ativo'
  | 'Anulado';

export const WALLBOX_CONTRACT_STATUSES: readonly WallboxContractStatus[] = [
  'Pedido de Chamada',
  'Registo Plataforma Galp',
  'Não conformidade',
  'Em Ativação',
  'Ativo',
  'Anulado',
];

export type WallboxNivelTensao =
  | 'Manter'
  | 'Monofásico'
  | 'Trifásico';

export type WallboxTipoLocalInstalacao =
  | 'Moradia'
  | 'Condomínio Ligação a QE comum'
  | 'Condomínio Ligação a QE cliente';

export type WallboxMetodoPagamento =
  | 'Pronto Pagamento'
  | 'Pagamento em Prestações';

export interface WallboxContractListUser {
  id: string;
  name: string;
}

export interface WallboxContract {
  id: string;

  nomeClienteEmpresa: string;
  nif: number;

  estado: WallboxContractStatus;

  tipoSegmento?: WallboxTipoSegmento;
  tipoProduto?: WallboxTipoProduto;

  numeroLead?: string;
  offer?: string;

  nomeRegistoCE?: string;
  codigoRegistoCE?: string;

  user: WallboxContractListUser | null;

  observacoes?: string;
  observacoesInternas?: string;
}

export interface WallboxContractUser {
  id: string;
  name: string;
}

export interface WallboxContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface WallboxContractTeamVisibilityRequest {
  teamId: string;
  minimumPositionIndex: number;
}

/**
 * Mantido por compatibilidade com o restante frontend.
 * A estrutura enviada para a API é exatamente a mesma.
 */
export type WallboxContractTeamVisibility =
  WallboxContractTeamVisibilityRequest;

export interface WallboxContractTeam {
  id: string;
  name: string;
  registrationNumber: number;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface WallboxContractFollower {
  id: string;
  name: string;
}

export interface WallboxContractCampaign {
  id: string | null;
  name: string;
}

export interface CreateWallboxContractRequest {
  companyId: string;
  clientId: string;

  tipoSegmento: WallboxTipoSegmento;
  tipoProduto: WallboxTipoProduto;

  estado?: WallboxContractStatus;

  controleQualidade?: string;
  nomeRegistoCE?: string;
  codigoRegistoCE?: string;

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
  moradaInstalacao?: string;
  moradaFaturacao?: string;

  campanha: string;

  nivelTensao?: WallboxNivelTensao;
  tipoLocalInstalacao?: WallboxTipoLocalInstalacao;
  metodoPagamento?: WallboxMetodoPagamento;

  comDeslocacao?: boolean;
  balanceamentoPotencia?: boolean;

  observacoes?: string;
  observacoesInternas?: string;

  userId: string;

  teams?: WallboxContractTeamVisibilityRequest[];
}

export interface WallboxContractCreateResponse {
  id: string;
  companyId: string;
  clientId: string;

  tipoSegmento: WallboxTipoSegmento;
  tipoProduto: WallboxTipoProduto;
  estado: WallboxContractStatus;

  controleQualidade?: string;
  nomeRegistoCE?: string;
  codigoRegistoCE?: string;

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
  moradaInstalacao?: string;
  moradaFaturacao?: string;

  campanha: string;

  nivelTensao?: WallboxNivelTensao;
  tipoLocalInstalacao?: WallboxTipoLocalInstalacao;
  metodoPagamento?: WallboxMetodoPagamento;

  comDeslocacao?: boolean;
  balanceamentoPotencia?: boolean;

  observacoes?: string;
  observacoesInternas?: string;

  userId: string;

  teams: WallboxContractTeamVisibilityRequest[];
  followers: string[];
  documentos: unknown[];

  createdAt?: string;
  updatedAt?: string;
}

export interface WallboxContractDetail {
  id: string;
  companyId: string;
  clientId: string;

  tipoSegmento: WallboxTipoSegmento;
  tipoProduto: WallboxTipoProduto;

  estado: WallboxContractStatus;

  controleQualidade?: string;
  nomeRegistoCE?: string;
  codigoRegistoCE?: string;

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

  moradaInstalacao?: string;
  moradaFaturacao?: string;

  campaign: WallboxContractCampaign | null;

  nivelTensao?: WallboxNivelTensao;
  tipoLocalInstalacao?: WallboxTipoLocalInstalacao;
  metodoPagamento?: WallboxMetodoPagamento;

  comDeslocacao: boolean;
  balanceamentoPotencia: boolean;

  documentos: WallboxContractDocument[];

  observacoes?: string;
  observacoesInternas?: string;

  user: WallboxContractUser | null;
  teams: WallboxContractTeam[];
  followers: WallboxContractFollower[];

  createdAt: string;
  updatedAt: string;
}

export type UpdateWallboxContractRequest = Partial<
  Omit<
    CreateWallboxContractRequest,
    | 'clientId'
    | 'companyId'
  >
> & {
  telefone?: number | null;
  email?: string;
  moradaInstalacao?: string;
  moradaFaturacao?: string;

  /*
   * Mantém explicitamente string para permitir limpar
   * os campos através do PATCH com valor ''.
   */
  observacoes?: string;
  observacoesInternas?: string;
};

@Injectable({
  providedIn: 'root',
})
export class WallboxContractService {
  private readonly http =
    inject(HttpClient);

  private readonly apiUrl =
    environment.apiUrl;

  getWallboxContracts(
    userId: string,
  ): Observable<WallboxContract[]> {
    return this.http.get<
      WallboxContract[]
    >(
      `${this.apiUrl}/api/contracts/wallbox/followers/${userId}`,
    );
  }

  getWallboxContractById(
    contractId: string,
  ): Observable<WallboxContractDetail> {
    return this.http.get<
      WallboxContractDetail
    >(
      `${this.apiUrl}/api/contracts/wallbox/${contractId}`,
    );
  }

  createWallboxContract(
    payload: CreateWallboxContractRequest,
  ): Observable<WallboxContractCreateResponse> {
    return this.http.post<
      WallboxContractCreateResponse
    >(
      `${this.apiUrl}/api/contracts/wallbox`,
      payload,
    );
  }

  updateWallboxContract(
    contractId: string,
    payload:
      UpdateWallboxContractRequest,
  ): Observable<WallboxContractDetail> {
    return this.http.patch<
      WallboxContractDetail
    >(
      `${this.apiUrl}/api/contracts/wallbox/${contractId}`,
      payload,
    );
  }

  uploadAttachments(
    contractId: string,
    files: File[],
  ): Observable<WallboxContractDetail> {
    const formData =
      new FormData();

    files.forEach((file) => {
      formData.append(
        'files',
        file,
        file.name,
      );
    });

    return this.http.post<
      WallboxContractDetail
    >(
      `${this.apiUrl}/api/contracts/wallbox/${contractId}/attachments`,
      formData,
    );
  }

  deleteAttachment(
    contractId: string,
    fileName: string,
  ): Observable<WallboxContractDetail> {
    return this.http.delete<
      WallboxContractDetail
    >(
      `${this.apiUrl}/api/contracts/wallbox/${contractId}/attachments/${encodeURIComponent(
        fileName,
      )}`,
    );
  }

  downloadDocument(
    contractId: string,
    document:
      WallboxContractDocument,
  ): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/api/contracts/wallbox/${contractId}/attachments/${encodeURIComponent(
        document.fileName,
      )}/download`,
      {
        responseType: 'blob',
      },
    );
  }
}
