export type IndexedGasProductType =
  | 'daily'
  | 'next_month'
  | 'next_quarter';

export interface IndexedGasPrice {
  id: string;

  market: 'mibgas';
  hub: 'pvb';

  productType: IndexedGasProductType;
  productName: string;
  reference: string;

  priceMwh: number;
  priceKwh: number;

  active: boolean;

  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateIndexedGasPriceRequest {
  priceMwh?: number;
  priceKwh?: number;
}