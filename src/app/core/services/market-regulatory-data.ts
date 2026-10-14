import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ElectricityLossProfile,
  ElectricityLossProfileFilters,
  ElectricityNetworkAccessFilters,
  ElectricityNetworkAccessRate,
  GasNetworkAccessFilters,
  GasNetworkAccessRate,
  MarketRegulatoryPage,
} from '../models/market-regulatory-data.model';

@Injectable({ providedIn: 'root' })
export class MarketRegulatoryDataService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/regulatory-data`;

  getElectricityNetworkAccess(
    offset = 0,
    limit = 50,
    filters: ElectricityNetworkAccessFilters = {},
  ): Observable<MarketRegulatoryPage<ElectricityNetworkAccessRate>> {
    const params = this.buildParams(offset, limit, filters);

    return this.http.get<MarketRegulatoryPage<ElectricityNetworkAccessRate>>(
      `${this.baseUrl}/network-access`,
      { params },
    );
  }

  getGasNetworkAccess(
    offset = 0,
    limit = 50,
    filters: GasNetworkAccessFilters = {},
  ): Observable<MarketRegulatoryPage<GasNetworkAccessRate>> {
    const params = this.buildParams(offset, limit, filters);

    return this.http.get<MarketRegulatoryPage<GasNetworkAccessRate>>(
      `${this.baseUrl}/gas-network-access`,
      { params },
    );
  }

  getElectricityLossProfiles(
    offset = 0,
    limit = 50,
    filters: ElectricityLossProfileFilters = {},
  ): Observable<MarketRegulatoryPage<ElectricityLossProfile>> {
    const params = this.buildParams(offset, limit, filters);

    return this.http.get<MarketRegulatoryPage<ElectricityLossProfile>>(
      `${this.baseUrl}/electricity-loss-profiles`,
      { params },
    );
  }

  private buildParams<TFilters extends object>(
    offset: number,
    limit: number,
    filters: TFilters,
  ): HttpParams {
    let params = new HttpParams()
      .set('offset', String(offset))
      .set('limit', String(limit));

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      params = params.set(key, String(value));
    }

    return params;
  }
}
