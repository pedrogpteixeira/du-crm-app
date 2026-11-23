import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type ObservationType = 'normal' | 'internal';

export interface ContractObservationMessage {
  _id: string;
  domainId: string;
  provider: string;
  contractId: string;
  type: ObservationType;
  authorId: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface ObservationMessagesResponse {
  messages: ContractObservationMessage[];
}

export interface ObservationMessageResponse {
  message: ContractObservationMessage;
}

export interface DeleteObservationMessageResponse {
  deleted: true;
  messageId: string;
}

@Injectable({ providedIn: 'root' })
export class ContractObservationMessagesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/contracts/observation-messages`;

  getMessages(
    provider: string,
    contractId: string,
    type: ObservationType,
  ): Observable<ObservationMessagesResponse> {
    return this.http.get<ObservationMessagesResponse>(this.collectionUrl(provider, contractId, type));
  }

  createMessage(
    provider: string,
    contractId: string,
    type: ObservationType,
    content: string,
  ): Observable<ObservationMessageResponse> {
    return this.http.post<ObservationMessageResponse>(this.collectionUrl(provider, contractId, type), {
      content,
    });
  }

  updateMessage(
    provider: string,
    contractId: string,
    type: ObservationType,
    messageId: string,
    content: string,
  ): Observable<ObservationMessageResponse> {
    return this.http.patch<ObservationMessageResponse>(
      this.messageUrl(provider, contractId, type, messageId),
      { content },
    );
  }

  deleteMessage(
    provider: string,
    contractId: string,
    type: ObservationType,
    messageId: string,
  ): Observable<DeleteObservationMessageResponse> {
    return this.http.delete<DeleteObservationMessageResponse>(
      this.messageUrl(provider, contractId, type, messageId),
    );
  }

  private collectionUrl(provider: string, contractId: string, type: ObservationType): string {
    return `${this.baseUrl}/${encodeURIComponent(provider)}/${encodeURIComponent(contractId)}/${type}`;
  }

  private messageUrl(
    provider: string,
    contractId: string,
    type: ObservationType,
    messageId: string,
  ): string {
    return `${this.collectionUrl(provider, contractId, type)}/${encodeURIComponent(messageId)}`;
  }
}
