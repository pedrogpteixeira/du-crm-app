import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, filter, finalize, of, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

import {
  IndexedEnergyAverage,
  LatestIndexedEnergyAveragesResponse,
  UpdateIndexedEnergyAverageRequest,
} from '../models/indexed-energy-average.model';
import { NotificationService } from './notification';

@Injectable({
  providedIn: 'root',
})
export class IndexedEnergyAverageService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = environment.apiUrl;

  private latestAveragesCache: LatestIndexedEnergyAveragesResponse | null = null;
  private latestAveragesRequest$: Observable<LatestIndexedEnergyAveragesResponse> | null = null;
  private latestAveragesRequestVersion = 0;

  private readonly latestAveragesInvalidatedSubject = new Subject<void>();
  readonly latestAveragesInvalidated$ = this.latestAveragesInvalidatedSubject.asObservable();

  constructor() {
    this.notificationService.newNotifications$
      .pipe(
        filter((notification) => notification.resource === 'omie'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.invalidateLatestAveragesCache();
      });
  }

  getLatestAverages(forceRefresh = false): Observable<LatestIndexedEnergyAveragesResponse> {
    if (!forceRefresh && this.latestAveragesCache) {
      return of(this.latestAveragesCache);
    }

    if (!forceRefresh && this.latestAveragesRequest$) {
      return this.latestAveragesRequest$;
    }

    const requestVersion = ++this.latestAveragesRequestVersion;

    const request$ = this.http
      .get<LatestIndexedEnergyAveragesResponse>(`${this.apiUrl}/api/indexed-energy-averages/latest`)
      .pipe(
        tap((response) => {
          if (requestVersion === this.latestAveragesRequestVersion) {
            this.latestAveragesCache = response;
          }
        }),
        finalize(() => {
          if (this.latestAveragesRequest$ === request$) {
            this.latestAveragesRequest$ = null;
          }
        }),
        shareReplay({
          bufferSize: 1,
          refCount: false,
        }),
      );

    this.latestAveragesRequest$ = request$;
    return request$;
  }

  updateAverage(
    id: string,
    payload: UpdateIndexedEnergyAverageRequest,
  ): Observable<IndexedEnergyAverage> {
    return this.http
      .patch<IndexedEnergyAverage>(`${this.apiUrl}/api/indexed-energy-averages/${id}`, payload)
      .pipe(
        tap((updatedAverage) => {
          this.updateAverageInCache(updatedAverage);
        }),
      );
  }

  invalidateLatestAveragesCache(): void {
    this.latestAveragesCache = null;

    // Qualquer resposta iniciada antes desta invalidação deixa de poder
    // repovoar a cache com dados potencialmente antigos.
    this.latestAveragesRequestVersion += 1;
    this.latestAveragesRequest$ = null;

    this.latestAveragesInvalidatedSubject.next();
  }

  private updateAverageInCache(updatedAverage: IndexedEnergyAverage): void {
    if (!this.latestAveragesCache) {
      return;
    }

    this.latestAveragesCache = {
      ...this.latestAveragesCache,
      [updatedAverage.periodType]: updatedAverage,
    };
  }
}
