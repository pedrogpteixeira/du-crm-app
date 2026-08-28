import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type GalpPowerGasContractStatus =
  | 'Pedido de chamada'
  | 'Em validação'
  | 'Não Conformidade'
  | 'Documentos Enviados'
  | 'Sem Registo'
  | 'Registo Plataforma Galp'
  | 'Pendente Doc'
  | 'Em ativação'
  | 'Ativo'
  | 'Parcialmente Baixa'
  | 'Cancelado'
  | 'Baixa';

export const GALP_POWER_GAS_STATUSES: GalpPowerGasContractStatus[] = [
  'Pedido de chamada',
  'Em validação',
  'Não Conformidade',
  'Documentos Enviados',
  'Sem Registo',
  'Registo Plataforma Galp',
  'Pendente Doc',
  'Em ativação',
  'Ativo',
  'Parcialmente Baixa',
  'Cancelado',
  'Baixa',
];

export interface GalpPowerGasContractListUser {
  id: string;
  name: string;
}

export interface GalpPowerGasContract {
  id: string;

  nomeClienteEmpresa: string;
  nif: number;

  estado: GalpPowerGasContractStatus;

  tipoSegmento?: string;
  tipoProduto?: string;

  user: GalpPowerGasContractListUser | null;

  nomeRegistoCE?: string;
  clientId?: string;
  campanha?: string;
  campaign?: GalpPowerGasContractCampaign | null;
  cpe?: string;
  cui?: string;
  dataContrato?: string;
  dataAtivacaoCPE?: string;
  dataAtivacaoCUI?: string;

  observacoes?: string;
  observacoesInternas?: string;
}

export interface GalpPowerGasContractUser {
  id: string;
  name: string;
}

export interface GalpPowerGasContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface GalpPowerGasContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface GalpPowerGasContractTeam {
  id: string;
  name: string;
  registrationNumber: number;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface GalpPowerGasContractFollower {
  id: string;
  name: string;
}

export interface GalpPowerGasContractCampaign {
  id: string | null;
  name: string;
}

export interface GalpPowerGasContractDetail {
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

  estado: GalpPowerGasContractStatus;

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

  campaign: GalpPowerGasContractCampaign | null;
  antigaComercializadora: string;

  cpe: string;
  cui: string;
  potencia: string | number;
  escalao?: number;
  cicloHorario: string;
  nivelTensao: string;

  documentos: GalpPowerGasContractDocument[];

  observacoes: string;
  observacoesInternas?: string;

  user: GalpPowerGasContractUser | null;
  teams: GalpPowerGasContractTeam[];
  followers: GalpPowerGasContractFollower[];

  createdAt: string;
  updatedAt: string;
}

export interface CreateGalpPowerGasContractRequest {
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

  estado?: GalpPowerGasContractStatus;

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
  observacoesInternas?: string;

  userId: string;
  teams?: GalpPowerGasContractTeamVisibility[];
}

export type UpdateGalpPowerGasContractRequest = Partial<
  Omit<
    CreateGalpPowerGasContractRequest,
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

  /*
   * Mantém explicitamente string para permitir:
   *
   * {
   *   observacoesInternas: ''
   * }
   *
   * e assim limpar o campo através do PATCH.
   */
  observacoesInternas?: string;
};

@Injectable({
  providedIn: 'root',
})
export class GalpPowerGasContractService {
  private readonly http =
    inject(HttpClient);

  private readonly apiUrl =
    environment.apiUrl;

  getAll(): Observable<GalpPowerGasContract[]> {
    return this.http.get<GalpPowerGasContract[]>(
      `${this.apiUrl}/api/contracts/galp-power-gas`,
    );
  }

  getByCompanyId(companyId: string): Observable<GalpPowerGasContract[]> {
    return this.http.get<GalpPowerGasContract[]>(
      `${this.apiUrl}/api/contracts/galp-power-gas/company/${companyId}`,
    );
  }

  getByUserId(userId: string): Observable<GalpPowerGasContract[]> {
    return this.http.get<GalpPowerGasContract[]>(
      `${this.apiUrl}/api/contracts/galp-power-gas/user/${userId}`,
    );
  }

  getByFollowerId(userId: string): Observable<GalpPowerGasContract[]> {
    return this.getGalpPowerGasContracts(userId);
  }

  getGalpPowerGasContracts(
    userId: string,
  ): Observable<GalpPowerGasContract[]> {
    return this.http.get<
      GalpPowerGasContract[]
    >(
      `${this.apiUrl}/api/contracts/galp-power-gas/followers/${userId}`,
    );
  }

  getGalpPowerGasContractById(
    contractId: string,
  ): Observable<GalpPowerGasContractDetail> {
    return this.http.get<
      GalpPowerGasContractDetail
    >(
      `${this.apiUrl}/api/contracts/galp-power-gas/${contractId}`,
    );
  }

  createGalpPowerGasContract(
    payload: CreateGalpPowerGasContractRequest,
  ): Observable<GalpPowerGasContractDetail> {
    return this.http.post<
      GalpPowerGasContractDetail
    >(
      `${this.apiUrl}/api/contracts/galp-power-gas`,
      payload,
    );
  }

  updateGalpPowerGasContract(
    contractId: string,
    payload:
      UpdateGalpPowerGasContractRequest,
  ): Observable<GalpPowerGasContractDetail> {
    return this.http.patch<
      GalpPowerGasContractDetail
    >(
      `${this.apiUrl}/api/contracts/galp-power-gas/${contractId}`,
      payload,
    );
  }

  deleteGalpPowerGasContract(contractId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/api/contracts/galp-power-gas/${contractId}`,
    );
  }

  uploadAttachments(
    contractId: string,
    files: File[],
  ): Observable<GalpPowerGasContractDetail> {
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
      GalpPowerGasContractDetail
    >(
      `${this.apiUrl}/api/contracts/galp-power-gas/${contractId}/attachments`,
      formData,
    );
  }

  deleteAttachment(
    contractId: string,
    fileName: string,
  ): Observable<GalpPowerGasContractDetail> {
    return this.http.delete<
      GalpPowerGasContractDetail
    >(
      `${this.apiUrl}/api/contracts/galp-power-gas/${contractId}/attachments/${encodeURIComponent(
        fileName,
      )}`,
    );
  }

  getById(id: string): Observable<GalpPowerGasContractDetail> {
    return this.getGalpPowerGasContractById(id);
  }

  create(payload: CreateGalpPowerGasContractRequest): Observable<GalpPowerGasContractDetail> {
    return this.createGalpPowerGasContract(payload);
  }

  update(id: string, payload: UpdateGalpPowerGasContractRequest): Observable<GalpPowerGasContractDetail> {
    return this.updateGalpPowerGasContract(id, payload);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.deleteGalpPowerGasContract(id);
  }

  uploadAttachment(id: string, file: File): Observable<GalpPowerGasContractDetail> {
    return this.uploadAttachments(id, [file]);
  }

  downloadAttachment(id: string, fileName: string): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/api/contracts/galp-power-gas/${id}/attachments/${encodeURIComponent(fileName)}/download`,
      { responseType: 'blob' },
    );
  }

  downloadDocument(
    contractId: string,
    document:
      GalpPowerGasContractDocument,
  ): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/api/contracts/galp-power-gas/${contractId}/attachments/${encodeURIComponent(
        document.fileName,
      )}/download`,
      {
        responseType: 'blob',
      },
    );
  }
}