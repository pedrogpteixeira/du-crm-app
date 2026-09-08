import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';

import { environment } from '../../../environments/environment';

export type TicketTipo =
  | 'Novo Pedido de Chamada'
  | 'Tratamento de Pendência'
  | 'Pedido de Anulação';

export type TicketEstado =
  | 'Novo'
  | 'Em Tratamento'
  | 'Concluído';

export type TicketPrioridade =
  | 'Baixo'
  | 'Normal'
  | 'Alto'
  | 'Urgente';

export interface TicketTeam {
  teamId: string;
  minimumPositionIndex: number;
}

export interface TicketTeamDetail extends TicketTeam {
  name: string | null;
  position: string | null;
}

export interface TicketFollower {
  id: string;
  name: string | null;
  username: string | null;
}

export interface TicketUserSummary {
  id: string;
  name: string | null;
  username: string | null;
}

export interface TicketDocument {
  fileName: string;
  originalName: string;
  mimetype: string | null;
  size: number | null;
  storageProvider: string | null;
}

export interface CreateTicketRequest {
  contractId: string;
  companyId: string;
  tipo: TicketTipo;
  estado?: TicketEstado;
  prioridade?: TicketPrioridade;
  agendamento?: string | null;
  descricao?: string;
  userId: string;
  teams: TicketTeam[];
}

export interface UpdateTicketRequest {
  tipo?: TicketTipo;
  estado?: TicketEstado;
  prioridade?: TicketPrioridade;
  agendamento?: string | null;
  descricao?: string;
  userId?: string;
  teams?: TicketTeam[];
}

export interface CreatedTicket {
  ticketId: string;
  estado: TicketEstado;
  tipo: TicketTipo;
  prioridade?: TicketPrioridade;
  agendamento?: string | null;
  descricao?: string | null;
  contractId?: string;
  companyId?: string;
  userId: string;
  userName?: string | null;
}

