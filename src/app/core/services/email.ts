import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  EmailAccountApiResponse,
  EmailAccountSummary,
  EmailAddress,
  EmailAttachmentApiResponse,
  EmailAttachmentSummary,
  EmailComposePayload,
  EmailDraftAttachment,
  EmailDraftPage,
  EmailDraftResult,
  EmailDraftSummary,
  EmailFolder,
  EmailFolderSummary,
  EmailMessageDetail,
  EmailMessagePage,
  EmailMessageSummary,
  EmailSendResult,
  EmailSyncResult,
  EmailReadApiResponse,
  EmailThreadDetail,
  EmailThreadMessage,
  EmailThreadPage,
  EmailThreadSummary,
} from '../models/email.model';

type UnknownRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/email-accounts`;

  getMyAccounts(): Observable<EmailAccountSummary[]> {
    return this.http.get<EmailAccountApiResponse>(`${this.baseUrl}/mine`).pipe(
      map((response) =>
        response.items.map((item) => ({
          id: item.id,
          address: item.address,
          displayName: item.displayName,
          isActive: item.active,
          permissions: { ...item.permissions },
        })),
      ),
    );
  }

  getFolders(accountId: string): Observable<EmailFolderSummary[]> {
    return this.http
      .get<unknown>(`${this.baseUrl}/${encodeURIComponent(accountId)}/messages/folders`)
      .pipe(map((response) => this.normalizeFolders(response)));
  }

  getMessages(
    accountId: string,
    folder: Exclude<EmailFolder, 'DRAFTS'>,
    offset: number,
    limit: number,
  ): Observable<EmailMessagePage> {
    const params = new HttpParams()
      .set('folder', folder)
      .set('offset', String(offset))
      .set('limit', String(limit));

    return this.http
      .get<unknown>(`${this.baseUrl}/${encodeURIComponent(accountId)}/messages`, { params })
      .pipe(map((response) => this.normalizeMessagePage(response, offset, limit)));
  }

  getThreads(
    accountId: string,
    folder: Exclude<EmailFolder, 'DRAFTS'>,
    offset: number,
    limit: number,
  ): Observable<EmailThreadPage> {
    const params = new HttpParams()
      .set('folder', folder)
      .set('offset', String(offset))
      .set('limit', String(limit));

    return this.http
      .get<unknown>(`${this.baseUrl}/${encodeURIComponent(accountId)}/messages/threads`, { params })
      .pipe(map((response) => this.normalizeThreadPage(response, offset, limit)));
  }

  getThread(accountId: string, threadId: string): Observable<EmailThreadDetail> {
    return this.http
      .get<unknown>(
        `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/threads/${encodeURIComponent(threadId)}`,
      )
      .pipe(map((response) => this.normalizeThreadDetail(response)));
  }

  getMessage(accountId: string, internalMessageId: string): Observable<EmailMessageDetail> {
    return this.http
      .get<unknown>(
        `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/${encodeURIComponent(internalMessageId)}`,
      )
      .pipe(map((response) => this.normalizeMessageDetail(response)));
  }

  setMessageRead(
    accountId: string,
    internalMessageId: string,
    read: boolean,
  ): Observable<EmailReadApiResponse> {
    return this.http.patch<EmailReadApiResponse>(
      `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/${encodeURIComponent(internalMessageId)}/read`,
      { read },
    );
  }

  sendMessage(accountId: string, payload: EmailComposePayload): Observable<EmailSendResult> {
    return this.http
      .post<unknown>(`${this.baseUrl}/${encodeURIComponent(accountId)}/messages/send`, payload)
      .pipe(map((response) => this.normalizeSendResult(response)));
  }

  sendMessageWithAttachments(
    accountId: string,
    payload: EmailComposePayload,
    files: File[],
  ): Observable<EmailSendResult> {
    const body = new FormData();
    body.append('message', JSON.stringify(payload));
    for (const file of files) body.append('files', file, file.name);

    return this.http
      .post<unknown>(
        `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/send-with-attachments`,
        body,
      )
      .pipe(map((response) => this.normalizeSendResult(response)));
  }

  getDrafts(accountId: string, offset: number, limit: number): Observable<EmailDraftPage> {
    const params = new HttpParams().set('offset', String(offset)).set('limit', String(limit));
    return this.http
      .get<unknown>(`${this.baseUrl}/${encodeURIComponent(accountId)}/messages/drafts`, { params })
      .pipe(map((response) => this.normalizeDraftPage(response, offset, limit)));
  }

  createDraft(accountId: string, payload: EmailComposePayload): Observable<EmailDraftResult> {
    return this.http
      .post<unknown>(
        `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/drafts`,
        this.toDraftPayload(payload),
      )
      .pipe(map((response) => this.normalizeDraftResult(response)));
  }

  updateDraft(
    accountId: string,
    draftId: string,
    payload: EmailComposePayload,
  ): Observable<EmailDraftResult> {
    return this.http
      .patch<unknown>(
        `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/${encodeURIComponent(draftId)}/draft`,
        this.toDraftPayload(payload),
      )
      .pipe(map((response) => this.normalizeDraftResult(response, draftId)));
  }

  deleteDraft(accountId: string, draftId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/${encodeURIComponent(draftId)}/draft`,
    );
  }

  getDraftAttachments(accountId: string, draftId: string): Observable<EmailDraftAttachment[]> {
    return this.http
      .get<unknown>(
        `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/drafts/${encodeURIComponent(draftId)}/attachments`,
      )
      .pipe(
        map((response) =>
          this.extractArray(response, ['items', 'attachments', 'data'])
            .map((record) => this.normalizeDraftAttachment(record))
            .filter((item): item is EmailDraftAttachment => item !== null),
        ),
      );
  }

  uploadDraftAttachments(
    accountId: string,
    draftId: string,
    files: File[],
  ): Observable<EmailDraftAttachment[]> {
    const body = new FormData();
    for (const file of files) body.append('files', file, file.name);
    return this.http
      .post<unknown>(
        `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/drafts/${encodeURIComponent(draftId)}/attachments`,
        body,
      )
      .pipe(
        map((response) =>
          this.extractArray(response, ['items'])
            .map((record) => this.normalizeDraftAttachment(record))
            .filter((item): item is EmailDraftAttachment => item !== null),
        ),
      );
  }

  downloadDraftAttachment(
    accountId: string,
    draftId: string,
    attachmentId: string,
  ): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/drafts/${encodeURIComponent(draftId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { responseType: 'blob' },
    );
  }

  deleteDraftAttachment(
    accountId: string,
    draftId: string,
    attachmentId: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/drafts/${encodeURIComponent(draftId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
  }

  sendDraft(accountId: string, draftId: string): Observable<EmailSendResult> {
    return this.http
      .post<unknown>(
        `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/drafts/${encodeURIComponent(draftId)}/send`,
        {},
      )
      .pipe(map((response) => this.normalizeSendResult(response)));
  }

  syncMessages(
    accountId: string,
    folder: Exclude<EmailFolder, 'DRAFTS'>,
  ): Observable<EmailSyncResult> {
    return this.http
      .post<unknown>(`${this.baseUrl}/${encodeURIComponent(accountId)}/messages/sync`, { folder })
      .pipe(map((response) => this.normalizeSyncResult(response, folder)));
  }

  getAttachments(
    accountId: string,
    internalMessageId: string,
  ): Observable<EmailAttachmentSummary[]> {
    return this.http
      .get<EmailAttachmentApiResponse>(
        `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/${encodeURIComponent(internalMessageId)}/attachments`,
      )
      .pipe(map((response) => response.items.map((item) => ({ ...item }))));
  }

  downloadAttachment(
    accountId: string,
    internalMessageId: string,
    index: number,
  ): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${encodeURIComponent(accountId)}/messages/${encodeURIComponent(internalMessageId)}/attachments/${index}`,
      { responseType: 'blob' },
    );
  }

  private normalizeFolders(response: unknown): EmailFolderSummary[] {
    const raw = this.extractUnknownArray(response, ['items', 'folders', 'data']);
    const result: EmailFolderSummary[] = [];
    for (const value of raw) {
      const record = this.asRecord(value);
      const rawFolder =
        typeof value === 'string'
          ? value
          : this.readString(record, ['folder', 'name', 'key', 'id']);
      const folder = this.toSupportedFolder(rawFolder);
      if (!folder || result.some((item) => item.folder === folder)) continue;
      result.push({
        folder,
        label: this.folderLabel(folder),
        remoteSync: this.readOptionalBoolean(record, ['remoteSync']) ?? false,
      });
    }
    return result;
  }

  private normalizeMessagePage(
    response: unknown,
    requestedOffset: number,
    requestedLimit: number,
  ): EmailMessagePage {
    const responseRecord = this.extractPageRecord(response);
    const items = this.extractArray(response, ['items', 'messages', 'data'])
      .map((record) => this.normalizeMessageSummary(record))
      .filter((message): message is EmailMessageSummary => message !== null);
    const offset = this.readNumber(responseRecord, ['offset']) ?? requestedOffset;
    const limit = this.readNumber(responseRecord, ['limit']) ?? requestedLimit;
    const total = this.readNumber(responseRecord, ['total']);
    const explicitHasMore = this.readOptionalBoolean(responseRecord, ['hasMore']);
    return {
      items,
      offset,
      limit,
      total,
      hasMore:
        explicitHasMore ?? (total !== null ? offset + items.length < total : items.length >= limit),
    };
  }

  private normalizeMessageSummary(record: UnknownRecord): EmailMessageSummary | null {
    const id = this.readString(record, ['id']);
    if (!id) return null;
    const text = this.readNullableString(record, ['text']);
    return {
      id,
      accountId: this.readNullableString(record, ['accountId']),
      folder: this.readString(record, ['folder']) ?? '',
      from: this.readAddress(record['from']),
      to: this.readAddressArray(record['to']),
      subject: this.readString(record, ['subject']) ?? '(Sem assunto)',
      preview: this.readString(record, ['preview']) ?? this.createPreview(text),
      date: this.readNullableString(record, ['receivedAt', 'createdAt', 'updatedAt']),
      isRead: this.readOptionalBoolean(record, ['read']),
      hasAttachments: this.readOptionalBoolean(record, ['hasAttachments']) ?? false,
    };
  }

  private normalizeMessageDetail(response: unknown): EmailMessageDetail {
    const record = this.extractSingleRecord(response, ['message', 'data']);
    const summary = this.normalizeMessageSummary(record);
    if (!summary) throw new Error('A API devolveu uma mensagem sem identificador válido.');
    return {
      ...summary,
      cc: this.readAddressArray(record['cc']),
      bcc: this.readAddressArray(record['bcc']),
      text: this.readNullableString(record, ['text']),
      mimeMessageId: this.readNullableString(record, ['messageId']),
      inReplyTo: this.readNullableString(record, ['inReplyTo']),
      references: this.readStringArray(record['references']),
    };
  }

  private normalizeThreadPage(
    response: unknown,
    requestedOffset: number,
    requestedLimit: number,
  ): EmailThreadPage {
    const root = this.extractPageRecord(response);
    const items = this.extractArray(response, ['items', 'threads', 'data'])
      .map((record) => this.normalizeThreadSummary(record))
      .filter((thread): thread is EmailThreadSummary => thread !== null);
    const offset = this.readNumber(root, ['offset']) ?? requestedOffset;
    const limit = this.readNumber(root, ['limit']) ?? requestedLimit;
    const total = this.readNumber(root, ['total']);
    const explicitHasMore = this.readOptionalBoolean(root, ['hasMore']);

    return {
      items,
      offset,
      limit,
      total,
      hasMore:
        explicitHasMore ?? (total !== null ? offset + items.length < total : items.length >= limit),
    };
  }

  private normalizeThreadSummary(record: UnknownRecord): EmailThreadSummary | null {
    const id = this.readString(record, ['id']);
    if (!id) return null;

    const folders = this.readStringArray(record['folders'])
      .map((value) => this.toSupportedFolder(value))
      .filter(
        (folder): folder is Exclude<EmailFolder, 'DRAFTS'> =>
          folder === 'INBOX' || folder === 'SENT',
      );

    return {
      id,
      subject: this.readString(record, ['subject']) ?? '(Sem assunto)',
      participants: this.readStringArray(record['participants']),
      messageCount: this.readNumber(record, ['messageCount']) ?? 0,
      unreadCount: this.readNumber(record, ['unreadCount']) ?? 0,
      folders: [...new Set(folders)],
      hasAttachments: this.readOptionalBoolean(record, ['hasAttachments']) ?? false,
      lastMessageAt: this.readNullableString(record, ['lastMessageAt']),
    };
  }

  private normalizeThreadDetail(response: unknown): EmailThreadDetail {
    const record = this.extractSingleRecord(response, ['thread', 'data']);
    const summary = this.normalizeThreadSummary(record);
    if (!summary) throw new Error('A API devolveu uma conversa sem identificador válido.');

    const messages = Array.isArray(record['messages'])
      ? (record['messages'] as unknown[])
          .map((value) => this.normalizeThreadMessage(this.asRecord(value)))
          .filter((message): message is EmailThreadMessage => message !== null)
      : [];

    return { ...summary, messages };
  }

  private normalizeThreadMessage(record: UnknownRecord): EmailThreadMessage | null {
    const id = this.readString(record, ['id']);
    const folder = this.toSupportedFolder(this.readString(record, ['folder']));
    const kind = this.readString(record, ['kind']);
    if (
      !id ||
      (folder !== 'INBOX' && folder !== 'SENT') ||
      (kind !== 'inbound' && kind !== 'outbound')
    )
      return null;

    const text = this.readNullableString(record, ['text']);
    return {
      id,
      accountId: this.readNullableString(record, ['accountId']),
      folder,
      kind,
      from: this.readAddress(record['from']),
      to: this.readAddressArray(record['to']),
      cc: this.readAddressArray(record['cc']),
      bcc: this.readAddressArray(record['bcc']),
      subject: this.readString(record, ['subject']) ?? '(Sem assunto)',
      preview: this.readString(record, ['preview']) ?? this.createPreview(text),
      date: this.readNullableString(record, ['receivedAt', 'sentAt', 'createdAt', 'updatedAt']),
      isRead: this.readOptionalBoolean(record, ['read']),
      hasAttachments: this.readOptionalBoolean(record, ['hasAttachments']) ?? false,
      text,
      mimeMessageId: this.readNullableString(record, ['messageId']),
      inReplyTo: this.readNullableString(record, ['inReplyTo']),
      references: this.readStringArray(record['references']),
    };
  }

  private normalizeDraftPage(
    response: unknown,
    requestedOffset: number,
    requestedLimit: number,
  ): EmailDraftPage {
    const root = this.extractPageRecord(response);
    const items = this.extractArray(response, ['items', 'drafts', 'data'])
      .map((record) => this.normalizeDraft(record))
      .filter((draft): draft is EmailDraftSummary => draft !== null);
    const offset = this.readNumber(root, ['offset']) ?? requestedOffset;
    const limit = this.readNumber(root, ['limit']) ?? requestedLimit;
    const total = this.readNumber(root, ['total']);
    const explicitHasMore = this.readOptionalBoolean(root, ['hasMore']);
    return {
      items,
      offset,
      limit,
      total,
      hasMore:
        explicitHasMore ?? (total !== null ? offset + items.length < total : items.length >= limit),
    };
  }

  private normalizeDraft(record: UnknownRecord): EmailDraftSummary | null {
    const id = this.readString(record, ['id']);
    if (!id) return null;
    return {
      id,
      accountId: this.readNullableString(record, ['accountId']),
      to: this.readStringArray(record['to']),
      cc: this.readStringArray(record['cc']),
      bcc: this.readStringArray(record['bcc']),
      subject: this.readString(record, ['subject']) ?? '',
      text: this.readNullableString(record, ['text']) ?? '',
      createdAt: this.readNullableString(record, ['createdAt']),
      updatedAt: this.readNullableString(record, ['updatedAt']),
      attachmentCount: this.readOptionalBoolean(record, ['hasAttachments']) ? 1 : 0,
    };
  }

  private normalizeDraftAttachment(record: UnknownRecord): EmailDraftAttachment | null {
    const id = this.readString(record, ['attachmentId', 'id', '_id']);
    const filename = this.readString(record, ['filename', 'name']);
    if (!id || !filename) return null;
    return {
      id,
      filename,
      contentType: this.readNullableString(record, ['contentType']),
      size: this.readNumber(record, ['size']) ?? 0,
      createdAt: this.readNullableString(record, ['createdAt']),
    };
  }

  private normalizeSendResult(response: unknown): EmailSendResult {
    const record = this.extractSingleRecord(response, ['message', 'data', 'result']);
    return {
      id: this.readNullableString(record, ['id']),
      messageId: this.readNullableString(record, ['messageId']),
      mimeMessageId: this.readNullableString(record, ['mimeMessageId']),
      accepted: this.readNumber(record, ['accepted']),
      rejected: this.readNumber(record, ['rejected']),
      savedToWebmail: this.readOptionalBoolean(record, ['savedToWebmail']),
      persisted: this.readOptionalBoolean(record, ['persisted']),
      draftRemoved: this.readOptionalBoolean(record, ['draftRemoved']),
    };
  }

  private normalizeSyncResult(
    response: unknown,
    fallbackFolder: Exclude<EmailFolder, 'DRAFTS'>,
  ): EmailSyncResult {
    const record = this.extractSingleRecord(response, ['data', 'result']);
    const folder = this.toSupportedFolder(this.readString(record, ['folder']));
    return {
      folder: folder === 'INBOX' || folder === 'SENT' ? folder : fallbackFolder,
      fetched: this.readNumber(record, ['fetched']) ?? 0,
      inserted: this.readNumber(record, ['inserted']) ?? 0,
      skipped: this.readNumber(record, ['skipped']) ?? 0,
    };
  }

  private toDraftPayload(
    payload: EmailComposePayload,
  ): Pick<EmailComposePayload, 'to' | 'cc' | 'bcc' | 'subject' | 'text'> {
    return {
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      text: payload.text,
    };
  }

  private normalizeDraftResult(
    response: unknown,
    fallbackId: string | null = null,
  ): EmailDraftResult {
    const record = this.extractSingleRecord(response, ['draft', 'message', 'data']);
    return { id: this.readNullableString(record, ['id', '_id', 'messageId']) ?? fallbackId };
  }

  private extractUnknownArray(response: unknown, keys: string[]): unknown[] {
    if (Array.isArray(response)) return response;
    const record = this.asRecord(response);
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value;
      const nested = this.asRecord(value);
      for (const nestedKey of keys) {
        if (Array.isArray(nested[nestedKey])) return nested[nestedKey] as unknown[];
      }
    }
    return [];
  }

  private extractPageRecord(response: unknown): UnknownRecord {
    const root = this.asRecord(response);
    const data = this.asRecord(root['data']);
    return Object.keys(data).length ? { ...root, ...data } : root;
  }

  private extractArray(response: unknown, keys: string[]): UnknownRecord[] {
    if (Array.isArray(response)) return response.map((value) => this.asRecord(value));
    const record = this.asRecord(response);
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value.map((item) => this.asRecord(item));
      const nested = this.asRecord(value);
      if (Array.isArray(nested['items'])) return nested['items'].map((item) => this.asRecord(item));
    }
    return [];
  }

  private extractSingleRecord(response: unknown, keys: string[]): UnknownRecord {
    const record = this.asRecord(response);
    for (const key of keys) {
      const nested = this.asRecord(record[key]);
      if (Object.keys(nested).length > 0) return nested;
    }
    return record;
  }

  private readAddress(value: unknown): EmailAddress | null {
    if (typeof value === 'string') {
      const address = value.trim();
      return address ? { name: null, address } : null;
    }
    const record = this.asRecord(value);
    const address = this.readString(record, ['address', 'email']);
    return address ? { name: this.readNullableString(record, ['name']), address } : null;
  }

  private readAddressArray(value: unknown): EmailAddress[] {
    if (typeof value === 'string') {
      const single = this.readAddress(value);
      return single ? [single] : [];
    }
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => this.readAddress(item))
      .filter((address): address is EmailAddress => address !== null);
  }

  private readStringArray(value: unknown): string[] {
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (typeof item === 'string') return item.trim() ? [item.trim()] : [];
      const address = this.readAddress(item);
      return address ? [address.address] : [];
    });
  }

  private toSupportedFolder(value: string | null): EmailFolder | null {
    if (!value) return null;
    const normalized = value.trim().toUpperCase();
    if (normalized === 'INBOX') return 'INBOX';
    if (normalized === 'SENT' || normalized === 'SENT ITEMS' || normalized === 'ENVIADOS')
      return 'SENT';
    if (normalized === 'DRAFTS' || normalized === 'DRAFT' || normalized === 'RASCUNHOS')
      return 'DRAFTS';
    return null;
  }

  private folderLabel(folder: EmailFolder): string {
    if (folder === 'INBOX') return 'Caixa de Entrada';
    if (folder === 'SENT') return 'Enviados';
    return 'Rascunhos';
  }

  private createPreview(text: string | null): string {
    return text ? text.replace(/\s+/g, ' ').trim().slice(0, 180) : '';
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

  private readBoolean(record: UnknownRecord, keys: string[], fallback: boolean): boolean {
    return this.readOptionalBoolean(record, keys) ?? fallback;
  }

  private readOptionalBoolean(record: UnknownRecord, keys: string[]): boolean | null {
    for (const key of keys) if (typeof record[key] === 'boolean') return record[key] as boolean;
    return null;
  }
}
