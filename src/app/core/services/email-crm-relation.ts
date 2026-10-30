import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ClientContractProvider } from './client';
import {
  CreateEmailCrmRelationPayload,
  EmailContractSearchResult,
  EmailCrmRelation,
  EmailRelationEntityType,
  EmailTicketSearchResult,
  RelatedEmailMessage,
  RelatedEmailPage,
} from '../models/email-relation.model';
import type { EmailAddress } from '../models/email.model';

type UnknownRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class EmailCrmRelationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/email-crm-relations`;

  getMessageRelations(accountId: string, messageId: string): Observable<EmailCrmRelation[]> {
    return this.http
      .get<unknown>(
        `${this.baseUrl}/message/${encodeURIComponent(accountId)}/${encodeURIComponent(messageId)}`,
      )
      .pipe(map((response) => this.normalizeRelationList(response)));
  }

  createRelation(payload: CreateEmailCrmRelationPayload): Observable<EmailCrmRelation> {
    return this.http
      .post<unknown>(this.baseUrl, payload)
      .pipe(
        map((response) =>
          this.normalizeRelation(this.extractSingleRecord(response, ['relation', 'data'])),
        ),
      );
  }

  deleteRelation(relationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(relationId)}`);
  }

  searchContracts(
    query: string,
    provider?: ClientContractProvider,
    limit = 20,
  ): Observable<EmailContractSearchResult[]> {
    const safeLimit = Math.min(100, Math.max(1, limit));
    let params = new HttpParams().set('q', query.trim()).set('limit', String(safeLimit));
    if (provider) params = params.set('provider', provider);

    return this.http.get<unknown>(`${this.baseUrl}/search/contracts`, { params }).pipe(
      map((response) =>
        this.extractArray(response, ['items', 'results', 'data'])
          .map((record) => this.normalizeContractSearch(record))
          .filter((item): item is EmailContractSearchResult => item !== null),
      ),
    );
  }

  searchTickets(query: string, limit = 20): Observable<EmailTicketSearchResult[]> {
    const safeLimit = Math.min(100, Math.max(1, limit));
    const params = new HttpParams().set('q', query.trim()).set('limit', String(safeLimit));
    return this.http.get<unknown>(`${this.baseUrl}/search/tickets`, { params }).pipe(
      map((response) =>
        this.extractArray(response, ['items', 'results', 'data'])
          .map((record) => this.normalizeTicketSearch(record))
          .filter((item): item is EmailTicketSearchResult => item !== null),
      ),
    );
  }

  getEntityRelations(
    entityType: EmailRelationEntityType,
    entityId: string,
    provider: ClientContractProvider | null,
    offset: number,
    limit: number,
  ): Observable<RelatedEmailPage> {
    let params = new HttpParams().set('offset', String(offset)).set('limit', String(limit));
    if (entityType === 'contract' && provider) params = params.set('provider', provider);

    return this.http
      .get<unknown>(`${this.baseUrl}/entity/${entityType}/${encodeURIComponent(entityId)}`, {
        params,
      })
      .pipe(map((response) => this.normalizeRelatedEmailPage(response, offset, limit)));
  }

  private normalizeRelationList(response: unknown): EmailCrmRelation[] {
    return this.extractArray(response, ['items', 'relations', 'data'])
      .map((record) => {
        try {
          return this.normalizeRelation(record);
        } catch {
          return null;
        }
      })
      .filter((item): item is EmailCrmRelation => item !== null);
  }

  private normalizeRelation(record: UnknownRecord): EmailCrmRelation {
    const id = this.readString(record, ['id', '_id']);
    const accountId = this.readString(record, ['accountId']);
    const messageId = this.readString(record, ['messageId']);
    const entityType = this.readEntityType(record['entityType']);
    const entityId = this.readString(record, ['entityId']);
    if (!id || !accountId || !messageId || !entityType || !entityId) {
      throw new Error('A API devolveu uma associação de email inválida.');
    }

    return {
      id,
      accountId,
      messageId,
      entityType,
      entityId,
      provider: this.readProvider(record['provider']),
      createdAt: this.readNullableString(record, ['createdAt']),
    };
  }

  private normalizeContractSearch(record: UnknownRecord): EmailContractSearchResult | null {
    const entityId = this.readString(record, ['entityId', 'id', '_id']);
    const provider = this.readProvider(record['provider']);
    if (!entityId || !provider) return null;

    return {
      entityType: 'contract',
      entityId,
      provider,
      title: this.readString(record, ['title']) ?? entityId,
      nif: this.readNullableString(record, ['nif']),
      estado: this.readNullableString(record, ['estado']),
      tipoProduto: this.readNullableString(record, ['tipoProduto']),
      updatedAt: this.readNullableString(record, ['updatedAt']),
    };
  }

  private normalizeTicketSearch(record: UnknownRecord): EmailTicketSearchResult | null {
    const entityId = this.readString(record, ['entityId', 'id', '_id', 'ticketId']);
    if (!entityId) return null;

    return {
      entityType: 'ticket',
      entityId,
      title: this.readString(record, ['title', 'nomeClienteEmpresa']) ?? entityId,
      tipo: this.readNullableString(record, ['tipo', 'type']),
      estado: this.readNullableString(record, ['estado', 'status']),
      prioridade: this.readNullableString(record, ['prioridade', 'priority']),
      contractId: this.readNullableString(record, ['contractId']),
      companyId: this.readNullableString(record, ['companyId']),
      updatedAt: this.readNullableString(record, ['updatedAt']),
    };
  }

  private normalizeRelatedEmailPage(
    response: unknown,
    requestedOffset: number,
    requestedLimit: number,
  ): RelatedEmailPage {
    const rootRecord = this.asRecord(response);
    const nestedData = this.asRecord(rootRecord['data']);
    const root = Object.keys(nestedData).length ? { ...rootRecord, ...nestedData } : rootRecord;
    const itemRecords = this.extractArray(response, ['items', 'relations', 'data']);
    const items = itemRecords
      .map((record) => this.normalizeRelatedEmail(record))
      .filter((item): item is RelatedEmailMessage => item !== null);
    const offset = this.readNumber(root, ['offset']) ?? requestedOffset;
    const limit = this.readNumber(root, ['limit']) ?? requestedLimit;
    const total = this.readNumber(root, ['total']);
    const explicitHasMore = this.readBoolean(root, ['hasMore']);

    return {
      items,
      offset,
      limit,
      total,
      hasMore:
        explicitHasMore ?? (total !== null ? offset + items.length < total : items.length >= limit),
    };
  }

  private normalizeRelatedEmail(record: UnknownRecord): RelatedEmailMessage | null {
    const relationRecord = this.asRecord(record['relation']);
    const messageRecord = this.asRecord(record['message']);
    const source = Object.keys(messageRecord).length ? messageRecord : record;
    const relationId =
      this.readString(record, ['relationId']) ??
      this.readString(relationRecord, ['id', '_id']) ??
      this.readString(record, ['id', '_id']);
    const accountId =
      this.readString(source, ['accountId']) ??
      this.readString(record, ['accountId']) ??
      this.readString(relationRecord, ['accountId']);
    // The message projection can expose domainId/id. Do not use source.messageId here:
    // in message detail DTOs that field is the MIME Message-ID, not the internal CRM id.
    const messageId =
      this.readString(source, ['domainId', 'id', '_id']) ??
      this.readString(record, ['messageId']) ??
      this.readString(relationRecord, ['messageId']);
    if (!relationId || !accountId || !messageId) return null;

    const attachments = source['attachments'];
    return {
      relationId,
      accountId,
      messageId,
      subject: this.readString(source, ['subject']) ?? '(Sem assunto)',
      from: this.readAddress(source['from']),
      to: this.readAddressArray(source['to']),
      preview: this.readString(source, ['preview', 'snippet', 'text']) ?? '',
      date: this.readNullableString(source, ['date', 'sentAt', 'receivedAt', 'createdAt']),
      hasAttachments:
        this.readBoolean(source, ['hasAttachments']) ??
        (Array.isArray(attachments) && attachments.length > 0),
    };
  }

  private readEntityType(value: unknown): EmailRelationEntityType | null {
    return value === 'contract' || value === 'ticket' ? value : null;
  }

  private readProvider(value: unknown): ClientContractProvider | null {
    const allowed: readonly ClientContractProvider[] = [
      'repsol',
      'portulogos',
      'wallbox',
      'yes-energy',
      'galp-power-gas',
      'galp-solar',
      'iberdrola',
      'iberdrola-solar',
      'meo-energias',
      'vodafone',
    ];
    return typeof value === 'string' && allowed.includes(value as ClientContractProvider)
      ? (value as ClientContractProvider)
      : null;
  }

  private readAddress(value: unknown): EmailAddress | null {
    if (typeof value === 'string')
      return value.trim() ? { name: null, address: value.trim() } : null;
    const record = this.asRecord(value);
    const address = this.readString(record, ['address', 'email']);
    if (!address) return null;
    return { name: this.readNullableString(record, ['name']), address };
  }

  private readAddressArray(value: unknown): EmailAddress[] {
    if (!Array.isArray(value)) return this.readAddress(value) ? [this.readAddress(value)!] : [];
    return value
      .map((item) => this.readAddress(item))
      .filter((item): item is EmailAddress => item !== null);
  }

  private extractArray(response: unknown, keys: string[]): UnknownRecord[] {
    if (Array.isArray(response)) return response.map((item) => this.asRecord(item));
    const record = this.asRecord(response);
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value.map((item) => this.asRecord(item));
      const nested = this.asRecord(value);
      for (const nestedKey of keys) {
        if (Array.isArray(nested[nestedKey]))
          return (nested[nestedKey] as unknown[]).map((item) => this.asRecord(item));
      }
    }
    return [];
  }

  private extractSingleRecord(response: unknown, keys: string[]): UnknownRecord {
    const record = this.asRecord(response);
    for (const key of keys) {
      const nested = this.asRecord(record[key]);
      if (Object.keys(nested).length) return nested;
    }
    return record;
  }

  private asRecord(value: unknown): UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as UnknownRecord)
      : {};
  }

  private readString(record: UnknownRecord, keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return null;
  }

  private readNullableString(record: UnknownRecord, keys: string[]): string | null {
    return this.readString(record, keys);
  }

  private readNumber(record: UnknownRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
        return Number(value);
    }
    return null;
  }

  private readBoolean(record: UnknownRecord, keys: string[]): boolean | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'boolean') return value;
    }
    return null;
  }
}
