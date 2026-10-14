export interface MarketRegulatoryPagination {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface MarketRegulatoryPage<T> {
  items: T[];
  pagination: MarketRegulatoryPagination;
}

export interface ElectricityNetworkAccessRate {
  id: string;
  country: string;
  region: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  voltageLevel: string;
  powerBand?: string | null;
  customerClass: string;
  tariffType?: string | null;
  chargeType: string;
  tariffPeriod?: string | null;
  powerKva?: number | null;
  value: number;
  unit: string;
  source: string;
  sourceUrl?: string | null;
  sourceReference?: string | null;
  versionLabel?: string | null;
  manualOverride: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GasNetworkAccessRate {
  id: string;
  country: string;
  region: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  gasTier: number;
  minAnnualM3?: number | null;
  maxAnnualM3?: number | null;
  fixedEurDay: number;
  energyEurKwh: number;
  source: string;
  sourceUrl?: string | null;
  sourceReference?: string | null;
  versionLabel?: string | null;
  manualOverride: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ElectricityLossProfilePercentages {
  BT: number;
  MT: number;
  AT: number;
  AT_RNT: number;
  MAT: number;
}

export interface ElectricityLossProfile {
  id: string;
  country: string;
  region: string;
  periodStart: string;
  periodEnd: string;
  intervalMinutes: number;
  percentages: ElectricityLossProfilePercentages;
  source: string;
  sourceUrl?: string | null;
  sourceReference?: string | null;
  versionLabel?: string | null;
  fetchedAt?: string | null;
  manualOverride: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ElectricityNetworkAccessFilters {
  active?: boolean;
  voltageLevel?: string;
  powerBand?: string;
  customerClass?: string;
  tariffType?: string;
  chargeType?: string;
  tariffPeriod?: string;
  source?: string;
  versionLabel?: string;
  effectiveFromGte?: string;
  effectiveFromLte?: string;
}

export interface GasNetworkAccessFilters {
  active?: boolean;
  gasTier?: number;
  source?: string;
  versionLabel?: string;
  effectiveFromGte?: string;
  effectiveFromLte?: string;
}

export interface ElectricityLossProfileFilters {
  active?: boolean;
  source?: string;
  versionLabel?: string;
  startDate?: string;
  endDate?: string;
}
