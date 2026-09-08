import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { ContractFlowEntry, ContractTicketSummary } from '../models/contract-activity';

import { environment } from '../../../environments/environment';

export const IBERDROLA_COMPANY_ID =
  'cmp_JHtuvY63fm' as const;

export type IberdrolaTipoSegmento =
  | 'Residencial'
  | 'Empresarial'
  | 'Condomínios';

export type IberdrolaTipoProduto =
  | 'Luz'
  | 'Luz + Gás'
  | 'Gás';

export type IberdrolaContratacao =
  | 'Contratação Digital'
  | 'Contratação Papel';

export type IberdrolaTipoContratacao =
  | 'Mudança de Comercializadora'
  | 'Mudança de Comercializadora & AT'
  | 'Entrada Direta';

export type IberdrolaContractStatus =
  | 'Pedido de Contratação'
  | 'Pedido de Simulação'
  | 'Pendente Validação Comercial'
  | 'Pedido SMS (RGPD)'
  | 'Pedido VTV'
  | 'Pendente SMS "Cond Contratuais"'
  | 'Não Conformidade'
  | 'BackOffice'
  | 'Controle'
  | 'Pedido de Fornecimento'
  | 'Em fornecimento'
  | 'Ativo'
  | 'Parcialmente Baixa'
  | 'Cancelada'
  | 'Baixa';

export const IBERDROLA_CONTRACT_STATUSES:
  readonly IberdrolaContractStatus[] = [
    'Pedido de Contratação',
    'Pedido de Simulação',
    'Pendente Validação Comercial',
    'Pedido SMS (RGPD)',
    'Pedido VTV',
    'Pendente SMS "Cond Contratuais"',
    'Não Conformidade',
    'BackOffice',
    'Controle',
    'Pedido de Fornecimento',
    'Em fornecimento',
    'Ativo',
    'Parcialmente Baixa',
    'Cancelada',
    'Baixa',
  ];

export type IberdrolaCicloHorario =
  | 'Simples'
  | 'Bi-Horário Diário'
  | 'Bi-Horário Semanal'
  | 'Tri-Horário Diário'
  | 'Tri-Horário Semanal'
  | 'Tetra-Horário';

export type IberdrolaNivelTensao =
  | 'Monofásico'
  | 'Trifásico';

