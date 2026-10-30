import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateEmailAccountPayload,
  EmailAccountUserAccess,
  EmailAdminAccount,
  EmailConnectionTestResult,
  UpdateEmailAccountPayload,
  UpdateEmailAccountUserPayload,
} from '../models/email-admin.model';

type UnknownRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class EmailAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/email-accounts`;

  getAccounts(): Observable<EmailAdminAccount[]> {
    return this.http.get<unknown>(this.baseUrl).pipe(
      map((response) => this.extractArray(response, ['items', 'accounts', 'data'])
        .map((item) => this.normalizeAccount(item))
        .filter((item): item is EmailAdminAccount => item !== null)),
    );
  }

  createAccount(payload: CreateEmailAccountPayload): Observable<EmailAdminAccount> {
    return this.http.post<unknown>(this.baseUrl, payload).pipe(
      map((response) => this.requireAccount(response)),
    );
  }

  updateAccount(id: string, payload: UpdateEmailAccountPayload): Observable<EmailAdminAccount> {
    return this.http.patch<unknown>(`${this.baseUrl}/${encodeURIComponent(id)}`, payload).pipe(
      map((response) => this.requireAccount(response)),
    );
  }

  getAccountUsers(accountId: string): Observable<EmailAccountUserAccess[]> {
    return this.http.get<unknown>(`${this.baseUrl}/${encodeURIComponent(accountId)}/users`).pipe(
      map((response) => this.extractArray(response, ['items', 'users', 'data'])
        .map((item) => this.normalizeAccess(item))
        .filter((item): item is EmailAccountUserAccess => item !== null)),
    );
  }

  setAccountUser(
    accountId: string,
    userId: string,
    payload: UpdateEmailAccountUserPayload,
  ): Observable<EmailAccountUserAccess> {
    return this.http.put<unknown>(
      `${this.baseUrl}/${encodeURIComponent(accountId)}/users/${encodeURIComponent(userId)}`,
      payload,
    ).pipe(
      map((response) => this.normalizeAccess(this.extractSingleRecord(response, ['item', 'user', 'data'])) ?? ({ userId, ...payload })),
    );
  }

  removeAccountUser(accountId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${encodeURIComponent(accountId)}/users/${encodeURIComponent(userId)}`,
    );
  }

  testConnection(accountId: string): Observable<EmailConnectionTestResult> {
    return this.http.post<unknown>(
      `${this.baseUrl}/${encodeURIComponent(accountId)}/test-connection`,
      {},
    ).pipe(
      map((response) => this.normalizeConnectionResult(response)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 422) {
          return of(this.normalizeConnectionResult(error.error));
        }
        return throwError(() => error);
      }),
    );
  }

  private requireAccount(response: unknown): EmailAdminAccount {
    const account = this.normalizeAccount(this.extractSingleRecord(response, ['account', 'item', 'data']));
    if (!account) {
      throw new Error('A API devolveu uma conta de email inválida.');
    }
    return account;
  }

  private normalizeAccount(record: UnknownRecord): EmailAdminAccount | null {
    const id = this.readString(record, ['id', '_id']);
    const address = this.readString(record, ['address']);
    if (!id || !address) return null;

    return {
      id,
      address,
      displayName: this.readNullableString(record, ['displayName']),
      imapHost: this.readString(record, ['imapHost']) ?? '',
      imapPort: this.readNumber(record, ['imapPort']) ?? 993,
      smtpHost: this.readString(record, ['smtpHost']) ?? '',
      smtpPort: this.readNumber(record, ['smtpPort']) ?? 465,
      username: this.readString(record, ['username']) ?? address,
      isActive: this.readBoolean(record, ['isActive', 'active'], true),
      createdAt: this.readNullableString(record, ['createdAt']),
      updatedAt: this.readNullableString(record, ['updatedAt']),
    };
  }

  private normalizeAccess(record: UnknownRecord): EmailAccountUserAccess | null {
    const userRecord = this.asRecord(record['user']);
    const permissions = this.asRecord(record['permissions']);
    const userId = this.readString(record, ['userId']) ?? this.readString(userRecord, ['id', '_id']);
    if (!userId) return null;

    return {
      userId,
      canRead: this.readOptionalBoolean(record, ['canRead']) ?? this.readOptionalBoolean(permissions, ['canRead']) ?? false,
      canSend: this.readOptionalBoolean(record, ['canSend']) ?? this.readOptionalBoolean(permissions, ['canSend']) ?? false,
      canManageMessages: this.readOptionalBoolean(record, ['canManageMessages']) ?? this.readOptionalBoolean(permissions, ['canManageMessages']) ?? false,
    };
  }

  private normalizeConnectionResult(response: unknown): EmailConnectionTestResult {
    const record = this.extractSingleRecord(response, ['result', 'data']);
    const connections = this.asRecord(record['connections']);
    const imap = this.readNullableString(connections, ['imap']);
    const smtp = this.readNullableString(connections, ['smtp']);
    const explicitSuccess = this.readOptionalBoolean(record, ['success', 'ok', 'connected']);
    const successFromConnections = imap !== null && smtp !== null
      ? imap.toLowerCase() === 'ok' && smtp.toLowerCase() === 'ok'
      : null;

    return {
      success: explicitSuccess ?? successFromConnections ?? false,
      message: this.readNullableString(record, ['message']),
      connections: { imap, smtp },
    };
  }

  private extractArray(response: unknown, keys: string[]): UnknownRecord[] {
    if (Array.isArray(response)) return response.map((item) => this.asRecord(item));
    const record = this.asRecord(response);
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value.map((item) => this.asRecord(item));
    }
    return [];
  }

  private extractSingleRecord(response: unknown, keys: string[]): UnknownRecord {
    const record = this.asRecord(response);
    for (const key of keys) {
      const nested = record[key];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) return this.asRecord(nested);
    }
    return record;
  }

  private asRecord(value: unknown): UnknownRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
  }

  private readString(record: UnknownRecord, keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
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
      if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
    }
    return null;
  }

  private readOptionalBoolean(record: UnknownRecord, keys: string[]): boolean | null {
    for (const key of keys) if (typeof record[key] === 'boolean') return record[key] as boolean;
    return null;
  }

  private readBoolean(record: UnknownRecord, keys: string[], fallback: boolean): boolean {
    return this.readOptionalBoolean(record, keys) ?? fallback;
  }
}
