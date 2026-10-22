import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, shareReplay, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ContractExportFieldsResponse,
  ContractExportProvider,
  ContractExportRequest,
} from '../utils/contract-export';

@Injectable({ providedIn: 'root' })
export class ContractExportService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private readonly fieldsCache = new Map<
    ContractExportProvider,
    Observable<ContractExportFieldsResponse>
  >();
  private readonly fieldPreferences = new Map<ContractExportProvider, string[]>();

  getFields(provider: ContractExportProvider): Observable<ContractExportFieldsResponse> {
    const cached = this.fieldsCache.get(provider);

    if (cached) {
      return cached;
    }

    const request = this.http
      .get<ContractExportFieldsResponse>(
        `${this.apiUrl}/api/contracts/export/${encodeURIComponent(provider)}/fields`,
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

  exportContracts(
    provider: ContractExportProvider,
    payload: ContractExportRequest,
  ): Observable<HttpResponse<Blob>> {
    return this.http.post(
      `${this.apiUrl}/api/contracts/export/${encodeURIComponent(provider)}`,
      payload,
      {
        observe: 'response',
        responseType: 'blob',
      },
    );
  }

  getFieldPreference(provider: ContractExportProvider): string[] | null {
    const fields = this.fieldPreferences.get(provider);
    return fields ? [...fields] : null;
  }

  setFieldPreference(provider: ContractExportProvider, fields: readonly string[]): void {
    this.fieldPreferences.set(provider, [...fields]);
  }
}
