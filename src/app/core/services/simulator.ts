import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, finalize, of, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

export type ProductType =
  | 'electricity'
  | 'gas'
  | 'dual';

export type PriceMode =
  | 'fixed'
  | 'indexed';

export type ElectricityPriceMode = PriceMode;
export type GasPriceMode = PriceMode;

export type Segment =
  | 'residential'
  | 'business'
  | 'condominium';

export type TariffType =
  | 'simple'
  | 'bi_hourly'
  | 'tri_hourly'
  | 'tetra_hourly';

export type CycleType =
  | 'daily'
  | 'weekly';

export type SimulationCalculationStrategy =
  | 'legacy_fixed'
  | 'legacy_indexed'
  | 'indexed_cost_plus'
  | 'adjusted_factor_plus'
  | 'fixed_hedge_plus_system_cost'
  | 'weighted_mix'
  | 'gas_adjusted';

export type SimulationMarketSource =
  | 'omie'
  | 'mibgas';

export type SimulationMarketReference =
  | 'isp'
  | 'hourly'
  | 'daily_average'
  | 'monthly_average';

export type SimulationSystemCostSource =
  | 'ren_erc'
  | 'static'
  | 'composite';

export type SimulationLossSource =
  | 'erse'
  | 'static'
  | 'matrix';

export type SimulationMarginKind =
  | 'K'
  | 'OPERATING_MARGIN'
  | 'FEE';

export type SimulationMarginUnit =
  | 'EUR_MWH'
  | 'CENT_KWH';

export type SimulationNetworkAccessMode =
  | 'included'
  | 'excluded';

export type SimulationCommissionMode =
  | 'team_table'
  | 'formula_margin'
  | 'hybrid';

export interface SimulationFormulaMargin {
  kind: SimulationMarginKind;
  value: number;
  unit: SimulationMarginUnit;
}

export interface SimulationWeightedComponent {
  code: string;
  weight: number;
  strategy: SimulationCalculationStrategy;
  marketSource?: SimulationMarketSource;
  marketReference?: SimulationMarketReference;
  systemCostSource?: SimulationSystemCostSource;
  lossSource?: SimulationLossSource;
  margin?: SimulationFormulaMargin;
  networkAccessMode?: SimulationNetworkAccessMode;
}

export interface SimulationCalculationProfileEnergyConfig {
  strategy: SimulationCalculationStrategy;
  marketSource?: SimulationMarketSource;
  marketReference?: SimulationMarketReference;
  systemCostSource?: SimulationSystemCostSource;
  lossSource?: SimulationLossSource;
  margin?: SimulationFormulaMargin;
  networkAccessMode?: SimulationNetworkAccessMode;
  components?: SimulationWeightedComponent[];
}

/**
 * `true` significa que o componente já está incorporado no preço/fórmula
 * comercial e não deve ser acrescentado novamente pelo pricing engine.
 */
export interface SimulationCalculationProfileIncludedComponents {
  networkAccessPower?: boolean;
  networkAccessFixedTerm?: boolean;
  networkAccessEnergy?: boolean;
  losses?: boolean;
  renSystemCosts?: boolean;
  mfrr?: boolean;
  guaranteesOfOrigin?: boolean;
  socialTariffFinancing?: boolean;
}