export const IBERDROLA_POWER_SUGGESTIONS = [
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

export const IBERDROLA_GAS_LEVEL_SUGGESTIONS =
  ['1', '2', '3', '4'] as const;

export interface IberdrolaContractListUser {
  id: string;
  name: string;
}

export interface IberdrolaContract {
  id: string;
  idVenda?: string;
  nomeClienteEmpresa: string;
  nif: number;
  estado: IberdrolaContractStatus;
  tipoSegmento?: IberdrolaTipoSegmento;
  tipoProduto?: IberdrolaTipoProduto;
  nomeRegistoCE?: string;
  user: IberdrolaContractListUser | null;
  observacoes?: string;
  observacoesInternas?: string;
}

export interface IberdrolaContractUser {
  id: string;
  name: string;
}

export interface IberdrolaContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface IberdrolaContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface IberdrolaContractTeam {
  id: string;
  name: string;
  registrationNumber: number | null;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface IberdrolaContractFollower {
  id: string;
  name: string;
}

export interface IberdrolaContractCampaign {
  id: string | null;
  name: string;
}

export interface IberdrolaContractDetail {
  id: string;
  companyId: string;
  clientId: string;
  idVenda?: string;

  tipoSegmento: IberdrolaTipoSegmento;
  tipoProduto: IberdrolaTipoProduto;
  contratacao: IberdrolaContratacao;
  tipoContratacaoLuz?: IberdrolaTipoContratacao;
  tipoContratacaoGas?: IberdrolaTipoContratacao;

  /*
   * O módulo Yes Energy atual trata controleQualidade como texto livre.
   * Sem um DTO Iberdrola disponível no frontend, mantemos a mesma tipagem.
   */
  controleQualidade?: string;
  nomeRegistoCE?: string;
  codigoRegistoCE?: string;
  estado: IberdrolaContractStatus;

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

  campaign: IberdrolaContractCampaign | null;
  antigaComercializadora?: string;
  cpe?: string;
  cui?: string;
  potencia?: string;
  escalao?: string;
  cicloHorario?: IberdrolaCicloHorario;
  nivelTensao?: IberdrolaNivelTensao;

  documentos: IberdrolaContractDocument[];
  observacoes?: string;
  observacoesInternas?: string;

  user: IberdrolaContractUser | null;
  teams: IberdrolaContractTeam[];
  followers: IberdrolaContractFollower[];
  createdAt: string;
  updatedAt: string;

  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
}

export interface CreateIberdrolaContractRequest {
  companyId: typeof IBERDROLA_COMPANY_ID;
  clientId: string;
  idVenda?: string;

  tipoSegmento: IberdrolaTipoSegmento;
  tipoProduto: IberdrolaTipoProduto;
  contratacao: IberdrolaContratacao;
  tipoContratacaoLuz?: IberdrolaTipoContratacao;
  tipoContratacaoGas?: IberdrolaTipoContratacao;

  controleQualidade?: string;
  nomeRegistoCE?: string;
  codigoRegistoCE?: string;
  estado?: IberdrolaContractStatus;

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
  cicloHorario?: IberdrolaCicloHorario;
  nivelTensao?: IberdrolaNivelTensao;

  observacoes?: string;
  observacoesInternas?: string;
  userId: string;
  teams?: IberdrolaContractTeamVisibility[];
}

export type UpdateIberdrolaContractRequest =
  Partial<
    Omit<
      CreateIberdrolaContractRequest,
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
export class IberdrolaContractService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getIberdrolaContracts(
    userId: string,
  ): Observable<IberdrolaContract[]> {
    return this.http.get<IberdrolaContract[]>(
      `${this.apiUrl}/api/contracts/iberdrola/followers/${userId}`,
    );
  }

  getIberdrolaContractById(
    contractId: string,
  ): Observable<IberdrolaContractDetail> {
    return this.http.get<IberdrolaContractDetail>(
      `${this.apiUrl}/api/contracts/iberdrola/${contractId}`,
    );
  }

  createIberdrolaContract(
    payload: CreateIberdrolaContractRequest,
  ): Observable<IberdrolaContractDetail> {
    return this.http.post<IberdrolaContractDetail>(
      `${this.apiUrl}/api/contracts/iberdrola`,
      payload,
    );
  }

  updateIberdrolaContract(
    contractId: string,
    payload: UpdateIberdrolaContractRequest,
  ): Observable<IberdrolaContractDetail> {
    return this.http.patch<IberdrolaContractDetail>(
      `${this.apiUrl}/api/contracts/iberdrola/${contractId}`,
      payload,
    );
  }

  uploadAttachments(
    contractId: string,
    files: File[],
  ): Observable<IberdrolaContractDetail> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file, file.name);
    });

    return this.http.post<IberdrolaContractDetail>(
      `${this.apiUrl}/api/contracts/iberdrola/${contractId}/attachments`,
      formData,
    );
  }

  deleteAttachment(
    contractId: string,
    fileName: string,
  ): Observable<IberdrolaContractDetail> {
    return this.http.delete<IberdrolaContractDetail>(
      `${this.apiUrl}/api/contracts/iberdrola/${contractId}/attachments/${encodeURIComponent(
        fileName,
      )}`,
    );
  }

  downloadDocument(
    contractId: string,
    document: IberdrolaContractDocument,
  ): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/api/contracts/iberdrola/${contractId}/attachments/${encodeURIComponent(
        document.fileName,
      )}/download`,
      { responseType: 'blob' },
    );
  }
}
