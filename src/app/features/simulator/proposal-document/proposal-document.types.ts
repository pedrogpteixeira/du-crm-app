import {
  InvoiceComparisonOffer,
  SimulationCalculationProfile,
  SimulationCommercialContext,
  SimulationDiscountConditions,
} from '../../../core/services/simulator';

export interface ProposalClient {
  name: string;
  nif: string;
  email: string;
  phone: string;
  address: string;

  crc?: string;
  cpe?: string;
  cui?: string;
}

export interface ProposalCommercial {
  name: string;
  email: string;
  phone: string;
  profilePicture?: string | null;
}

export interface ProposalCurrent {
  provider?: string;
  invoiceAmount: number;
  days: number;
}

export interface ProposalComparisonMeta {
  periodDays?: number | null;
  normalizedMonthDays?: number | null;
  normalizedYearMonths?: number | null;
  methodology?: string;
}

export interface ProposalData {
  offer: InvoiceComparisonOffer;
  current: ProposalCurrent;

  client: ProposalClient;
  commercial: ProposalCommercial;

  discountConditions?:
    SimulationDiscountConditions;

  commercialContext?:
    SimulationCommercialContext | null;

  comparisonMeta?: ProposalComparisonMeta | null;

  calculationProfile?:
    SimulationCalculationProfile | null;
}