export interface TicketListItem {
  id: string;
  contractId: string;
  companyId: string;
  tipo: TicketTipo;
  estado: TicketEstado;
  prioridade: TicketPrioridade;
  agendamento: string | null;
  descricao: string;
  userId: string;
  userName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetail {
  id: string;
  contractId: string;
  companyId: string;
  tipo: TicketTipo;
  estado: TicketEstado;
  prioridade: TicketPrioridade;
  agendamento: string | null;
  descricao: string;
  anexos: TicketDocument[];
  userId: string;
  user: TicketUserSummary | null;
  teams: TicketTeamDetail[];
  followers: TicketFollower[];
  createdAt: string;
  updatedAt: string;
}

interface TicketApiUser {
  id?: string;
  _id?: string;
  userId?: string;
  name?: string | null;
  userName?: string | null;
  username?: string | null;
}

interface TicketApiTeam {
  id?: string;
  teamId?: string;
  name?: string | null;
  teamName?: string | null;
  position?: string | null;
  minimumPosition?: string | null;
  minimumPositionIndex?: number;
  positionIndex?: number;
  team?: {
    id?: string;
    name?: string | null;
  } | null;
}

interface TicketApiFollower extends TicketApiUser {}

interface TicketApiDocument {
  fileName?: string;
  filename?: string;
  originalName?: string;
  originalname?: string;
  mimetype?: string | null;
  size?: number | null;
  storageProvider?: string | null;
}

export interface TicketApiModel {
  id?: string;
  _id?: string;
  ticketId?: string;
  estado?: TicketEstado;
  tipo?: TicketTipo;
  prioridade?: TicketPrioridade;
  agendamento?: string | null;
  descricao?: string | null;
  contractId?: string;
  companyId?: string;
  userId?: string;
  userName?: string | null;
  user?: TicketApiUser | null;
  teams?: TicketApiTeam[];
  followers?: Array<TicketApiFollower | string>;
  anexos?: TicketApiDocument[];
  documentos?: TicketApiDocument[];
  createdAt?: string;
  updatedAt?: string;
}

interface TicketApiEnvelope {
  ticket?: TicketApiModel;
  data?: TicketApiModel;
}

interface TicketFollowerListDataEnvelope {
  tickets?: TicketApiModel[];
}

interface TicketFollowerListEnvelope {
  tickets?: TicketApiModel[];
  data?: TicketApiModel[] | TicketFollowerListDataEnvelope;
  results?: TicketApiModel[];
}

type TicketFollowerListResponse =
  | TicketApiModel[]
  | TicketFollowerListEnvelope;

export const TICKET_TYPE_OPTIONS: readonly TicketTipo[] = [
  'Novo Pedido de Chamada',
  'Tratamento de Pendência',
  'Pedido de Anulação',
];

export const TICKET_STATUS_OPTIONS: readonly TicketEstado[] = [
  'Novo',
  'Em Tratamento',
  'Concluído',
];

export const TICKET_PRIORITY_OPTIONS: readonly TicketPrioridade[] = [
  'Baixo',
  'Normal',
  'Alto',
  'Urgente',
];

@Injectable({
  providedIn: 'root',
})
export class TicketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/tickets`;

  createTicket(
    payload: CreateTicketRequest,
  ): Observable<CreatedTicket> {
    return this.http
      .post<TicketApiModel | TicketApiEnvelope>(
        this.baseUrl,
        payload,
      )
      .pipe(
        map((response) =>
          this.normalizeCreatedTicket(
            response,
            payload,
          ),
        ),
      );
  }

  getTicketsByFollower(userId: string): Observable<TicketListItem[]> {
    return this.http
      .get<TicketFollowerListResponse>(
        `${this.baseUrl}/followers/${encodeURIComponent(userId)}`,
      )
      .pipe(
        map((response) =>
          this.unwrapTicketList(response)
            .map((ticket) => this.normalizeTicketListItem(ticket))
            .filter((ticket): ticket is TicketListItem => ticket !== null),
        ),
      );
  }

  getTicketById(ticketId: string): Observable<TicketDetail> {
    return this.http
      .get<TicketApiModel | TicketApiEnvelope>(
        `${this.baseUrl}/${encodeURIComponent(ticketId)}`,
      )
      .pipe(
        map((response) =>
          this.normalizeTicketDetail(
            response,
            ticketId,
          ),
        ),
      );
  }

  updateTicket(
    ticketId: string,
    payload: UpdateTicketRequest,
  ): Observable<TicketDetail> {
    return this.http
      .patch<TicketApiModel | TicketApiEnvelope>(
        `${this.baseUrl}/${encodeURIComponent(ticketId)}`,
        payload,
      )
      .pipe(
        switchMap((response) =>
          this.isCompleteTicketResponse(response)
            ? of(this.normalizeTicketDetail(response, ticketId))
            : this.getTicketById(ticketId),
        ),
      );
  }

  uploadAttachments(
    ticketId: string,
    files: File[],
  ): Observable<TicketDetail> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file, file.name);
    });

    return this.http
      .post<TicketApiModel | TicketApiEnvelope>(
        `${this.baseUrl}/${encodeURIComponent(ticketId)}/attachments`,
        formData,
      )
      .pipe(
        switchMap((response) =>
          this.isCompleteTicketResponse(response)
            ? of(this.normalizeTicketDetail(response, ticketId))
            : this.getTicketById(ticketId),
        ),
      );
  }

  deleteAttachment(
    ticketId: string,
    fileName: string,
  ): Observable<TicketDetail> {
    return this.http
      .delete<TicketApiModel | TicketApiEnvelope>(
        `${this.baseUrl}/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(
          fileName,
        )}`,
      )
      .pipe(
        switchMap((response) =>
          this.isCompleteTicketResponse(response)
            ? of(this.normalizeTicketDetail(response, ticketId))
            : this.getTicketById(ticketId),
        ),
      );
  }

  downloadDocument(
    ticketId: string,
    fileName: string,
  ): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(
        fileName,
      )}/download`,
      {
        responseType: 'blob',
      },
    );
  }

  normalizeSocketTicket(
    payload: TicketApiModel | TicketApiEnvelope,
    ticketId: string,
  ): TicketDetail {
    return this.normalizeTicketDetail(payload, ticketId);
  }

  private isCompleteTicketResponse(
    response: TicketApiModel | TicketApiEnvelope,
  ): boolean {
    const ticket = this.unwrapTicket(response);
    const hasId = Boolean(ticket.id ?? ticket._id ?? ticket.ticketId);
    const hasUser = Boolean(
      ticket.userId ?? ticket.user?.id ?? ticket.user?._id ?? ticket.user?.userId,
    );

    return Boolean(
      hasId &&
        ticket.contractId &&
        ticket.companyId &&
        ticket.tipo &&
        ticket.estado &&
        ticket.prioridade &&
        hasUser &&
        Array.isArray(ticket.teams) &&
        Array.isArray(ticket.followers) &&
        Array.isArray(ticket.anexos ?? ticket.documentos),
    );
  }

  private unwrapTicketList(
    response: TicketFollowerListResponse,
  ): TicketApiModel[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response.tickets)) {
      return response.tickets;
    }

    if (Array.isArray(response.results)) {
      return response.results;
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }

    if (response.data && Array.isArray(response.data.tickets)) {
      return response.data.tickets;
    }

    return [];
  }

  private normalizeTicketListItem(
    ticket: TicketApiModel,
  ): TicketListItem | null {
    const id = ticket.id ?? ticket._id ?? ticket.ticketId ?? '';

    if (!id) {
      return null;
    }

    const userId =
      ticket.userId ??
      ticket.user?.id ??
      ticket.user?._id ??
      ticket.user?.userId ??
      '';

    return {
      id,
      contractId: ticket.contractId ?? '',
      companyId: ticket.companyId ?? '',
      tipo: ticket.tipo ?? 'Tratamento de Pendência',
      estado: ticket.estado ?? 'Novo',
      prioridade: ticket.prioridade ?? 'Normal',
      agendamento: ticket.agendamento ?? null,
      descricao: ticket.descricao ?? '',
      userId,
      userName:
        ticket.userName ??
        ticket.user?.name ??
        ticket.user?.userName ??
        null,
      createdAt: ticket.createdAt ?? '',
      updatedAt: ticket.updatedAt ?? '',
    };
  }

  private normalizeCreatedTicket(
    response: TicketApiModel | TicketApiEnvelope,
    payload: CreateTicketRequest,
  ): CreatedTicket {
    const ticket = this.unwrapTicket(response);
    const ticketId = ticket.ticketId ?? ticket.id ?? ticket._id;

    if (!ticketId) {
      throw new Error(
        'O Ticket foi criado, mas a API não devolveu o respetivo identificador.',
      );
    }

    return {
      ticketId,
      estado: ticket.estado ?? 'Novo',
      tipo: ticket.tipo ?? payload.tipo,
      prioridade: ticket.prioridade ?? payload.prioridade ?? 'Normal',
      agendamento: ticket.agendamento ?? payload.agendamento ?? null,
      descricao: ticket.descricao ?? payload.descricao ?? null,
      contractId: ticket.contractId ?? payload.contractId,
      companyId: ticket.companyId ?? payload.companyId,
      userId: ticket.userId ?? payload.userId,
      userName:
        ticket.userName ??
        ticket.user?.name ??
        ticket.user?.userName ??
        null,
    };
  }

  private normalizeTicketDetail(
    response: TicketApiModel | TicketApiEnvelope,
    fallbackTicketId: string,
  ): TicketDetail {
    const ticket = this.unwrapTicket(response);
    const id = ticket.id ?? ticket._id ?? ticket.ticketId ?? fallbackTicketId;

    if (!id) {
      throw new Error(
        'A API não devolveu um identificador válido para o Ticket.',
      );
    }

    const userId =
      ticket.userId ??
      ticket.user?.id ??
      ticket.user?._id ??
      ticket.user?.userId ??
      '';

    const userName =
      ticket.userName ??
      ticket.user?.name ??
      ticket.user?.userName ??
      null;

    const username = ticket.user?.username ?? null;

    return {
      id,
      contractId: ticket.contractId ?? '',
      companyId: ticket.companyId ?? '',
      tipo: ticket.tipo ?? 'Tratamento de Pendência',
      estado: ticket.estado ?? 'Novo',
      prioridade: ticket.prioridade ?? 'Normal',
      agendamento: ticket.agendamento ?? null,
      descricao: ticket.descricao ?? '',
      anexos: this.normalizeDocuments(
        ticket.anexos ?? ticket.documentos ?? [],
      ),
      userId,
      user: userId
        ? {
            id: userId,
            name: userName,
            username,
          }
        : null,
      teams: this.normalizeTeams(ticket.teams ?? []),
      followers: this.normalizeFollowers(ticket.followers ?? []),
      createdAt: ticket.createdAt ?? '',
      updatedAt: ticket.updatedAt ?? '',
    };
  }

  private normalizeTeams(teams: TicketApiTeam[]): TicketTeamDetail[] {
    return teams
      .map((team) => {
        const teamId = team.teamId ?? team.id ?? team.team?.id ?? '';
        const minimumPositionIndex =
          typeof team.minimumPositionIndex === 'number'
            ? team.minimumPositionIndex
            : typeof team.positionIndex === 'number'
              ? team.positionIndex
              : 0;

        return {
          teamId,
          minimumPositionIndex,
          name: team.name ?? team.teamName ?? team.team?.name ?? null,
          position: team.position ?? team.minimumPosition ?? null,
        };
      })
      .filter((team) => Boolean(team.teamId));
  }

  private normalizeFollowers(
    followers: Array<TicketApiFollower | string>,
  ): TicketFollower[] {
    return followers
      .map((follower) => {
        if (typeof follower === 'string') {
          return {
            id: follower,
            name: null,
            username: null,
          };
        }

        return {
          id:
            follower.id ??
            follower._id ??
            follower.userId ??
            '',
          name: follower.name ?? follower.userName ?? null,
          username: follower.username ?? null,
        };
      })
      .filter((follower) => Boolean(follower.id));
  }

  private normalizeDocuments(
    documents: TicketApiDocument[],
  ): TicketDocument[] {
    return documents
      .map((document) => {
        const fileName = document.fileName ?? document.filename ?? '';

        return {
          fileName,
          originalName:
            document.originalName ??
            document.originalname ??
            fileName,
          mimetype: document.mimetype ?? null,
          size:
            typeof document.size === 'number'
              ? document.size
              : null,
          storageProvider: document.storageProvider ?? null,
        };
      })
      .filter((document) => Boolean(document.fileName));
  }

  private unwrapTicket(
    response: TicketApiModel | TicketApiEnvelope,
  ): TicketApiModel {
    const envelope = response as TicketApiEnvelope;

    if (envelope.ticket || envelope.data) {
      return envelope.ticket ?? envelope.data ?? {};
    }

    return response as TicketApiModel;
  }
}
