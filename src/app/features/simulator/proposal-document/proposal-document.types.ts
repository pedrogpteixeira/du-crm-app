import { InvoiceComparisonOffer } from '../../../core/services/simulator';

export interface ProposalClient {
  name: string;
  nif: string;
  email: string;
  phone: string;
  address: string;
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

export interface ProposalData {
  offer: InvoiceComparisonOffer;
  current: ProposalCurrent;
  client: ProposalClient;
  commercial: ProposalCommercial;
}