export interface SimulationCalculationProfile {
  id: string;
  familyCode: string;
  commercializerId: string;
  productType: ProductType;
  electricity?: SimulationCalculationProfileEnergyConfig;
  gas?: SimulationCalculationProfileEnergyConfig;
  includedComponents?: SimulationCalculationProfileIncludedComponents;
  commissionMode: SimulationCommissionMode;
  active: boolean;
  version: number;
  previousVersionId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateSimulationCalculationProfileRequest {
  familyCode: string;
  commercializerId: string;
  productType: ProductType;
  electricity?: SimulationCalculationProfileEnergyConfig;
  gas?: SimulationCalculationProfileEnergyConfig;
  includedComponents?: SimulationCalculationProfileIncludedComponents;
  commissionMode?: SimulationCommissionMode;
  active?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export type UpdateSimulationCalculationProfileRequest =
  Partial<CreateSimulationCalculationProfileRequest> & {
    active?: boolean;
  };

export type CreateSimulationCalculationProfileVersionRequest =
  Partial<CreateSimulationCalculationProfileRequest>;

export type SimulationPaymentMethod =
  | 'direct_debit'
  | 'multibanco'
  | 'other';

export type SimulationInvoiceDelivery =
  | 'electronic'
  | 'paper';

export interface SimulationConsumptionInterval {
  startAt: string;
  consumptionKwh: number;
  tariffPeriod?: string;
}

export interface SimulationElectricityConsumptionProfile {
  source?: string;
  intervalMinutes: number;
  intervals?: SimulationConsumptionInterval[];
}

export interface SimulationElectricityConsumptionByTariffPeriod {
  foraVazio?: number;
  vazio?: number;
  superVazio?: number;
  ponta?: number;
  cheias?: number;
}

export interface SimulationCommercialContext {
  electricityCustomerClass?: string;
  contractedPowerKw?: number;
  peakPowerKw?: number;
  voltageLevel?: string;
  gasNetworkLevel?: string;
  supplyStartDate?: string;
  contractTermMonths?: number;
  paymentMethod?: SimulationPaymentMethod;
  invoiceDelivery?: SimulationInvoiceDelivery;
  marginOptionCode?: string;
}

export interface SimulationDiscountConditions {
  electronicInvoice?: boolean;
  directDebit?: boolean;
  welcomeBonus?: boolean;
  sva?: boolean;
  loyalty?: boolean;
  gasBonus?: boolean;

  PEL?: boolean;
  PELPlus?: boolean;
  MGI?: boolean;
}

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
  /**
   * Consumos agregados por período tarifário. Podem coexistir com o
   * perfil intervalar; o backend decide qual a granularidade a usar.
   */
  electricityConsumption?:
    SimulationElectricityConsumptionByTariffPeriod;
  /** Perfil intervalar opcional, usado apenas quando o cliente o fornece. */
  electricityConsumptionProfile?:
    SimulationElectricityConsumptionProfile;
  commercialContext?: SimulationCommercialContext;
  isLoyalty?: boolean;
  discountConditions?: SimulationDiscountConditions;
}

export type SimulationProductType =
  | 'electricity'
  | 'gas'
  | 'dual';

export type SimulationSegment =
  | 'residential'
  | 'business'
  | 'condominium';

export type SimulationTariffType =
  | 'simple'
  | 'bi_hourly'
  | 'tri_hourly'
  | 'tetra_hourly';

export type SimulationCycleType =
  | 'daily'
  | 'weekly';

export interface TariffDiscounts {
  electronicInvoice?: number;
  directDebit?: number;
  welcomeBonus?: number;
  sva?: number;
  PEL?: number;
  PELPlus?: number;
  MGI?: number;
  loyalty?: number;
  gasBonus?: number;
}

export interface CreateSimulationTariffRequest {
  companyId: string;
  name: string;
  productType: SimulationProductType;
  /** Ausente/nulo = Legacy; preenchido = Advanced. */
  calculationProfileId?: string | null;
  electricityPriceMode?: PriceMode;
  gasPriceMode?: PriceMode;
  segment?: SimulationSegment;
  tariffType?: SimulationTariffType;
  cycleType?: SimulationCycleType;
  powerKva?: number;
  gasTier?: number;
  powerPricePerDay?: number;
  fixedTermPerDay?: number;
  singleEnergyPrice?: number;
  foraVazioEnergyPrice?: number;
  vazioEnergyPrice?: number;
  pontaEnergyPrice?: number;
  cheiasEnergyPrice?: number;
  superVazioEnergyPrice?: number;
  gasEnergyPrice?: number;
  electricityAdjustmentFactor?: number;
  electricityAdditionalCostPerKwh?: number;
  gasLossPercentage?: number;
  gasAdditionalCostPerKwh?: number;
  electricityDiscounts?: TariffDiscounts;
  gasDiscounts?: TariffDiscounts;
  electricityDiscountAppliesToFixedTerm?: boolean;
  gasDiscountAppliesToFixedTerm?: boolean;
  isLoyalty?: boolean;

