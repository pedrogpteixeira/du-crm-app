import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, filter, finalize, of, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

import { IndexedGasPrice, UpdateIndexedGasPriceRequest } from '../models/indexed-gas-price.model';
import { NotificationService } from './notification';

@Injectable({
  providedIn: 'root',
})
export class IndexedGasPriceService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = environment.apiUrl;

  private pricesCache: IndexedGasPrice[] | null = null;
  private pricesRequest$: Observable<IndexedGasPrice[]> | null = null;
  private pricesRequestVersion = 0;

  private readonly pricesInvalidatedSubject = new Subject<void>();
  readonly pricesInvalidated$ = this.pricesInvalidatedSubject.asObservable();

  constructor() {
    this.notificationService.newNotifications$
      .pipe(
        filter((notification) => notification.resource === 'mibgas'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.invalidatePricesCache();
      });
  }

  getPrices(forceRefresh = false): Observable<IndexedGasPrice[]> {
    if (!forceRefresh && this.pricesCache) {
      return of(this.pricesCache);
    }

    if (!forceRefresh && this.pricesRequest$) {
      return this.pricesRequest$;
    }

    const requestVersion = ++this.pricesRequestVersion;

    const request$ = this.http.get<IndexedGasPrice[]>(`${this.apiUrl}/api/indexed-gas-prices`).pipe(
      tap((prices) => {
        if (requestVersion === this.pricesRequestVersion) {
          this.pricesCache = prices;
        }
      }),
      finalize(() => {
        if (this.pricesRequest$ === request$) {
          this.pricesRequest$ = null;
        }
      }),
      shareReplay({
        bufferSize: 1,
        refCount: false,
      }),
    );

    this.pricesRequest$ = request$;
    return request$;
  }

  getPriceById(id: string): Observable<IndexedGasPrice> {
    return this.http.get<IndexedGasPrice>(`${this.apiUrl}/api/indexed-gas-prices/${id}`);
  }

  updatePrice(id: string, payload: UpdateIndexedGasPriceRequest): Observable<IndexedGasPrice> {
    return this.http
      .patch<IndexedGasPrice>(`${this.apiUrl}/api/indexed-gas-prices/${id}`, payload)
      .pipe(
        tap((updatedPrice) => {
          this.updatePriceInCache(updatedPrice);
        }),
      );
  }

  invalidatePricesCache(): void {
    this.pricesCache = null;

    // Impede que um GET iniciado antes da notificação volte a preencher a
    // cache com um snapshot anterior à atualização recebida.
    this.pricesRequestVersion += 1;
    this.pricesRequest$ = null;

    this.pricesInvalidatedSubject.next();
  }

  private updatePriceInCache(updatedPrice: IndexedGasPrice): void {
    if (!this.pricesCache) {
      return;
    }

    this.pricesCache = this.pricesCache.map((price) =>
      price.id === updatedPrice.id ? updatedPrice : price,
    );
  }
}
