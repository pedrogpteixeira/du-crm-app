import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type GalpSolarContractStatus =
  | 'Pedido de Proposta'
  | 'Proposta enviada'
  | 'Envio Quality Check'
  | 'Pendente Docs'
  | 'Documentos enviados'
  | 'Em instalação'
  | 'Ativo'
  | 'Cancelado';

export const GALP_SOLAR_STATUSES: GalpSolarContractStatus[] = [
  'Pedido de Proposta',
  'Proposta enviada',
  'Envio Quality Check',
  'Pendente Docs',
  'Documentos enviados',
  'Em instalação',
  'Ativo',
  'Cancelado',
];

export const GALP_SOLAR_PANEL_SUGGESTIONS = [
  'Special - 380W',
  'Premium - 355W',
  'Start - 415W',
  'Advanced - 405W',
  'Painéis 480WP',
  'Painéis 485WP',
  'Painéis 540WP',
] as const;

export const GALP_SOLAR_PAYMENT_METHOD_SUGGESTIONS = [
  'Pronto Pagamento',
  '48 meses',
  '60 meses',
] as const;

export interface GalpSolarContractListUser {
  id: string;
  name: string;
}

export interface GalpSolarContractDocument {
  originalName: string;
  fileName: string;
  path?: string;
  storageKey?: string;
  storageProvider?: string;
  mimetype?: string;
  size?: number;
  _id?: string;
}

export interface GalpSolarContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

export interface GalpSolarContractTeam {
  id: string;
  name: string;
  registrationNumber?: number | null;
  minimumPositionIndex?: number;
  minimumPosition?: string;
  teamId?: string;
}

export interface GalpSolarContractFollower {
  id: string;
  name: string;
}

export interface GalpSolarContract {
  id: string;
  companyId: string;
  clientId: string;
  contratacao?: string;
  tipoSegmento?: string;
  tipoProduto?: string;
  controleQualidade?: string;
  codigoRegistoCE?: string;
  nomeRegistoCE?: string;
  estado: GalpSolarContractStatus;
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
  documentos?: GalpSolarContractDocument[];
  observacoes?: string;
  observacoesInternas?: string;
  userId?: string;
  user?: GalpSolarContractListUser | null;
  teams?: GalpSolarContractTeam[];
  followers?: GalpSolarContractFollower[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateGalpSolarContractRequest {
  companyId: string;
  clientId: string;
  userId: string;
  teams?: GalpSolarContractTeamVisibility[];
  contratacao?: string;
  tipoSegmento?: string;
  tipoProduto?: string;
  controleQualidade?: string;
  codigoRegistoCE?: string;
  nomeRegistoCE?: string;
  estado?: GalpSolarContractStatus;
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

export type UpdateGalpSolarContractRequest = Partial<
  Omit<CreateGalpSolarContractRequest, 'companyId' | 'clientId' | 'userId' | 'teams'>
>;

@Injectable({ providedIn: 'root' })
export class GalpSolarContractService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/contracts/galp-solar`;

  getAll(): Observable<GalpSolarContract[]> {
    return this.http.get<GalpSolarContract[]>(this.baseUrl);
  }

  getById(id: string): Observable<GalpSolarContract> {
    return this.http.get<GalpSolarContract>(`${this.baseUrl}/${id}`);
  }

  getByCompanyId(companyId: string): Observable<GalpSolarContract[]> {
    return this.http.get<GalpSolarContract[]>(`${this.baseUrl}/company/${companyId}`);
  }

  getByUserId(userId: string): Observable<GalpSolarContract[]> {
    return this.http.get<GalpSolarContract[]>(`${this.baseUrl}/user/${userId}`);
  }

  getByFollowerId(userId: string): Observable<GalpSolarContract[]> {
    return this.http.get<GalpSolarContract[]>(`${this.baseUrl}/followers/${userId}`);
  }

  create(payload: CreateGalpSolarContractRequest): Observable<GalpSolarContract> {
    return this.http.post<GalpSolarContract>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateGalpSolarContractRequest): Observable<GalpSolarContract> {
    return this.http.patch<GalpSolarContract>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  uploadAttachment(id: string, file: File): Observable<GalpSolarContract> {
    return this.uploadAttachments(id, [file]);
  }

  uploadAttachments(id: string, files: File[]): Observable<GalpSolarContract> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));
    return this.http.post<GalpSolarContract>(`${this.baseUrl}/${id}/attachments`, formData);
  }

  deleteAttachment(id: string, fileName: string): Observable<GalpSolarContract> {
    return this.http.delete<GalpSolarContract>(
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
