import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, finalize, of, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AnalyticsDirectDebitAnalytics,
  AnalyticsProductsAnalytics,
  AnalyticsProviderId,
  AnalyticsRegistrationNamesAnalytics,
  AnalyticsSegmentsAnalytics,
  AnalyticsStatesAnalytics,
  AnalyticsSvaAnalytics,
} from '../models/analytics.model';

interface AnalyticsCacheEntry<T> {
  data: T | null;
  request$: Observable<T> | null;
  lastLoadedAt: number | null;
}

interface AnalyticsResponseMap {
  states: AnalyticsStatesAnalytics;
  registrationNames: AnalyticsRegistrationNamesAnalytics;
  products: AnalyticsProductsAnalytics;
  segments: AnalyticsSegmentsAnalytics;
  directDebitRegistrationNames: AnalyticsDirectDebitAnalytics;
  sva: AnalyticsSvaAnalytics;
}

type AnalyticsResourceKey = keyof AnalyticsResponseMap;
type ProviderAnalyticsCache = {
  [K in AnalyticsResourceKey]: AnalyticsCacheEntry<AnalyticsResponseMap[K]>;
};

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * A cache é separada por provider e por análise. Assim, trocar de
   * comercializadora reutiliza apenas os dados da própria comercializadora.
   */
  private readonly providerCaches: Record<AnalyticsProviderId, ProviderAnalyticsCache> = {
    repsol: this.createProviderCache(),
    'galp-power-gas': this.createProviderCache(),
  };

  getStates(
    provider: AnalyticsProviderId,
    forceRefresh = false,
  ): Observable<AnalyticsStatesAnalytics> {
    return this.getProviderResource(provider, 'states', 'states', forceRefresh);
  }

  getRegistrationNames(
    provider: AnalyticsProviderId,
    forceRefresh = false,
  ): Observable<AnalyticsRegistrationNamesAnalytics> {
    return this.getProviderResource(
      provider,
      'registrationNames',
      'registration-names',
      forceRefresh,
    );
  }

  getProducts(
    provider: AnalyticsProviderId,
    forceRefresh = false,
  ): Observable<AnalyticsProductsAnalytics> {
    return this.getProviderResource(provider, 'products', 'products', forceRefresh);
  }

  getSegments(
    provider: AnalyticsProviderId,
    forceRefresh = false,
  ): Observable<AnalyticsSegmentsAnalytics> {
    return this.getProviderResource(provider, 'segments', 'segments', forceRefresh);
  }

  getDirectDebitRegistrationNames(
    provider: AnalyticsProviderId,
    forceRefresh = false,
  ): Observable<AnalyticsDirectDebitAnalytics> {
    return this.getProviderResource(
      provider,
      'directDebitRegistrationNames',
      'direct-debit/registration-names',
      forceRefresh,
    );
  }

  getSva(
    provider: AnalyticsProviderId,
    forceRefresh = false,
  ): Observable<AnalyticsSvaAnalytics> {
    return this.getProviderResource(provider, 'sva', 'sva', forceRefresh);
  }

  // Métodos explícitos preservados para a API pública do service.
  getRepsolStates(forceRefresh = false): Observable<AnalyticsStatesAnalytics> {
    return this.getStates('repsol', forceRefresh);
  }

  getRepsolRegistrationNames(
    forceRefresh = false,
  ): Observable<AnalyticsRegistrationNamesAnalytics> {
    return this.getRegistrationNames('repsol', forceRefresh);
  }

  getRepsolProducts(forceRefresh = false): Observable<AnalyticsProductsAnalytics> {
    return this.getProducts('repsol', forceRefresh);
  }

  getRepsolSegments(forceRefresh = false): Observable<AnalyticsSegmentsAnalytics> {
    return this.getSegments('repsol', forceRefresh);
  }

  getRepsolDirectDebitRegistrationNames(
    forceRefresh = false,
  ): Observable<AnalyticsDirectDebitAnalytics> {
    return this.getDirectDebitRegistrationNames('repsol', forceRefresh);
  }

  getRepsolSva(forceRefresh = false): Observable<AnalyticsSvaAnalytics> {
    return this.getSva('repsol', forceRefresh);
  }

  getGalpPowerGasStates(forceRefresh = false): Observable<AnalyticsStatesAnalytics> {
    return this.getStates('galp-power-gas', forceRefresh);
  }

  getGalpPowerGasRegistrationNames(
    forceRefresh = false,
  ): Observable<AnalyticsRegistrationNamesAnalytics> {
    return this.getRegistrationNames('galp-power-gas', forceRefresh);
  }

  getGalpPowerGasProducts(
    forceRefresh = false,
  ): Observable<AnalyticsProductsAnalytics> {
    return this.getProducts('galp-power-gas', forceRefresh);
  }

  getGalpPowerGasSegments(
    forceRefresh = false,
  ): Observable<AnalyticsSegmentsAnalytics> {
    return this.getSegments('galp-power-gas', forceRefresh);
  }

  getGalpPowerGasDirectDebitRegistrationNames(
    forceRefresh = false,
  ): Observable<AnalyticsDirectDebitAnalytics> {
    return this.getDirectDebitRegistrationNames('galp-power-gas', forceRefresh);
  }

  getGalpPowerGasSva(forceRefresh = false): Observable<AnalyticsSvaAnalytics> {
    return this.getSva('galp-power-gas', forceRefresh);
  }

  /**
   * Dados completos preservados para a futura exportação Excel.
   * Nunca devolve apenas o subset visível no gráfico.
   */
  getCachedRegistrationNames(
    provider: AnalyticsProviderId,
  ): AnalyticsRegistrationNamesAnalytics | null {
    return this.providerCaches[provider].registrationNames.data;
  }

  getCachedDirectDebitRegistrationNames(
    provider: AnalyticsProviderId,
  ): AnalyticsDirectDebitAnalytics | null {
    return this.providerCaches[provider].directDebitRegistrationNames.data;
  }

  getLastLoadedAt(
    provider: AnalyticsProviderId,
    resource: AnalyticsResourceKey,
  ): number | null {
    return this.providerCaches[provider][resource].lastLoadedAt;
  }

  /**
   * Compatibilidade com eventuais consumidores existentes.
   */
  getCachedRepsolRegistrationNames(): AnalyticsRegistrationNamesAnalytics | null {
    return this.getCachedRegistrationNames('repsol');
  }

  getCachedRepsolDirectDebitRegistrationNames(): AnalyticsDirectDebitAnalytics | null {
    return this.getCachedDirectDebitRegistrationNames('repsol');
  }

  private createProviderCache(): ProviderAnalyticsCache {
    return {
      states: this.createCacheEntry<AnalyticsStatesAnalytics>(),
      registrationNames: this.createCacheEntry<AnalyticsRegistrationNamesAnalytics>(),
      products: this.createCacheEntry<AnalyticsProductsAnalytics>(),
      segments: this.createCacheEntry<AnalyticsSegmentsAnalytics>(),
      directDebitRegistrationNames:
        this.createCacheEntry<AnalyticsDirectDebitAnalytics>(),
      sva: this.createCacheEntry<AnalyticsSvaAnalytics>(),
    };
  }

  private createCacheEntry<T>(): AnalyticsCacheEntry<T> {
    return {
      data: null,
      request$: null,
      lastLoadedAt: null,
    };
  }

  private getProviderResource<K extends AnalyticsResourceKey>(
    provider: AnalyticsProviderId,
    resource: K,
    resourcePath: string,
    forceRefresh: boolean,
  ): Observable<AnalyticsResponseMap[K]> {
    const cache = this.providerCaches[provider][resource];
    const path = `/api/analytics/${provider}/${resourcePath}`;

    return this.getCached(cache, path, forceRefresh);
  }

  private getCached<T>(
    cache: AnalyticsCacheEntry<T>,
    path: string,
    forceRefresh: boolean,
  ): Observable<T> {
    if (!forceRefresh && cache.data) {
      return of(cache.data);
    }

    if (!forceRefresh && cache.request$) {
      return cache.request$;
    }

    const request$ = this.http.get<T>(`${this.apiUrl}${path}`).pipe(
      tap((data) => {
        cache.data = data;
        cache.lastLoadedAt = Date.now();
      }),
      finalize(() => {
        if (cache.request$ === request$) {
          cache.request$ = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    cache.request$ = request$;
    return request$;
  }
}
