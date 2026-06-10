import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment.development';

export type RepsolContractStatus =
  | 'Pedido de Chamada'
  | 'Em validação'
  | 'Chamada Efetuada'
  | 'Pendente Assinatura Digital'
  | 'Não Conformidade'
  | 'Pendente Docs'
  | 'Documentos Enviados'
  | 'Atribuído';

export interface RepsolContract {
  id: string;
  clientId: string;
  nomeClienteEmpresa: string;
  nif: number;
  estado: RepsolContractStatus;
  cpe: string;
  cui: string;
  nomeRegistoCE: string;
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

export interface RepsolContractTeam {
  id: string;
  name: string;
}

export interface RepsolContractFollower {
  id: string;
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

  campanha: string;
  antigaComercializadora: string;

  cpe: string;
  cui: string;
  potencia: string;
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

@Injectable({
  providedIn: 'root',
})
export class RepsolContractService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getRepsolContracts(): Observable<RepsolContract[]> {
    return this.http.get<RepsolContract[]>(
      `${this.apiUrl}/api/contracts/repsol`,
    );
  }

  getRepsolContractById(contractId: string): Observable<RepsolContractDetail> {
    return this.http.get<RepsolContractDetail>(
      `${this.apiUrl}/api/contracts/repsol/${contractId}`,
    );
  }

  downloadDocument(
    contractId: string,
    document: RepsolContractDocument,
  ): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/api/contracts/repsol/${contractId}/attachments/${document.fileName}/download`,
      {
        responseType: 'blob',
      },
    );
  }
}