import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment.development';

export type ProductType = 'electricity' | 'gas' | 'dual';
export type Segment = 'residential' | 'business';
export type TariffType = 'simple' | 'bi_hourly' | 'tri_hourly';

export interface SimulatorRequest {
  productType: ProductType;
  segment: Segment;
  tariffType: TariffType;
  powerKva: number;
  monthlyConsumptionKwh: number;
}

export interface SimulatorResult {
  tariff: {
    id: string;
    companyId: string;
    name: string;
    productType: string;
    segment: string;
    tariffType: string;
    powerKva: number;
    powerPricePerDay: number;
    singleEnergyPrice: number;
    active: boolean;
    provider: {
      id: string;
      name: string;
    };
  };
  simulation: {
    estimatedMonthlyCost: number;
    details: {
      days: number;
      fixedCost: number;
      energyCost: number;
      totalCost: number;
    };
  };
}

@Injectable({
  providedIn: 'root',
})
export class SimulatorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  simulate(payload: SimulatorRequest): Observable<SimulatorResult[]> {
    return this.http.post<SimulatorResult[]>(
      `${this.apiUrl}/api/simulator/calculate`,
      payload,
    );
  }
}