import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { RenErc, RenErcReference } from '../models/ren-erc.model';

@Injectable({
  providedIn: 'root',
})
export class RenErcService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/api/regulatory-data/ren-erc`;

  getRenErcRange(startDate: string, endDate: string): Observable<RenErc[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.get<RenErc[]>(`${this.baseUrl}/range`, { params });
  }

  getLatestRenErc(): Observable<RenErc> {
    return this.http.get<RenErc>(`${this.baseUrl}/latest`);
  }

  getRenErcReference(
    startDate?: string,
    endDate?: string,
    lookbackDays?: number,
  ): Observable<RenErcReference> {
    let params = new HttpParams();

    if (startDate) {
      params = params.set('startDate', startDate);
    }

    if (endDate) {
      params = params.set('endDate', endDate);
    }

    if (lookbackDays !== undefined) {
      params = params.set('lookbackDays', String(lookbackDays));
    }

    return this.http.get<RenErcReference>(`${this.baseUrl}/reference`, { params });
  }
}