  salesCommission: number;
  crmCertoCommission?: number;

  observations?: string;
  startDate?: string;
  endDate?: string;
}

export interface IndexedSimulationScenario {
  marketPriceKwh: number;
  finalEnergyPriceKwh: number;
  energyCost: number;
  totalCost: number;
}

export interface IndexedElectricityScenarios {
  daily: IndexedSimulationScenario;
  weekly: IndexedSimulationScenario;
  monthly: IndexedSimulationScenario;
}

export interface IndexedGasScenarios {
  daily: IndexedSimulationScenario;
  nextMonth: IndexedSimulationScenario;
  nextQuarter: IndexedSimulationScenario;
}

export interface EnergyCostBreakdown {
  fixedCostBeforeDiscount: number;
  fixedTermDiscountValue: number;
  fixedCost: number;
  energyCostBeforeDiscount: number;
  energyDiscountValue: number;
  energyCost: number;
  discountPercentage?: number;
  discountValue: number;
  totalCost: number;
}

export interface SingleEnergyCalculation
  extends EnergyCostBreakdown {}

export interface DualEnergyCalculation
  extends EnergyCostBreakdown {
  electricityCost: EnergyCostBreakdown;
  gasCost: EnergyCostBreakdown;
}

export type SimulationEnergyCostDetails =
  EnergyCostBreakdown;

export interface SimulationDetails {
  days: number;
  fixedCostBeforeDiscount?: number;
  fixedTermDiscountValue?: number;
  fixedCost: number;
  energyCostBeforeDiscount: number;
  energyDiscountValue?: number;
  discountPercentage?: number;
  discountValue: number;
  energyCost: number;
  totalCost: number;
  electricityCost?: SimulationEnergyCostDetails;
  gasCost?: SimulationEnergyCostDetails;
  indexedElectricityScenarios?: IndexedElectricityScenarios;
  indexedGasScenarios?: IndexedGasScenarios;
}

export type SimulationCalculationBasis =
  | 'interval'
  | 'tariff_periods'
  | 'daily_average'
  | 'weekly_average'
  | 'monthly_average';

export type InvoiceComparisonMethodology =
  | 'invoice_period_proportional'
  | string;

export interface InvoiceComparisonResponse {
  current: {
    provider?: string;
    invoiceAmount: number;
    days: number;
  };

  periodDays?: number;
  normalizedMonthDays?: number;
  normalizedYearMonths?: number;
  methodology?: InvoiceComparisonMethodology;

  offers: InvoiceComparisonOffer[];
}

export type AdvancedPricingIncludedComponents =
  SimulationCalculationProfileIncludedComponents;

export interface AdvancedPricingCalculationMetadata {
  strategy?: string;
  marketSource?: string;
  regulatorySource?: string;
  regulatoryReferenceDate?: string;
  accessTariffVersion?: string;
}

/**
 * Breakdown técnico opcional devolvido pelo pricing engine Advanced.
 * Os campos numéricos são apresentados tal como chegam da API; o
 * frontend não assume unidades nem executa fórmulas sobre estes valores.
 */
export interface AdvancedPricingBreakdown {
  marketEnergy?: number;
  fixedHedge?: number;
  renSystemCost?: number;
  networkAccess?: number;
  losses?: number;
  operatingMargin?: number;
  guaranteesOfOrigin?: number;
  contractualEnergyPrice?: number;
  normalizedComparableCost?: number;
  includedComponents?: AdvancedPricingIncludedComponents;
  calculationMetadata?: AdvancedPricingCalculationMetadata;
}

export interface InvoiceComparisonOffer {
  tariff: SimulationTariff;

