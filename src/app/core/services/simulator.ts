import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment.development';

export type ProductType = 'electricity' | 'gas' | 'dual';
export type Segment = 'residential' | 'business' | 'condominium';
export type TariffType = 'simple' | 'bi_hourly' | 'tri_hourly' | 'tetra_hourly';
export type CycleType = 'daily' | 'weekly';

export interface InvoiceComparisonRequest {
  currentProvider?: string;

  productType: ProductType;
  segment?: Segment;

  tariffType?: TariffType;
  cycleType?: CycleType;

  powerKva?: number;
  gasTier?: number;

  days?: number;

  currentInvoiceAmount: number;

  electricityConsumptionKwh?: number;
  gasConsumptionKwh?: number;

  electricityConsumption?: {
    foraVazio?: number;
    vazio?: number;
    superVazio?: number;
    ponta?: number;
    cheias?: number;
  };
}

export type SimulationProductType = 'electricity' | 'gas' | 'dual';
export type SimulationSegment = 'residential' | 'business' | 'condominium';
export type SimulationTariffType =
  | 'simple'
  | 'bi_hourly'
  | 'tri_hourly'
  | 'tetra_hourly';
export type SimulationCycleType = 'daily' | 'weekly';

export interface CreateSimulationTariffRequest {
  companyId: string;
  name: string;

  productType: SimulationProductType;
  segment?: SimulationSegment;

  tariffType?: SimulationTariffType;
  cycleType?: SimulationCycleType;

  powerKva?: number;
  gasTier?: number;

  powerPricePerDay?: number;
  fixedTermPerDay?: number;

  singleEnergyPrice?: number;
  gasEnergyPrice?: number;

  foraVazioEnergyPrice?: number;
  vazioEnergyPrice?: number;
  pontaEnergyPrice?: number;
  cheiasEnergyPrice?: number;
  superVazioEnergyPrice?: number;

  startDate?: string;
  endDate?: string;
}

export interface InvoiceComparisonResponse {
  current: {
    provider?: string;
    invoiceAmount: number;
    days: number;
  };

  offers: InvoiceComparisonOffer[];
}

export interface InvoiceComparisonOffer {
  tariff: SimulationTariff;

  simulation: {
    estimatedMonthlyCost: number;
    details: {
      days: number;
      fixedCost: number;
      energyCost: number;
      totalCost: number;

      electricityCost?: {
        fixedCost: number;
        energyCost: number;
        totalCost: number;
      };

      gasCost?: {
        fixedCost: number;
        energyCost: number;
        totalCost: number;
      };
    };
  };

  commissionValue?: number;

  comparison: {
    monthlySaving: number;
    yearlySaving: number;
    savingPercentage: number;
    isBetterOffer: boolean;
  };
}

export interface SimulatorRequest {
  productType: 'electricity' | 'gas' | 'dual';
  segment: 'residential' | 'business';
  tariffType: 'simple' | 'bi_hourly' | 'tri_hourly';
  powerKva?: number;
  monthlyConsumptionKwh?: number;
  gasTier?: number;
  gasConsumptionKwh?: number;
}

export interface SimulatorResult {
  tariff: SimulationTariff;

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

export interface SimulationTariff {
  id: string;

  provider: {
    id: string;
    name: string;
  };

  name: string;

  productType: ProductType;
  segment?: Segment;

  tariffType?: TariffType;
  cycleType?: CycleType;

  powerKva?: number;
  gasTier?: number;

  powerPricePerDay?: number;
  fixedTermPerDay?: number;

  singleEnergyPrice?: number;
  gasEnergyPrice?: number;

  foraVazioEnergyPrice?: number;
  vazioEnergyPrice?: number;
  pontaEnergyPrice?: number;
  cheiasEnergyPrice?: number;
  superVazioEnergyPrice?: number;

  startDate?: string;
  endDate?: string;

  active: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SimulatorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  simulate(
    payload: SimulatorRequest,
  ): Observable<SimulatorResult[]> {
    return this.http.post<SimulatorResult[]>(
      `${this.apiUrl}/api/simulator`,
      payload,
    );
  }

  compareInvoice(
    payload: InvoiceComparisonRequest,
  ): Observable<InvoiceComparisonResponse> {
    return this.http.post<InvoiceComparisonResponse>(
      `${this.apiUrl}/api/simulator/invoice-compare`,
      payload,
    );
  }

  createSimulationTariff(
    payload: CreateSimulationTariffRequest,
  ) {
    return this.http.post(
      `${this.apiUrl}/api/simulator/tariffs`,
      payload,
    );
  }
}