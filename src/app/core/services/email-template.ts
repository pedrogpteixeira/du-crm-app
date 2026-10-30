import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  EmailTemplate,
  EmailTemplateDraft,
  EmailTemplatePage,
} from '../models/email-template.model';

type UnknownRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class EmailTemplateService {
  private static readonly allowedVariableNames = new Set([
    'cliente.nome',
    'contrato.id',
    'contrato.estado',
    'comercializadora.nome',
    'utilizador.nome',
  ]);

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/email-templates`;

  list(offset = 0, limit = 25): Observable<EmailTemplatePage> {
    const params = new HttpParams().set('offset', String(offset)).set('limit', String(limit));
    return this.http
      .get<unknown>(this.baseUrl, { params })
      .pipe(map((response) => this.normalizePage(response, offset, limit)));
  }

  get(id: string): Observable<EmailTemplate> {
    return this.http
      .get<unknown>(`${this.baseUrl}/${encodeURIComponent(id)}`)
      .pipe(
        map((response) =>
          this.normalizeTemplate(this.extractSingleRecord(response, ['template', 'data'])),
        ),
      );
  }

  create(draft: EmailTemplateDraft): Observable<EmailTemplate> {
    return this.http
      .post<unknown>(this.baseUrl, this.toPayload(draft))
      .pipe(
        map((response) =>
          this.normalizeTemplate(this.extractSingleRecord(response, ['template', 'data'])),
        ),
      );
  }

  update(id: string, draft: EmailTemplateDraft): Observable<EmailTemplate> {
    return this.http
      .patch<unknown>(`${this.baseUrl}/${encodeURIComponent(id)}`, this.toPayload(draft))
      .pipe(
        map((response) =>
          this.normalizeTemplate(this.extractSingleRecord(response, ['template', 'data'])),
        ),
      );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  unresolvedVariables(subject: string, body: string): string[] {
    return this.extractVariables(subject, body);
  }

  invalidVariables(subject: string, body: string): string[] {
    return this.extractVariables(subject, body).filter((token) => {
      const name = token.slice(2, -2).trim();
      return !EmailTemplateService.allowedVariableNames.has(name);
    });
  }

  private extractVariables(subject: string, body: string): string[] {
    const matches = `${subject}\n${body}`.match(/{{\s*[^{}]+\s*}}/g) ?? [];
    return [...new Set(matches.map((item) => item.trim()))];
  }

  private toPayload(draft: EmailTemplateDraft): EmailTemplateDraft {
    return {
      name: draft.name.trim(),
      subject: draft.subject,
      body: draft.body,
      active: draft.active,
      shared: false,
    };
  }

  private normalizePage(
    response: unknown,
    requestedOffset: number,
    requestedLimit: number,
  ): EmailTemplatePage {
    const rootRecord = this.asRecord(response);
    const nestedData = this.asRecord(rootRecord['data']);
    const root = Object.keys(nestedData).length ? { ...rootRecord, ...nestedData } : rootRecord;
    const items = this.extractArray(response, ['items', 'templates', 'data']).map((record) =>
      this.normalizeTemplate(record),
    );
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

  private normalizeTemplate(record: UnknownRecord): EmailTemplate {
    const id = this.readString(record, ['id', '_id']);
    const name = this.readString(record, ['name']);
    if (!id || !name) throw new Error('A API devolveu um template de email inválido.');
    return {
      id,
      name,
      subject: this.readString(record, ['subject']) ?? '',
      body: this.readString(record, ['body', 'text']) ?? '',
      active: this.readBoolean(record, ['active']) ?? true,
      shared: this.readBoolean(record, ['shared']) ?? false,
      ownerId: this.readString(record, ['ownerId']),
      createdAt: this.readString(record, ['createdAt']),
      updatedAt: this.readString(record, ['updatedAt']),
    };
  }

  private extractArray(response: unknown, keys: string[]): UnknownRecord[] {
    if (Array.isArray(response)) return response.map((item) => this.asRecord(item));
    const root = this.asRecord(response);
    for (const key of keys) {
      const value = root[key];
      if (Array.isArray(value)) return value.map((item) => this.asRecord(item));
      const nested = this.asRecord(value);
      if (Array.isArray(nested['items'])) return nested['items'].map((item) => this.asRecord(item));
    }
    return [];
  }

  private extractSingleRecord(response: unknown, keys: string[]): UnknownRecord {
    const root = this.asRecord(response);
    for (const key of keys) {
      const nested = this.asRecord(root[key]);
      if (Object.keys(nested).length) return nested;
    }
    return root;
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
    for (const key of keys) if (typeof record[key] === 'boolean') return record[key] as boolean;
    return null;
  }
}
