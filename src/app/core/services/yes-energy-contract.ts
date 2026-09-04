import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export const YES_ENERGY_COMPANY_ID =
  'cmp_1GdwakqCnA' as const;

export type YesEnergyTipoSegmento =
  | 'Residencial'
  | 'Empresarial'
  | 'Condomínios';

export type YesEnergyTipoProduto =
  | 'Luz'
  | 'Luz + Gás'
  | 'Gás';

export type YesEnergyContratacao =
  | 'Contratação Digital'
  | 'Contratação Papel';

export type YesEnergyTipoContratacao =
  | 'Mudança de Comercializadora'
  | 'Mudança de Comercializadora & AT'
  | 'Entrada Direta';

export type YesEnergyContractStatus =
  | 'Pedido de Contratação'
  | 'Pendente Assinatura Digital'
  | 'Pendente (ATR)'
  | 'Não Conformidade'
  | 'Desistência/Recuperar'
  | 'Em Ativação'
  | 'Ativo'
  | 'Parcialmente Baixa'
  | 'Baixa'
  | 'Anulado';

export const YES_ENERGY_CONTRACT_STATUSES:
  readonly YesEnergyContractStatus[] = [
    'Pedido de Contratação',
    'Pendente Assinatura Digital',
    'Pendente (ATR)',
    'Não Conformidade',
    'Desistência/Recuperar',
    'Em Ativação',
    'Ativo',
    'Parcialmente Baixa',
    'Baixa',
    'Anulado',
  ];

export type YesEnergyCicloHorario =
  | 'Simples'
  | 'Bi-Horário Diário'
  | 'Bi-Horário Semanal'
  | 'Tri-Horário Diário'
  | 'Tri-Horário Semanal'
  | 'Tetra-Horário';

export type YesEnergyNivelTensao =
  | 'Monofásico'
  | 'Trifásico';

