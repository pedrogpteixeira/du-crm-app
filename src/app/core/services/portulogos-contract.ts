import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { ContractFlowEntry, ContractTicketSummary } from '../models/contract-activity';

import { environment } from '../../../environments/environment';

import {
  ContractKanbanQuery,
  ContractKanbanResponse,
  buildContractFiltersParams,
} from '../utils/contract-kanban';
export type PortulogosContractStatus =
  | 'Pedido de Chamada'
  | 'Em validação'
  | 'Chamada Efetuada'
  | 'Pendente Assinatura Digital'
  | 'Não Conformidade'
  | 'Pendente Docs'
  | 'Documentos Enviados'
  | 'Atribuído'
  | 'Acesso RPE'
  | 'Eswich'
  | 'Em curso'
  | 'Ativo'
  | 'Parcialmente Baixa'
  | 'Cancelado'
  | 'Baixa';

export const PORTULOGOS_CONTRACT_STATUSES: readonly PortulogosContractStatus[] = [
  'Pedido de Chamada',
  'Em validação',
  'Chamada Efetuada',
  'Pendente Assinatura Digital',
  'Não Conformidade',
  'Pendente Docs',
  'Documentos Enviados',
  'Atribuído',
  'Acesso RPE',
  'Eswich',
  'Em curso',
  'Ativo',
  'Parcialmente Baixa',
  'Cancelado',
  'Baixa',
];

export interface PortulogosContractListUser {
  id: string;
  name: string;
}

export interface PortulogosContract {
  id: string;

  nomeClienteEmpresa: string;
  nif: number;

  estado: PortulogosContractStatus;

  tipoSegmento?: string;
  tipoProduto?: string;

  user: PortulogosContractListUser | null;

  nomeRegistoCE?: string;

  observacoes?: string;
  observacoesInternas?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface PortulogosContractUser {
  id: string;
  name: string;
}

export interface PortulogosContractDocument {
  originalName: string;
  fileName: string;
  path: string;
  storageKey: string;
  storageProvider: string;
  mimetype: string;
  size: number;
  _id: string;
}

export interface PortulogosContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface PortulogosContractTeam {
  id: string;
  name: string;
  registrationNumber: number;
  minimumPositionIndex: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface PortulogosContractFollower {
  id: string;
  name: string;
}

export interface PortulogosContractCampaign {
  id: string | null;
  name: string;
}

export interface PortulogosContractDetail {
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

  estado: PortulogosContractStatus;

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

  campaign: PortulogosContractCampaign | null;
  antigaComercializadora: string;

  cpe: string;
  cui: string;
  potencia: string | number;
  escalao?: number;
  cicloHorario: string;
  nivelTensao: string;

  documentos: PortulogosContractDocument[];

  observacoes: string;
  observacoesInternas?: string;

  user: PortulogosContractUser | null;
  teams: PortulogosContractTeam[];
  followers: PortulogosContractFollower[];

  createdAt: string;
  updatedAt: string;

  fluxo?: ContractFlowEntry[];
  tickets?: ContractTicketSummary[];
}

export interface CreatePortulogosContractRequest {
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

  estado?: PortulogosContractStatus;

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
  teams?: PortulogosContractTeamVisibility[];
}

export type UpdatePortulogosContractRequest = Partial<
  Omit<
    CreatePortulogosContractRequest,
    'clientId' | 'companyId' | 'userId' | 'teams' | 'nif' | 'telefone' | 'potencia' | 'escalao'
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

export type PortulogosContractList = Omit<PortulogosContract, 'observacoes' | 'observacoesInternas'> & {
  userId?: string;
  campanha?: string;
} & Partial<
    Omit<
      PortulogosContractDetail,
      | keyof Omit<PortulogosContract, 'observacoes' | 'observacoesInternas'>
      | 'documentos'
      | 'observacoes'
      | 'observacoesInternas'
      | 'fluxo'
      | 'tickets'
      | 'moradaInstalacao'
      | 'moradaFaturacao'
      | 'followers'
    >
  >;

@Injectable({
  providedIn: 'root',
})
export class PortulogosContractService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = environment.apiUrl;

  getPortulogosContracts(
    userId: string,
    query: ContractKanbanQuery = {},
  ): Observable<ContractKanbanResponse<PortulogosContractList>> {
    const params = buildContractFiltersParams(query.filters, query.offset ?? 5, query.estado);

    return this.http.get<ContractKanbanResponse<PortulogosContractList>>(
      `${this.apiUrl}/api/contracts/portulogos/followers/${userId}`,
      { params },
    );
  }

  getPortulogosContractById(contractId: string): Observable<PortulogosContractDetail> {
    return this.http.get<PortulogosContractDetail>(`${this.apiUrl}/api/contracts/portulogos/${contractId}`);
  }

  createPortulogosContract(payload: CreatePortulogosContractRequest): Observable<PortulogosContractDetail> {
    return this.http.post<PortulogosContractDetail>(`${this.apiUrl}/api/contracts/portulogos`, payload);
  }

  updatePortulogosContract(
    contractId: string,
    payload: UpdatePortulogosContractRequest,
  ): Observable<PortulogosContractDetail> {
    return this.http.patch<PortulogosContractDetail>(
      `${this.apiUrl}/api/contracts/portulogos/${contractId}`,
      payload,
    );
  }

  uploadAttachments(contractId: string, files: File[]): Observable<PortulogosContractDetail> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file, file.name);
    });

    return this.http.post<PortulogosContractDetail>(
      `${this.apiUrl}/api/contracts/portulogos/${contractId}/attachments`,
      formData,
    );
  }

  deleteAttachment(contractId: string, fileName: string): Observable<PortulogosContractDetail> {
    return this.http.delete<PortulogosContractDetail>(
      `${this.apiUrl}/api/contracts/portulogos/${contractId}/attachments/${encodeURIComponent(
        fileName,
      )}`,
    );
  }

  downloadDocument(contractId: string, document: PortulogosContractDocument): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/api/contracts/portulogos/${contractId}/attachments/${encodeURIComponent(
        document.fileName,
      )}/download`,
      {
        responseType: 'blob',
      },
    );
  }
}