  simulation: {
    /** Legacy compatibility. Prefer normalizedMonthlyCost when available. */
    estimatedMonthlyCost: number;
    details: SimulationDetails;
    calculationBasis?: SimulationCalculationBasis;
    estimated?: boolean;
  };

  invoicePeriodCost?: number;
  normalizedMonthlyCost?: number;
  normalizedAnnualCost?: number;
  normalizedComparableCostEur?: number;

  salesCommission?: number;
  crmCertoCommission?: number;

  /**
   * Margem comercial incorporada no cálculo avançado.
   * É metadata de pricing e não representa comissão da equipa.
   */
  embeddedCommercialMarginEur?: number;

  /** Breakdown técnico do pricing engine Advanced, quando disponibilizado. */
  pricingBreakdown?: AdvancedPricingBreakdown;

  comparison: {
    invoicePeriodSaving?: number;
    monthlySaving: number;
    yearlySaving: number;
    savingPercentage: number;
    isBetterOffer: boolean;
  };
}

export interface SimulatorRequest {
  productType:
    | 'electricity'
    | 'gas'
    | 'dual';
  segment:
    | 'residential'
    | 'business';
  tariffType:
    | 'simple'
    | 'bi_hourly'
    | 'tri_hourly';
  powerKva?: number;
  monthlyConsumptionKwh?: number;
  gasTier?: number;
  gasConsumptionKwh?: number;
}

export interface SimulatorResult {
  tariff: SimulationTariff;

  simulation: {
    estimatedMonthlyCost: number;
    calculationBasis?: SimulationCalculationBasis;
    estimated?: boolean;
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
  companyId?: string;

  provider: {
    id: string;
    name: string;
  };

  name: string;
  productType: ProductType;
  /** Ausente/nulo = Legacy; preenchido = Advanced. */
  calculationProfileId?: string | null;
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
  electricityAdjustmentFactor?: number;
  electricityAdditionalCostPerKwh?: number;
  gasLossPercentage?: number;
  gasAdditionalCostPerKwh?: number;
  electricityDiscounts?: TariffDiscounts;
  gasDiscounts?: TariffDiscounts;
  electricityDiscountAppliesToFixedTerm?: boolean;
  gasDiscountAppliesToFixedTerm?: boolean;
  isLoyalty?: boolean;

  // Mantidos para os endpoints CRUD de tarifas.
  salesCommission?: number;
  crmCertoCommission?: number;

  observations?: string;
  startDate?: string | null;
  endDate?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SimulationTariffFilters {
  name?: string;
  companyId?: string;
  segment?: Segment;
  productType?: ProductType;
  tariffType?: TariffType;
  electricityPriceMode?: ElectricityPriceMode;
  gasPriceMode?: GasPriceMode;
}

export type UpdateSimulationTariffRequest =
  Partial<
    Omit<
      CreateSimulationTariffRequest,
      'startDate' | 'endDate'
    >
  > & {
    startDate?: string | null;
    endDate?: string | null;
    active?: boolean;
  };

@Injectable({
  providedIn: 'root',
})
export class SimulatorService {
  private readonly http =
    inject(HttpClient);

  private readonly apiUrl =
    environment.apiUrl;

  private readonly configurationCacheTtlMs = 60_000;

  private calculationProfilesCache:
    { value: SimulationCalculationProfile[]; loadedAt: number } | null = null;
  private calculationProfilesRequest$:
    Observable<SimulationCalculationProfile[]> | null = null;
  private readonly calculationProfileDetailCache =
    new Map<string, { value: SimulationCalculationProfile; loadedAt: number }>();
  private readonly calculationProfileDetailRequests =
    new Map<string, Observable<SimulationCalculationProfile>>();

  private readonly tariffListCache =
    new Map<string, { value: SimulationTariff[]; loadedAt: number }>();
  private readonly tariffListRequests =
    new Map<string, Observable<SimulationTariff[]>>();
  private readonly tariffDetailCache =
    new Map<string, { value: SimulationTariff; loadedAt: number }>();
  private readonly tariffDetailRequests =
    new Map<string, Observable<SimulationTariff>>();

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
      { observe: 'response' },
    ).pipe(
      tap((response) => {
        this.invalidateTariffCache();

        if (response.body) {
          this.cacheTariffDetail(response.body);
        }
      }),
    );
  }

