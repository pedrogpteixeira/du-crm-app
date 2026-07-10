import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment.development';

export type ProductType = 'electricity' | 'gas' | 'dual';
export type ElectricityPriceMode = 'fixed' | 'indexed';
export type GasPriceMode = 'fixed' | 'indexed';
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

  electricityPriceMode?: ElectricityPriceMode;
  gasPriceMode?: GasPriceMode;

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

  salesCommission?: number;

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
  electricityPriceMode?: ElectricityPriceMode;
  gasPriceMode?: GasPriceMode;
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

  salesCommission?: number;

  startDate?: string;
  endDate?: string;

  active: boolean;
}

export interface SimulationTariffFilters {
  name?: string;
  companyId?: string;
  segment?: Segment;
  productType?: ProductType;
  tariffType?: TariffType;
}

export type UpdateSimulationTariffRequest =
  Partial<CreateSimulationTariffRequest> & {
    active?: boolean;
  };

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
    return this.http.post<SimulationTariff>(
      `${this.apiUrl}/api/simulator/tariffs`,
      payload,
      {
        observe: 'response',
      },
    );
  }

  getSimulationTariffs(
    filters: SimulationTariffFilters,
  ): Observable<SimulationTariff[]> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== '',
      ),
    );

    return this.http.get<SimulationTariff[]>(
      `${this.apiUrl}/api/simulator/tariffs`,
      { params },
    );
  }

  updateSimulationTariff(
    id: string,
    payload: UpdateSimulationTariffRequest,
  ): Observable<SimulationTariff> {
    return this.http.patch<SimulationTariff>(
      `${this.apiUrl}/api/simulator/tariffs/${id}`,
      payload,
    );
  }

  deleteSimulationTariff(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/api/simulator/tariffs/${id}`,
    );
  }
}