export const YES_ENERGY_POWER_SUGGESTIONS =
  [
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

export const YES_ENERGY_GAS_LEVEL_SUGGESTIONS =
  ['1', '2', '3', '4'] as const;

export interface YesEnergyContractListUser {
  id: string;
  name: string;
}

export interface YesEnergyContract {
  id: string;

  nomeClienteEmpresa: string;
  nif: number;

  estado: YesEnergyContractStatus;

  tipoSegmento?: YesEnergyTipoSegmento;
  tipoProduto?: YesEnergyTipoProduto;

  nomeRegistoCE?: string;

  user: YesEnergyContractListUser | null;

  observacoes?: string;
  observacoesInternas?: string;
}

export interface YesEnergyContractUser {
  id: string;
  name: string;
}

export interface YesEnergyContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface YesEnergyContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface YesEnergyContractTeam {
  id: string;
  name: string;
  registrationNumber: number | null;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface YesEnergyContractFollower {
  id: string;
  name: string;
}

export interface YesEnergyContractCampaign {
  id: string | null;
  name: string;
}

export interface YesEnergyContractDetail {
  id: string;
  companyId: string;
  clientId: string;

  tipoSegmento: YesEnergyTipoSegmento;
  tipoProduto: YesEnergyTipoProduto;
  contratacao: YesEnergyContratacao;

  tipoContratacaoLuz?: YesEnergyTipoContratacao;
  tipoContratacaoGas?: YesEnergyTipoContratacao;

  /*
   * O frontend Repsol atual trata este campo como texto.
   * Mantemos string e não criamos enum artificial.
   */
  controleQualidade?: string;

  nomeRegistoCE?: string;
  codigoRegistoCE?: string;

  estado: YesEnergyContractStatus;

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
  cartaoCidadao?: string;
  telefone: number;
  email?: string;
  cae?: string;
  crc?: string;

  moradaInstalacao?: string;
  moradaFaturacao?: string;

  faturaEletronica: boolean;
  debitoDireto: boolean;
  sva: boolean;
  iban?: string;

  campaign: YesEnergyContractCampaign | null;

  antigaComercializadora?: string;

  cpe?: string;
  cui?: string;

  potencia?: string;
  escalao?: string;

  cicloHorario?: YesEnergyCicloHorario;
  nivelTensao?: YesEnergyNivelTensao;

  documentos: YesEnergyContractDocument[];

  observacoes?: string;
  observacoesInternas?: string;

  user: YesEnergyContractUser | null;
  teams: YesEnergyContractTeam[];
  followers: YesEnergyContractFollower[];

  createdAt: string;
  updatedAt: string;
}

export interface CreateYesEnergyContractRequest {
  companyId: typeof YES_ENERGY_COMPANY_ID;
  clientId: string;

  tipoSegmento: YesEnergyTipoSegmento;
  tipoProduto: YesEnergyTipoProduto;
  contratacao: YesEnergyContratacao;

  tipoContratacaoLuz?: YesEnergyTipoContratacao;
  tipoContratacaoGas?: YesEnergyTipoContratacao;

  controleQualidade?: string;

  nomeRegistoCE?: string;
  codigoRegistoCE?: string;

  estado?: YesEnergyContractStatus;

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
  cartaoCidadao?: string;
  telefone: number;
  email?: string;
  cae?: string;
  crc?: string;

  moradaInstalacao?: string;
  moradaFaturacao?: string;

  faturaEletronica?: boolean;
  debitoDireto?: boolean;
  sva?: boolean;
  iban?: string;

  campanha: string;

  antigaComercializadora?: string;

  cpe?: string;
  cui?: string;

  potencia?: string;
  escalao?: string;

  cicloHorario?: YesEnergyCicloHorario;
  nivelTensao?: YesEnergyNivelTensao;

  observacoes?: string;
  observacoesInternas?: string;

  userId: string;

  teams?: YesEnergyContractTeamVisibility[];
}

export type UpdateYesEnergyContractRequest =
  Partial<
    Omit<
      CreateYesEnergyContractRequest,
      | 'companyId'
      | 'clientId'
      | 'userId'
      | 'teams'
    >
  > & {
    nif?: number | null;
    telefone?: number | null;

    observacoes?: string;
    observacoesInternas?: string;
  };

@Injectable({
  providedIn: 'root',
})
export class YesEnergyContractService {
  private readonly http =
    inject(HttpClient);

  private readonly apiUrl =
    environment.apiUrl;

  getYesEnergyContracts(
    userId: string,
  ): Observable<YesEnergyContract[]> {
    return this.http.get<
      YesEnergyContract[]
    >(
      `${this.apiUrl}/api/contracts/yes-energy/followers/${userId}`,
    );
  }

  getYesEnergyContractById(
    contractId: string,
  ): Observable<YesEnergyContractDetail> {
    return this.http.get<
      YesEnergyContractDetail
    >(
      `${this.apiUrl}/api/contracts/yes-energy/${contractId}`,
    );
  }

  createYesEnergyContract(
    payload:
      CreateYesEnergyContractRequest,
  ): Observable<YesEnergyContractDetail> {
    return this.http.post<
      YesEnergyContractDetail
    >(
      `${this.apiUrl}/api/contracts/yes-energy`,
      payload,
    );
  }

  updateYesEnergyContract(
    contractId: string,
    payload:
      UpdateYesEnergyContractRequest,
  ): Observable<YesEnergyContractDetail> {
    return this.http.patch<
      YesEnergyContractDetail
    >(
      `${this.apiUrl}/api/contracts/yes-energy/${contractId}`,
      payload,
    );
  }

  uploadAttachments(
    contractId: string,
    files: File[],
  ): Observable<YesEnergyContractDetail> {
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
      YesEnergyContractDetail
    >(
      `${this.apiUrl}/api/contracts/yes-energy/${contractId}/attachments`,
      formData,
    );
  }

  deleteAttachment(
    contractId: string,
    fileName: string,
  ): Observable<YesEnergyContractDetail> {
    return this.http.delete<
      YesEnergyContractDetail
    >(
      `${this.apiUrl}/api/contracts/yes-energy/${contractId}/attachments/${encodeURIComponent(
        fileName,
      )}`,
    );
  }

  downloadDocument(
    contractId: string,
    document:
      YesEnergyContractDocument,
  ): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/api/contracts/yes-energy/${contractId}/attachments/${encodeURIComponent(
        document.fileName,
      )}/download`,
      {
        responseType: 'blob',
      },
    );
  }
}
