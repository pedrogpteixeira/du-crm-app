import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { ContractFlowEntry, ContractTicketSummary } from '../models/contract-activity';

import { environment } from '../../../environments/environment';

export const MEO_ENERGIAS_COMPANY_ID =
  'cmp_KCnjrA0i-U' as const;

export type MeoEnergiasTipoSegmento =
  | 'Residencial'
  | 'Empresarial';

export type MeoEnergiasTipoProduto =
  | 'Luz'
  | 'Luz + Gás'
  | 'Gás';

export type MeoEnergiasContratacao =
  | 'Contratação Digital'
  | 'Contratação Papel';

export type MeoEnergiasTipoContratacao =
  | 'Mudança de Comercializadora'
  | 'Mudança de Comercializadora & AT'
  | 'Entrada Direta';

export type MeoEnergiasContractStatus =
  | 'Pedido de Chamada'
  | 'Em validação'
  | 'Não Conformidade'
  | 'Docs Enviados'
  | 'Registo MEO'
  | 'Anulado'
  | 'Ativo'
  | 'Baixa';

export const MEO_ENERGIAS_CONTRACT_STATUSES:
  readonly MeoEnergiasContractStatus[] = [
    'Pedido de Chamada',
    'Em validação',
    'Não Conformidade',
    'Docs Enviados',
    'Registo MEO',
    'Anulado',
    'Ativo',
    'Baixa',
  ];

export type MeoEnergiasCicloHorario =
  | 'Simples'
  | 'Bi-Horário Diário'
  | 'Bi-Horário Semanal'
  | 'Tri-Horário Diário'
  | 'Tri-Horário Semanal'
  | 'Tetra-Horário';

export type MeoEnergiasNivelTensao =
  | 'Monofásico'
  | 'Trifásico';

