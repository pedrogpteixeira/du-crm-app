import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

import {
  IndexedGasPrice,
  UpdateIndexedGasPriceRequest,
} from '../models/indexed-gas-price.model';

@Injectable({
  providedIn: 'root',
})
export class IndexedGasPriceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getPrices(): Observable<IndexedGasPrice[]> {
    return this.http.get<IndexedGasPrice[]>(
      `${this.apiUrl}/api/indexed-gas-prices`,
    );
  }

  getPriceById(id: string): Observable<IndexedGasPrice> {
    return this.http.get<IndexedGasPrice>(
      `${this.apiUrl}/api/indexed-gas-prices/${id}`,
    );
  }

  updatePrice(
    id: string,
    payload: UpdateIndexedGasPriceRequest,
  ): Observable<IndexedGasPrice> {
    return this.http.patch<IndexedGasPrice>(
      `${this.apiUrl}/api/indexed-gas-prices/${id}`,
      payload,
    );
  }
}