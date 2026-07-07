export type IndexedEnergyAveragePeriodType =
  | 'daily'
  | 'weekly'
  | 'monthly';

export interface IndexedEnergyAverage {
  id: string;
  market: 'omie';
  country: 'PT';
  periodType: IndexedEnergyAveragePeriodType;
  referenceDate?: string | null;
  year?: number | null;
  month?: number | null;
  week?: number | null;
  averagePriceMwh: number;
  averagePriceKwh: number;
  manualOverride: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LatestIndexedEnergyAveragesResponse {
  daily: IndexedEnergyAverage | null;
  weekly: IndexedEnergyAverage | null;
  monthly: IndexedEnergyAverage | null;
}

export interface IndexedEnergyAverageCard {
  periodType: IndexedEnergyAveragePeriodType;
  title: string;
  average: IndexedEnergyAverage | null;
}

export interface UpdateIndexedEnergyAverageRequest {
  averagePriceMwh: number;
}