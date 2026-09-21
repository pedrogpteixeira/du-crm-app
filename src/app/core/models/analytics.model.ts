export type AnalyticsProviderId = 'repsol' | 'galp-power-gas';

export type AnalyticsPeriod =
  | 'last7Days'
  | 'last30Days'
  | 'currentYear'
  | 'all';

export type AnalyticsPeriodValues = Record<AnalyticsPeriod, number>;

/**
 * Shape simples consumido pelos componentes visuais. Os componentes de chart
 * não precisam de conhecer períodos nem a estrutura completa do backend.
 */
export interface AnalyticsBreakdownItem {
  label: string;
  count: number;
  percentage: number;
}

export interface AnalyticsDistributionItem extends AnalyticsBreakdownItem {
  /** Valores pré-agregados no backend para cada período. */
  counts: AnalyticsPeriodValues;
  percentages: AnalyticsPeriodValues;
}

interface AnalyticsDistributionResponse {
  /** Valor legacy equivalente a `totals.all`. */
  totalContracts: number;
  totals: AnalyticsPeriodValues;
  items: AnalyticsDistributionItem[];
}

export interface AnalyticsStatesAnalytics extends AnalyticsDistributionResponse {}

export interface AnalyticsRegistrationNamesAnalytics
  extends AnalyticsDistributionResponse {
  totalRegistrationNames: number;
}

export interface AnalyticsProductsAnalytics extends AnalyticsDistributionResponse {}

export interface AnalyticsSegmentsAnalytics extends AnalyticsDistributionResponse {}

export interface AnalyticsDirectDebitItem extends AnalyticsBreakdownItem {
  /** Peso da equipa dentro de todos os contratos com débito direto (legacy/all). */
  percentage: number;

  /** Contratos DD desta equipa / total global da comercializadora (legacy/all). */
  percentageOfTotalContracts: number;

  /** Total de contratos associados a este Nome Registo C.U. (legacy/all). */
  totalContractsForRegistrationName: number;

  /** Contratos DD desta equipa / total de contratos da própria equipa (legacy/all). */
  directDebitRate: number;

  /** Contratos com DD da equipa em cada período. */
  directDebitCount: AnalyticsPeriodValues;

  /** Total de contratos da equipa em cada período. */
  teamTotalContracts: AnalyticsPeriodValues;

  /** Peso da equipa dentro dos contratos com DD em cada período. */
  percentageByPeriod: AnalyticsPeriodValues;

  /** Contratos DD da equipa / total global de contratos em cada período. */
  percentageOfTotalContractsByPeriod: AnalyticsPeriodValues;

  /** Contratos DD da equipa / total de contratos da equipa em cada período. */
  directDebitRateByPeriod: AnalyticsPeriodValues;
}

export interface AnalyticsDirectDebitAnalytics {
  /** Valores legacy equivalentes ao período `all`. */
  totalContracts: number;
  totalWithDirectDebit: number;
  percentageWithDirectDebit: number;

  totals: AnalyticsPeriodValues;
  totalWithDirectDebitByPeriod: AnalyticsPeriodValues;
  percentageWithDirectDebitByPeriod: AnalyticsPeriodValues;

  totalRegistrationNames: number;
  items: AnalyticsDirectDebitItem[];
}

export interface AnalyticsSvaAnalytics {
  /** Valores legacy equivalentes ao período `all`. */
  totalContracts: number;
  totalWithSva: number;
  percentageWithSva: number;

  totals: AnalyticsPeriodValues;
  totalWithSvaByPeriod: AnalyticsPeriodValues;
  percentageWithSvaByPeriod: AnalyticsPeriodValues;

  distribution: AnalyticsDistributionItem[];
}

/**
 * Aliases mantidos para não quebrar código existente que ainda importe os
 * nomes específicos da Repsol. Os endpoints Galp Power & Gás usam a mesma
 * estrutura de resposta.
 */
export type RepsolStatesAnalytics = AnalyticsStatesAnalytics;
export type RepsolRegistrationNamesAnalytics = AnalyticsRegistrationNamesAnalytics;
export type RepsolProductsAnalytics = AnalyticsProductsAnalytics;
export type RepsolSegmentsAnalytics = AnalyticsSegmentsAnalytics;
export type RepsolDirectDebitAnalytics = AnalyticsDirectDebitAnalytics;
export type RepsolSvaAnalytics = AnalyticsSvaAnalytics;
