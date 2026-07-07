import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment.development';

import {
  IndexedEnergyAverage,
  LatestIndexedEnergyAveragesResponse,
  UpdateIndexedEnergyAverageRequest,
} from '../models/indexed-energy-average.model';

@Injectable({
  providedIn: 'root',
})
export class IndexedEnergyAverageService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getLatestAverages(): Observable<LatestIndexedEnergyAveragesResponse> {
    return this.http.get<LatestIndexedEnergyAveragesResponse>(
      `${this.apiUrl}/api/indexed-energy-averages/latest`,
    );
  }

  updateAverage(
    id: string,
    payload: UpdateIndexedEnergyAverageRequest,
  ): Observable<IndexedEnergyAverage> {
    return this.http.patch<IndexedEnergyAverage>(
      `${this.apiUrl}/api/indexed-energy-averages/${id}`,
      payload,
    );
  }
}