  getSimulationTariffs(
    filters: SimulationTariffFilters,
    forceRefresh = false,
  ): Observable<SimulationTariff[]> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== '',
      ),
    );
    const cacheKey = JSON.stringify(params);

    if (forceRefresh) {
      this.tariffListCache.clear();
      this.tariffDetailCache.clear();
    }

    const cached = this.tariffListCache.get(cacheKey);

    if (
      !forceRefresh &&
      cached &&
      this.isConfigurationCacheFresh(cached.loadedAt)
    ) {
      return of(cached.value);
    }

    if (!forceRefresh) {
      const pending =
        this.tariffListRequests.get(cacheKey);

      if (pending) {
        return pending;
      }
    }

    const request$ = this.http.get<SimulationTariff[]>(
      `${this.apiUrl}/api/simulator/tariffs`,
      { params },
    ).pipe(
      tap((tariffs) => {
        this.tariffListCache.set(
          cacheKey,
          {
            value: tariffs,
            loadedAt: Date.now(),
          },
        );
        tariffs.forEach((tariff) => this.cacheTariffDetail(tariff));
      }),
      finalize(() => {
        if (this.tariffListRequests.get(cacheKey) === request$) {
          this.tariffListRequests.delete(cacheKey);
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.tariffListRequests.set(cacheKey, request$);
    return request$;
  }

  getSimulationTariffById(
    id: string,
    forceRefresh = false,
  ): Observable<SimulationTariff> {
    if (forceRefresh) {
      this.tariffDetailCache.delete(id);
    }

    const cached = this.tariffDetailCache.get(id);

    if (
      !forceRefresh &&
      cached &&
      this.isConfigurationCacheFresh(cached.loadedAt)
    ) {
      return of(cached.value);
    }

    if (!forceRefresh) {
      const pending =
        this.tariffDetailRequests.get(id);

      if (pending) {
        return pending;
      }
    }

    const request$ = this.http.get<SimulationTariff>(
      `${this.apiUrl}/api/simulator/tariffs/${id}`,
    ).pipe(
      tap((tariff) => this.cacheTariffDetail(tariff)),
      finalize(() => {
        if (this.tariffDetailRequests.get(id) === request$) {
          this.tariffDetailRequests.delete(id);
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.tariffDetailRequests.set(id, request$);
    return request$;
  }

  updateSimulationTariff(
    id: string,
    payload: UpdateSimulationTariffRequest,
  ): Observable<SimulationTariff> {
    return this.http.patch<SimulationTariff>(
      `${this.apiUrl}/api/simulator/tariffs/${id}`,
      payload,
    ).pipe(
      tap((updated) => {
        this.invalidateTariffCache();
        this.cacheTariffDetail(updated);
      }),
    );
  }

  deleteSimulationTariff(
    id: string,
  ): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/api/simulator/tariffs/${id}`,
    ).pipe(
      tap(() => this.invalidateTariffCache()),
    );
  }

  getCalculationProfiles(
    forceRefresh = false,
  ): Observable<SimulationCalculationProfile[]> {
    if (forceRefresh) {
      this.calculationProfilesCache = null;
      this.calculationProfileDetailCache.clear();
    }

    if (
      !forceRefresh &&
      this.calculationProfilesCache &&
      this.isConfigurationCacheFresh(this.calculationProfilesCache.loadedAt)
    ) {
      return of(this.calculationProfilesCache.value);
    }

    if (!forceRefresh && this.calculationProfilesRequest$) {
      return this.calculationProfilesRequest$;
    }

    const request$ = this.http.get<SimulationCalculationProfile[]>(
      `${this.apiUrl}/api/simulator/calculation-profiles`,
    ).pipe(
      tap((profiles) => {
        this.calculationProfilesCache = {
          value: profiles,
          loadedAt: Date.now(),
        };
      }),
      finalize(() => {
        if (this.calculationProfilesRequest$ === request$) {
          this.calculationProfilesRequest$ = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.calculationProfilesRequest$ = request$;
    return request$;
  }

  getCalculationProfileById(
    id: string,
    forceRefresh = false,
  ): Observable<SimulationCalculationProfile> {
    if (forceRefresh) {
      this.calculationProfileDetailCache.delete(id);
    }

    const cached = this.calculationProfileDetailCache.get(id);

    if (
      !forceRefresh &&
      cached &&
      this.isConfigurationCacheFresh(cached.loadedAt)
    ) {
      return of(cached.value);
    }

    if (!forceRefresh) {
      const pending =
        this.calculationProfileDetailRequests.get(id);

      if (pending) {
        return pending;
      }
    }

    const request$ = this.http.get<SimulationCalculationProfile>(
      `${this.apiUrl}/api/simulator/calculation-profiles/${id}`,
    ).pipe(
      tap((profile) => this.cacheCalculationProfileDetail(profile)),
      finalize(() => {
        if (this.calculationProfileDetailRequests.get(id) === request$) {
          this.calculationProfileDetailRequests.delete(id);
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.calculationProfileDetailRequests.set(id, request$);
    return request$;
  }

  createCalculationProfile(
    payload: CreateSimulationCalculationProfileRequest,
  ): Observable<SimulationCalculationProfile> {
    return this.http.post<SimulationCalculationProfile>(
      `${this.apiUrl}/api/simulator/calculation-profiles`,
      payload,
    ).pipe(
      tap((created) => {
        this.invalidateCalculationProfileCache();
        this.cacheCalculationProfileDetail(created);
      }),
    );
  }

  updateCalculationProfile(
    id: string,
    payload: UpdateSimulationCalculationProfileRequest,
  ): Observable<SimulationCalculationProfile> {
    return this.http.patch<SimulationCalculationProfile>(
      `${this.apiUrl}/api/simulator/calculation-profiles/${id}`,
      payload,
    ).pipe(
      tap((updated) => {
        this.invalidateCalculationProfileCache();
        this.cacheCalculationProfileDetail(updated);
      }),
    );
  }

  createCalculationProfileVersion(
    id: string,
    payload: CreateSimulationCalculationProfileVersionRequest,
  ): Observable<SimulationCalculationProfile> {
    return this.http.post<SimulationCalculationProfile>(
      `${this.apiUrl}/api/simulator/calculation-profiles/${id}/versions`,
      payload,
    ).pipe(
      tap((created) => {
        this.invalidateCalculationProfileCache();
        this.cacheCalculationProfileDetail(created);
      }),
    );
  }

  private isConfigurationCacheFresh(loadedAt: number): boolean {
    return Date.now() - loadedAt < this.configurationCacheTtlMs;
  }

  private cacheTariffDetail(tariff: SimulationTariff): void {
    this.tariffDetailCache.set(tariff.id, {
      value: tariff,
      loadedAt: Date.now(),
    });
  }

  private invalidateTariffCache(): void {
    this.tariffListCache.clear();
    this.tariffListRequests.clear();
    this.tariffDetailCache.clear();
    this.tariffDetailRequests.clear();
  }

  private cacheCalculationProfileDetail(
    profile: SimulationCalculationProfile,
  ): void {
    this.calculationProfileDetailCache.set(profile.id, {
      value: profile,
      loadedAt: Date.now(),
    });
  }

  private invalidateCalculationProfileCache(): void {
    this.calculationProfilesCache = null;
    this.calculationProfilesRequest$ = null;
    this.calculationProfileDetailCache.clear();
    this.calculationProfileDetailRequests.clear();
  }
}