export const MEO_ENERGIAS_POWER_SUGGESTIONS = [
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

export const MEO_ENERGIAS_GAS_LEVEL_SUGGESTIONS =
  ['1', '2', '3', '4'] as const;

export interface MeoEnergiasContractListUser {
  id: string;
  name: string;
}

export interface MeoEnergiasContract {
  id: string;
  nomeClienteEmpresa: string;
  nif: number;
  estado: MeoEnergiasContractStatus;
  tipoSegmento?: MeoEnergiasTipoSegmento;
  tipoProduto?: MeoEnergiasTipoProduto;
  nomeRegistoCE?: string;
  user: MeoEnergiasContractListUser | null;
  observacoes?: string;
  observacoesInternas?: string;
}

export interface MeoEnergiasContractUser {
  id: string;
  name: string;
}

export interface MeoEnergiasContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface MeoEnergiasContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface MeoEnergiasContractTeam {
  id: string;
  name: string;
  registrationNumber: number | null;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface MeoEnergiasContractFollower {
  id: string;
  name: string;
}

export interface MeoEnergiasContractCampaign {
  id: string | null;
  name: string;
}

export interface MeoEnergiasContractDetail {
  id: string;
  companyId: string;
  clientId: string;

  tipoSegmento: MeoEnergiasTipoSegmento;
  tipoProduto: MeoEnergiasTipoProduto;
  contratacao: MeoEnergiasContratacao;
  tipoContratacaoLuz?: MeoEnergiasTipoContratacao;
  tipoContratacaoGas?: MeoEnergiasTipoContratacao;

  /*
   * Os módulos atuais de contratos de energia tratam controleQualidade como texto livre.
   * Mantemos string e não criamos enum artificial.
   */
  controleQualidade?: string;
  nomeRegistoCE?: string;
  codigoRegistoCE?: string;
  estado: MeoEnergiasContractStatus;

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
  email?: string;
  cae?: string;
  crc?: string;

  moradaInstalacao?: string;
  moradaFaturacao?: string;

  faturaEletronica: boolean;
  debitoDireto: boolean;
  tarifaSocial: boolean;
  iban?: string;

  campaign: MeoEnergiasContractCampaign | null;
  antigaComercializadora?: string;
  cpe?: string;
  cui?: string;
  potencia?: string;
  escalao?: string;
  cicloHorario?: MeoEnergiasCicloHorario;
  nivelTensao?: MeoEnergiasNivelTensao;

  documentos: MeoEnergiasContractDocument[];
  observacoes?: string;
  observacoesInternas?: string;

  user: MeoEnergiasContractUser | null;
  teams: MeoEnergiasContractTeam[];
  followers: MeoEnergiasContractFollower[];
  createdAt: string;
  updatedAt: string;

  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
}

export interface CreateMeoEnergiasContractRequest {
  companyId: typeof MEO_ENERGIAS_COMPANY_ID;
  clientId: string;

  tipoSegmento: MeoEnergiasTipoSegmento;
  tipoProduto: MeoEnergiasTipoProduto;
  contratacao: MeoEnergiasContratacao;
  tipoContratacaoLuz?: MeoEnergiasTipoContratacao;
  tipoContratacaoGas?: MeoEnergiasTipoContratacao;

  controleQualidade?: string;
  nomeRegistoCE?: string;
  codigoRegistoCE?: string;
  estado?: MeoEnergiasContractStatus;

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
  email?: string;
  cae?: string;
  crc?: string;

  moradaInstalacao?: string;
  moradaFaturacao?: string;

  faturaEletronica?: boolean;
  debitoDireto?: boolean;
  tarifaSocial?: boolean;
  iban?: string;

  campanha: string;
  antigaComercializadora?: string;
  cpe?: string;
  cui?: string;
  potencia?: string;
  escalao?: string;
  cicloHorario?: MeoEnergiasCicloHorario;
  nivelTensao?: MeoEnergiasNivelTensao;

  observacoes?: string;
  observacoesInternas?: string;
  userId: string;
  teams?: MeoEnergiasContractTeamVisibility[];
}

export type UpdateMeoEnergiasContractRequest =
  Partial<
    Omit<
      CreateMeoEnergiasContractRequest,
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
export class MeoEnergiasContractService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getMeoEnergiasContracts(
    userId: string,
  ): Observable<MeoEnergiasContract[]> {
    return this.http.get<MeoEnergiasContract[]>(
      `${this.apiUrl}/api/contracts/meo-energias/followers/${userId}`,
    );
  }

  getMeoEnergiasContractById(
    contractId: string,
  ): Observable<MeoEnergiasContractDetail> {
    return this.http.get<MeoEnergiasContractDetail>(
      `${this.apiUrl}/api/contracts/meo-energias/${contractId}`,
    );
  }

  createMeoEnergiasContract(
    payload: CreateMeoEnergiasContractRequest,
  ): Observable<MeoEnergiasContractDetail> {
    return this.http.post<MeoEnergiasContractDetail>(
      `${this.apiUrl}/api/contracts/meo-energias`,
      payload,
    );
  }

  updateMeoEnergiasContract(
    contractId: string,
    payload: UpdateMeoEnergiasContractRequest,
  ): Observable<MeoEnergiasContractDetail> {
    return this.http.patch<MeoEnergiasContractDetail>(
      `${this.apiUrl}/api/contracts/meo-energias/${contractId}`,
      payload,
    );
  }

  uploadAttachments(
    contractId: string,
    files: File[],
  ): Observable<MeoEnergiasContractDetail> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file, file.name);
    });

    return this.http.post<MeoEnergiasContractDetail>(
      `${this.apiUrl}/api/contracts/meo-energias/${contractId}/attachments`,
      formData,
    );
  }

  deleteAttachment(
    contractId: string,
    fileName: string,
  ): Observable<MeoEnergiasContractDetail> {
    return this.http.delete<MeoEnergiasContractDetail>(
      `${this.apiUrl}/api/contracts/meo-energias/${contractId}/attachments/${encodeURIComponent(
        fileName,
      )}`,
    );
  }

  downloadDocument(
    contractId: string,
    document: MeoEnergiasContractDocument,
  ): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/api/contracts/meo-energias/${contractId}/attachments/${encodeURIComponent(
        document.fileName,
      )}/download`,
      { responseType: 'blob' },
    );
  }
}
