import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  BackupAtlasStatus,
  BackupCostEstimate,
  BackupHealth,
  BackupHistoryResponse,
  BackupOverview,
  BackupRunDetail,
  BackupRunSummary,
  BackupStorage,
} from '../models/admin-backup.model';

@Injectable({ providedIn: 'root' })
export class AdminBackupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/admin/backups`;

  private overviewRequest?: Observable<BackupOverview>;
  private healthRequest?: Observable<BackupHealth>;
  private atlasRequest?: Observable<BackupAtlasStatus>;
  private storageRequest?: Observable<BackupStorage>;
  private costRequest?: Observable<BackupCostEstimate>;
  private historyRequest?: Observable<BackupRunSummary[]>;
  private readonly detailRequests = new Map<string, Observable<BackupRunDetail>>();

  getOverview(refresh = false): Observable<BackupOverview> {
    if (refresh || !this.overviewRequest) {
      this.overviewRequest = this.http
        .get<BackupOverview>(`${this.baseUrl}/overview`)
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.overviewRequest;
  }

  getHealth(refresh = false): Observable<BackupHealth> {
    if (refresh || !this.healthRequest) {
      this.healthRequest = this.http
        .get<BackupHealth>(`${this.baseUrl}/health`)
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.healthRequest;
  }

  getAtlas(refresh = false): Observable<BackupAtlasStatus> {
    if (refresh || !this.atlasRequest) {
      this.atlasRequest = this.http
        .get<BackupAtlasStatus>(`${this.baseUrl}/atlas`)
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.atlasRequest;
  }

  getStorage(refresh = false): Observable<BackupStorage> {
    if (refresh || !this.storageRequest) {
      this.storageRequest = this.http
        .get<BackupStorage>(`${this.baseUrl}/storage`)
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.storageRequest;
  }

  getCostEstimate(refresh = false): Observable<BackupCostEstimate> {
    if (refresh || !this.costRequest) {
      this.costRequest = this.http
        .get<BackupCostEstimate>(`${this.baseUrl}/cost-estimate`)
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.costRequest;
  }

  getHistory(refresh = false, limit = 50): Observable<BackupRunSummary[]> {
    if (refresh || !this.historyRequest) {
      const params = new HttpParams().set('limit', String(limit));
      this.historyRequest = this.http
        .get<BackupHistoryResponse | BackupRunSummary[]>(`${this.baseUrl}/history`, { params })
        .pipe(
          map((response) =>
            Array.isArray(response)
              ? response
              : (response.runs ?? response.items ?? response.history ?? []),
          ),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.historyRequest;
  }

  getRunDetail(runId: string, refresh = false): Observable<BackupRunDetail> {
    const normalizedId = runId.trim();
    const cached = this.detailRequests.get(normalizedId);
    if (!refresh && cached) {
      return cached;
    }

    const request = this.http
      .get<BackupRunDetail>(`${this.baseUrl}/${encodeURIComponent(normalizedId)}`)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));

    this.detailRequests.set(normalizedId, request);
    return request;
  }
}
