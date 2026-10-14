export type RenErcComponentCode =
  | 'rt_pdbf'
  | 'rt_pdvd'
  | 'rt_phf'
  | 'afrr'
  | 'mfrr'
  | 'other';

export interface RenErcComponent {
  code: RenErcComponentCode;
  valueEurMwh: number;
}

export interface RenErc {
  id: string;
  country: 'PT';
  periodStart: string;
  periodEnd: string;
  ispMinutes: 15 | 30 | 60;
  totalEurMwh: number;
  components?: RenErcComponent[];
  source: 'REN' | 'manual';
  sourceUrl?: string;
  sourceReference?: string;
  fetchedAt?: string;
  manualOverride: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type RenErcReferenceMode = 'period_average' | 'latest_window_average';

export interface RenErcReference {
  mode: RenErcReferenceMode;
  averageEurMwh: number;
  averageEurKwh: number;
  periodStart: string;
  periodEnd: string;
  intervalCount: number;
  totalDurationMinutes: number;
  source: 'REN_ERC';
  estimated: true;
}
