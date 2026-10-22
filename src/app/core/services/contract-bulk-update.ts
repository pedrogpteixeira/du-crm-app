import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, shareReplay, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ContractBulkUpdateExecuteRequest,
  ContractBulkUpdateExecuteResponse,
  ContractBulkUpdateFieldsResponse,
  ContractBulkUpdateHistoryOperation,
  ContractBulkUpdateOperationListApiResponse,
  ContractBulkUpdateOperationPage,
  ContractBulkUpdateOperationStatus,
  ContractBulkUpdatePreviewRequest,
  ContractBulkUpdatePreviewResponse,
  ContractBulkUpdateProvider,
  ContractBulkUpdateResultStatus,
  ContractBulkUpdateResultsApiResponse,
  ContractBulkUpdateResultsPage,
} from '../utils/contract-bulk-update';

@Injectable({ providedIn: 'root' })
export class ContractBulkUpdateService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/contracts/bulk-update`;
  private readonly fieldsCache = new Map<
    ContractBulkUpdateProvider,
    Observable<ContractBulkUpdateFieldsResponse>
  >();

  getFields(provider: ContractBulkUpdateProvider): Observable<ContractBulkUpdateFieldsResponse> {
    const cached = this.fieldsCache.get(provider);
    if (cached) return cached;

    const request = this.http
      .get<ContractBulkUpdateFieldsResponse>(
        `${this.baseUrl}/${encodeURIComponent(provider)}/fields`,
      )
      .pipe(
        catchError((error) => {
          this.fieldsCache.delete(provider);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.fieldsCache.set(provider, request);
    return request;
  }

  preview(
    provider: ContractBulkUpdateProvider,
    payload: ContractBulkUpdatePreviewRequest,
  ): Observable<ContractBulkUpdatePreviewResponse> {
    return this.http.post<ContractBulkUpdatePreviewResponse>(
      `${this.baseUrl}/${encodeURIComponent(provider)}/preview`,
      payload,
    );
  }

  execute(
    provider: ContractBulkUpdateProvider,
    payload: ContractBulkUpdateExecuteRequest,
  ): Observable<ContractBulkUpdateExecuteResponse> {
    return this.http.post<ContractBulkUpdateExecuteResponse>(
      `${this.baseUrl}/${encodeURIComponent(provider)}`,
      payload,
    );
  }

  getOperations(filters: {
    provider?: string;
    status?: ContractBulkUpdateOperationStatus | '';
    offset?: number;
    limit?: number;
  } = {}): Observable<ContractBulkUpdateOperationPage> {
    let params = new HttpParams()
      .set('offset', String(Math.max(0, filters.offset ?? 0)))
      .set('limit', String(Math.max(1, filters.limit ?? 25)));

    if (filters.provider?.trim()) {
      params = params.set('provider', filters.provider.trim());
    }
    if (filters.status) {
      params = params.set('status', filters.status);
    }

    return this.http
      .get<ContractBulkUpdateOperationListApiResponse>(`${this.baseUrl}/operations`, { params })
      .pipe(map((response) => this.normalizeOperationsPage(response, filters)));
  }

  getOperation(operationId: string): Observable<ContractBulkUpdateHistoryOperation> {
    return this.http.get<ContractBulkUpdateHistoryOperation>(
      `${this.baseUrl}/operations/${encodeURIComponent(operationId)}`,
    );
  }

  getOperationResults(
    operationId: string,
    filters: {
      status?: ContractBulkUpdateResultStatus | '';
      offset?: number;
      limit?: number;
    } = {},
  ): Observable<ContractBulkUpdateResultsPage> {
    let params = new HttpParams()
      .set('offset', String(Math.max(0, filters.offset ?? 0)))
      .set('limit', String(Math.max(1, filters.limit ?? 25)));

    if (filters.status) {
      params = params.set('status', filters.status);
    }

    return this.http
      .get<ContractBulkUpdateResultsApiResponse>(
        `${this.baseUrl}/operations/${encodeURIComponent(operationId)}/results`,
        { params },
      )
      .pipe(map((response) => this.normalizeResultsPage(response, filters)));
  }

  private normalizeOperationsPage(
    response: ContractBulkUpdateOperationListApiResponse,
    requested: { offset?: number; limit?: number },
  ): ContractBulkUpdateOperationPage {
    const operations = response.operations ?? response.items ?? [];
    const offset = Number(response.offset ?? requested.offset ?? 0) || 0;
    const limit = Number(response.limit ?? requested.limit ?? 25) || 25;
    const total = Number(response.total ?? operations.length) || 0;
    const nextOffset = response.nextOffset ?? (offset + operations.length < total ? offset + operations.length : null);

    return {
      operations,
      total,
      offset,
      limit,
      hasMore: response.hasMore ?? nextOffset !== null,
      nextOffset,
    };
  }

  private normalizeResultsPage(
    response: ContractBulkUpdateResultsApiResponse,
    requested: { offset?: number; limit?: number },
  ): ContractBulkUpdateResultsPage {
    const results = response.results ?? response.items ?? [];
    const offset = Number(response.offset ?? requested.offset ?? 0) || 0;
    const limit = Number(response.limit ?? requested.limit ?? 25) || 25;
    const total = Number(response.total ?? results.length) || 0;
    const nextOffset = response.nextOffset ?? (offset + results.length < total ? offset + results.length : null);

    return {
      results,
      total,
      offset,
      limit,
      hasMore: response.hasMore ?? nextOffset !== null,
      nextOffset,
    };
  }
}
