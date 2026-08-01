import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type RepsolContractStatus =
  | 'Pedido de Chamada'
  | 'Em validação'
  | 'Chamada Efetuada'
  | 'Pendente Assinatura Digital'
  | 'Não Conformidade'
  | 'Pendente Docs'
  | 'Documentos Enviados'
  | 'Atribuído';

export interface RepsolContractListUser {
  id: string;
  name: string;
}

export interface RepsolContract {
  id: string;

  nomeClienteEmpresa: string;
  nif: number;

  estado: RepsolContractStatus;

  tipoSegmento?: string;
  tipoProduto?: string;

  user: RepsolContractListUser | null;

  nomeRegistoCE?: string;
}

export interface RepsolContractUser {
  id: string;
  name: string;
}

export interface RepsolContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface RepsolContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface RepsolContractTeam {
  id: string;
  name: string;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface RepsolContractFollower {
  id: string;
  name: string;
}

export interface RepsolContractCampaign {
  id: string | null;
  name: string;
}

export interface RepsolContractDetail {
  id: string;
  companyId: string;
  clientId: string;

  tipoSegmento: string;
  tipoProduto: string;
  contratacao: string;
  tipoContratacaoLuz: string;
  tipoContratacaoGas: string;

  controleQualidade: string;
  codigoRegistoCE: string;
  nomeRegistoCE: string;

  estado: RepsolContractStatus;

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
  email: string;
  cae: string;
  crc: string;

  moradaInstalacao: string;
  moradaFaturacao: string;

  faturaEletronica: boolean;
  sva: boolean;
  debitoDireto: boolean;
  iban: string;

  campaign: RepsolContractCampaign | null;
  antigaComercializadora: string;

  cpe: string;
  cui: string;
  potencia: string | number;
  escalao?: number;
  cicloHorario: string;
  nivelTensao: string;

  documentos: RepsolContractDocument[];
  observacoes: string;

  user: RepsolContractUser | null;
  teams: RepsolContractTeam[];
  followers: RepsolContractFollower[];

  createdAt: string;
  updatedAt: string;
}

export interface CreateRepsolContractRequest {
  clientId: string;
  companyId: string;

  tipoSegmento?: string;
  tipoProduto?: string;
  contratacao?: string;
  tipoContratacaoLuz?: string;
  tipoContratacaoGas?: string;

  controleQualidade?: string;
  codigoRegistoCE?: string;
  nomeRegistoCE?: string;

  estado?: RepsolContractStatus;

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
  telefone?: number;
  email?: string;
  cae?: string;
  crc?: string;

  moradaInstalacao?: string;
  moradaFaturacao?: string;

  faturaEletronica?: boolean;
  sva?: boolean;
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

  userId: string;
  teams?: RepsolContractTeamVisibility[];
}

export type UpdateRepsolContractRequest = Partial<
  Omit<
    CreateRepsolContractRequest,
    | 'clientId'
    | 'companyId'
    | 'userId'
    | 'teams'
    | 'nif'
    | 'telefone'
    | 'potencia'
    | 'escalao'
  >
> & {
  nif?: number | null;
  telefone?: number | null;
  potencia?: string | number | null;
  escalao?: number | null;
};

@Injectable({
  providedIn: 'root',
})
export class RepsolContractService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getRepsolContracts(
    userId: string,
  ): Observable<RepsolContract[]> {
    return this.http.get<RepsolContract[]>(
      `${this.apiUrl}/api/contracts/repsol/followers/${userId}`,
    );
  }

  getRepsolContractById(
    contractId: string,
  ): Observable<RepsolContractDetail> {
    return this.http.get<RepsolContractDetail>(
      `${this.apiUrl}/api/contracts/repsol/${contractId}`,
    );
  }

  createRepsolContract(
    payload: CreateRepsolContractRequest,
  ): Observable<RepsolContractDetail> {
    return this.http.post<RepsolContractDetail>(
      `${this.apiUrl}/api/contracts/repsol`,
      payload,
    );
  }

  updateRepsolContract(
    contractId: string,
    payload: UpdateRepsolContractRequest,
  ): Observable<RepsolContractDetail> {
    return this.http.patch<RepsolContractDetail>(
      `${this.apiUrl}/api/contracts/repsol/${contractId}`,
      payload,
    );
  }

  uploadAttachments(
    contractId: string,
    files: File[],
  ): Observable<RepsolContractDetail> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append(
        'files',
        file,
        file.name,
      );
    });

    return this.http.post<RepsolContractDetail>(
      `${this.apiUrl}/api/contracts/repsol/${contractId}/attachments`,
      formData,
    );
  }

  deleteAttachment(
    contractId: string,
    fileName: string,
  ): Observable<RepsolContractDetail> {
    return this.http.delete<RepsolContractDetail>(
      `${this.apiUrl}/api/contracts/repsol/${contractId}/attachments/${encodeURIComponent(
        fileName,
      )}`,
    );
  }

  downloadDocument(
    contractId: string,
    document: RepsolContractDocument,
  ): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/api/contracts/repsol/${contractId}/attachments/${encodeURIComponent(
        document.fileName,
      )}/download`,
      {
        responseType: 'blob',
      },
    );
  }
}