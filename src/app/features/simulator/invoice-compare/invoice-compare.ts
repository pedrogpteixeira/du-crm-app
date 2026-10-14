import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { ToastService } from '../../../core/services/toast';
import { getSimulationCalculationBasisLabel } from '../../../core/utils/simulation-calculation-basis';

import { Auth } from '../../../core/services/auth';

import {
  AdvancedPricingBreakdown,
  CycleType,
  IndexedElectricityScenarios,
  IndexedGasScenarios,
  IndexedSimulationScenario,
  InvoiceComparisonOffer,
  InvoiceComparisonRequest,
  ProductType,
  Segment,
  SimulationCalculationProfile,
  SimulationCalculationStrategy,
  SimulationCommissionMode,
  SimulationCommercialContext,
  SimulationDiscountConditions,
  SimulationElectricityConsumptionProfile,
  SimulationFormulaMargin,
  SimulatorService,
  TariffType,
} from '../../../core/services/simulator';

import {
  ELECTRICITY_POWERS,
  GAS_LEVELS,
  OTHER_GAS_LEVEL,
  OTHER_POWER,
} from '../../../core/constants/energy';

type PowerSelection = number | typeof OTHER_POWER;

type GasTierSelection = number | typeof OTHER_GAS_LEVEL;

type ElectricityScenarioKey = keyof IndexedElectricityScenarios;

type GasScenarioKey = keyof IndexedGasScenarios;

type OfferSortOption = 'saving' | 'salesCommission' | 'crmCertoCommission' | 'price';

type ElectricityIberdrolaCondition = 'none' | 'PEL' | 'PELPlus';

type GasIberdrolaCondition = 'none' | 'MGI';

type ElectricityPeriodKey = keyof NonNullable<InvoiceComparisonRequest['electricityConsumption']>;

@Component({
  selector: 'app-invoice-compare',
  imports: [CommonModule, FormsModule],
  templateUrl: './invoice-compare.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './invoice-compare.scss',
})
export class InvoiceCompare {
  private readonly simulatorService = inject(SimulatorService);

  private readonly auth = inject(Auth);

  private readonly router = inject(Router);

  readonly availablePowers = ELECTRICITY_POWERS;

  readonly otherPowerValue = OTHER_POWER;

  readonly availableGasLevels = GAS_LEVELS;

  readonly otherGasLevelValue = OTHER_GAS_LEVEL;

  readonly partialEstimateNotice =
    'Estimativa parcial: os valores apresentados incluem os termos comerciais de energia e os termos fixos configurados, mas ainda não incluem todas as tarifas de acesso às redes, impostos, IVA, contribuição audiovisual e outras taxas legalmente aplicáveis. O valor final da fatura poderá ser superior.';

  readonly electricityScenarioKeys: ElectricityScenarioKey[] = ['daily', 'weekly', 'monthly'];

  readonly gasScenarioKeys: GasScenarioKey[] = ['daily', 'nextMonth', 'nextQuarter'];

  isLoading = false;
  hasSimulation = false;
  private readonly toast = inject(ToastService);

  private _errorMessage = '';
  get errorMessage(): string {
    return this._errorMessage;
  }
  set errorMessage(message: string) {
    this._errorMessage = message ?? '';

    if (this._errorMessage) {
      this.toast.error(this._errorMessage);
    }
  }

  hasLogoError: Record<string, boolean> = {};

  offers: InvoiceComparisonOffer[] = [];

  customPower: number | null = null;
  customGasTier: number | null = null;

  sortBy: OfferSortOption = 'saving';

  showAdditionalSettings = false;

  electricityIberdrolaCondition: ElectricityIberdrolaCondition = 'none';

  gasIberdrolaCondition: GasIberdrolaCondition = 'none';

  includeElectricityConsumptionProfile = false;

  selectedOffer: InvoiceComparisonOffer | null = null;

  comparisonMeta: {
    periodDays: number | null;
    normalizedMonthDays: number | null;
    normalizedYearMonths: number | null;
    methodology?: string;
  } | null = null;

  comparisonCommercialContext: SimulationCommercialContext | null = null;

  comparisonDiscountConditions: SimulationDiscountConditions | null = null;

  readonly calculationProfilesById = new Map<string, SimulationCalculationProfile>();

  isLoadingCalculationProfiles = false;
  private calculationProfilesLoaded = false;

  form = {
    currentProvider: '',

    productType: 'electricity' as ProductType,

    segment: 'business' as Segment,

    tariffType: 'simple' as TariffType,

    cycleType: 'daily' as CycleType,

    powerKva: 6.9 as PowerSelection,

    gasTier: 1 as GasTierSelection,

    days: 30,

    currentInvoiceAmount: null as number | null,

    electricityConsumptionKwh: null as number | null,

    gasConsumptionKwh: null as number | null,

    foraVazio: null as number | null,

    vazio: null as number | null,

    superVazio: null as number | null,

    ponta: null as number | null,

    cheias: null as number | null,

    isLoyalty: undefined as boolean | undefined,

    electricityConsumptionProfile: {
      source: '',
      intervalMinutes: 60 as number | null,
      intervalsText: '',
    },

    commercialContext: {
      electricityCustomerClass: '',
      contractedPowerKw: null as number | null,
      peakPowerKw: null as number | null,
      voltageLevel: '',
      gasNetworkLevel: '',
      supplyStartDate: '',
      contractTermMonths: null as number | null,
      paymentMethod: undefined as SimulationCommercialContext['paymentMethod'],
      invoiceDelivery: undefined as SimulationCommercialContext['invoiceDelivery'],
      marginOptionCode: '',
    },

    discountConditions: {
      electronicInvoice: false,
      directDebit: false,
      welcomeBonus: false,
      sva: false,
      loyalty: false,
      gasBonus: false,
      PEL: false,
      PELPlus: false,
      MGI: false,
    } as Required<SimulationDiscountConditions>,
  };

  get canViewCrmCommission(): boolean {
    return this.auth.roleIncludes('Super Admin');
  }

  compareInvoice(): void {
    if (this.isLoading) {
      return;
    }

    const payload = this.buildInvoiceComparePayload();

    if (!payload) {
      return;
    }

    const comparedCommercialContext = payload.commercialContext
      ? { ...payload.commercialContext }
      : null;

    const comparedDiscountConditions = payload.discountConditions
      ? { ...payload.discountConditions }
      : null;

    this.isLoading = true;
    this.hasSimulation = false;
    this.errorMessage = '';
    this.offers = [];
    this.selectedOffer = null;
    this.comparisonMeta = null;
    this.comparisonCommercialContext = null;
    this.comparisonDiscountConditions = null;

    this.simulatorService
      .compareInvoice(payload)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.offers = response.offers || [];

          this.loadCalculationProfilesForOffers(this.offers);

          this.comparisonCommercialContext = comparedCommercialContext;

          this.comparisonDiscountConditions = comparedDiscountConditions;

          this.comparisonMeta = {
            periodDays: response.periodDays ?? response.current?.days ?? null,
            normalizedMonthDays: response.normalizedMonthDays ?? null,
            normalizedYearMonths: response.normalizedYearMonths ?? null,
            methodology: response.methodology,
          };

          this.hasSimulation = true;
        },
        error: (error) => {
          this.errorMessage = this.getComparisonErrorMessage(error);

          this.hasSimulation = false;
        },
      });
  }

  onProductTypeChange(): void {
    this.clearResults();
    this.normalizeIberdrolaConditions();

    if (this.form.productType === 'gas') {
      this.clearElectricityFields();
      return;
    }

    if (this.form.productType === 'electricity') {
      this.clearGasFields();
      this.form.discountConditions.gasBonus = false;
    }
  }

  toggleAdditionalSettings(): void {
    this.showAdditionalSettings = !this.showAdditionalSettings;
  }

  onLoyaltyFilterChange(value: boolean | undefined): void {
    this.form.discountConditions.loyalty = value === true;

    this.clearResults();
  }

  onElectricityIberdrolaConditionChange(value: ElectricityIberdrolaCondition): void {
    this.electricityIberdrolaCondition = value;
    this.form.discountConditions.PEL = value === 'PEL';
    this.form.discountConditions.PELPlus = value === 'PELPlus';
  }

  onGasIberdrolaConditionChange(value: GasIberdrolaCondition): void {
    this.gasIberdrolaCondition = value;
    this.form.discountConditions.MGI = value === 'MGI';
  }

  onElectricityConsumptionProfileToggle(): void {
    this.clearResults();
  }

  onTariffTypeChange(): void {
    this.clearResults();

    if (this.form.tariffType === 'simple') {
      this.form.cycleType = 'daily';

      this.form.foraVazio = null;
      this.form.vazio = null;
      this.form.superVazio = null;
      this.form.ponta = null;
      this.form.cheias = null;

      return;
    }

    this.form.electricityConsumptionKwh = null;

    if (this.form.tariffType === 'bi_hourly') {
      this.form.ponta = null;
      this.form.cheias = null;
      this.form.superVazio = null;

      return;
    }

    if (this.form.tariffType === 'tri_hourly') {
      this.form.foraVazio = null;
      this.form.superVazio = null;

      return;
    }

    if (this.form.tariffType === 'tetra_hourly') {
      this.form.foraVazio = null;
    }
  }

  shouldShowElectricityFields(): boolean {
    return this.form.productType === 'electricity' || this.form.productType === 'dual';
  }

  shouldShowGasFields(): boolean {
    return this.form.productType === 'gas' || this.form.productType === 'dual';
  }

  shouldShowGasBonus(): boolean {
    return this.form.productType === 'gas' || this.form.productType === 'dual';
  }

  shouldShowCycleType(): boolean {
    return this.shouldShowElectricityFields() && this.form.tariffType !== 'simple';
  }

  shouldShowIntervalElectricityConsumption(): boolean {
    return this.shouldShowElectricityFields() && this.includeElectricityConsumptionProfile;
  }

  shouldShowSimpleConsumption(): boolean {
    return this.shouldShowElectricityFields() && this.form.tariffType === 'simple';
  }

  shouldShowBiHourlyConsumption(): boolean {
    return this.shouldShowElectricityFields() && this.form.tariffType === 'bi_hourly';
  }

  shouldShowTriHourlyConsumption(): boolean {
    return this.shouldShowElectricityFields() && this.form.tariffType === 'tri_hourly';
  }

  shouldShowTetraHourlyConsumption(): boolean {
    return this.shouldShowElectricityFields() && this.form.tariffType === 'tetra_hourly';
  }

  hasGeneralDiscount(offer: InvoiceComparisonOffer): boolean {
    return Number(offer.simulation.details.discountValue) > 0;
  }

  hasElectricityDiscount(offer: InvoiceComparisonOffer): boolean {
    return Number(offer.simulation.details.electricityCost?.discountValue) > 0;
  }

  hasGasDiscount(offer: InvoiceComparisonOffer): boolean {
    return Number(offer.simulation.details.gasCost?.discountValue) > 0;
  }

  hasIndexedElectricityScenarios(offer: InvoiceComparisonOffer): boolean {
    return Boolean(offer.simulation.details.indexedElectricityScenarios);
  }

  hasIndexedGasScenarios(offer: InvoiceComparisonOffer): boolean {
    return Boolean(offer.simulation.details.indexedGasScenarios);
  }

  getElectricityScenario(
    offer: InvoiceComparisonOffer,
    key: ElectricityScenarioKey,
  ): IndexedSimulationScenario | null {
    return offer.simulation.details.indexedElectricityScenarios?.[key] || null;
  }

  getGasScenario(
    offer: InvoiceComparisonOffer,
    key: GasScenarioKey,
  ): IndexedSimulationScenario | null {
    return offer.simulation.details.indexedGasScenarios?.[key] || null;
  }

  getElectricityScenarioLabel(key: ElectricityScenarioKey): string {
    const labels: Record<ElectricityScenarioKey, string> = {
      daily: 'Média diária',
      weekly: 'Média semanal',
      monthly: 'Média mensal',
    };

    return labels[key];
  }

  getGasScenarioLabel(key: GasScenarioKey): string {
    const labels: Record<GasScenarioKey, string> = {
      daily: 'Diário',
      nextMonth: 'Próximo mês',
      nextQuarter: 'Próximo trimestre',
    };

    return labels[key];
  }

  isMainElectricityScenario(key: ElectricityScenarioKey): boolean {
    return key === 'monthly';
  }

  isMainGasScenario(key: GasScenarioKey): boolean {
    return key === 'nextMonth';
  }

  getPriceModeLabel(value?: string): string {
    const labels: Record<string, string> = {
      fixed: 'Preço fixo',
      indexed: 'Preço indexado',
    };

    return value ? labels[value] || value : '—';
  }

  getTariffTypeLabel(tariffType?: string): string {
    const labels: Record<string, string> = {
      simple: 'Simples',
      bi_hourly: 'Bi-horário',
      tri_hourly: 'Tri-horário',
      tetra_hourly: 'Tetra-horário',
    };

    return tariffType ? labels[tariffType] || tariffType : '—';
  }

  getCycleTypeLabel(cycleType?: string): string {
    const labels: Record<string, string> = {
      daily: 'Diário',
      weekly: 'Semanal',
    };

    return cycleType ? labels[cycleType] || cycleType : '—';
  }

  getProductTypeLabel(productType?: string): string {
    const labels: Record<string, string> = {
      electricity: 'Eletricidade',
      gas: 'Gás',
      dual: 'Luz + Gás',
    };

    return productType ? labels[productType] || productType : '—';
  }

  getCalculationBasisLabel(offer: InvoiceComparisonOffer): string | null {
    return getSimulationCalculationBasisLabel(
      offer.simulation.calculationBasis,
      offer.simulation.estimated,
    );
  }

  isEstimatedCalculation(offer: InvoiceComparisonOffer): boolean {
    return offer.simulation.estimated === true;
  }

  isAdvancedOffer(offer: InvoiceComparisonOffer): boolean {
    return Boolean(offer.tariff.calculationProfileId);
  }

  getCalculationProfile(offer: InvoiceComparisonOffer): SimulationCalculationProfile | null {
    const profileId = offer.tariff.calculationProfileId;

    if (!profileId) {
      return null;
    }

    return this.calculationProfilesById.get(profileId) ?? null;
  }

  getCalculationProfileLabel(offer: InvoiceComparisonOffer): string {
    const profile = this.getCalculationProfile(offer);

    if (profile) {
      return `${profile.familyCode} · v${profile.version}`;
    }

    return this.isLoadingCalculationProfiles ? 'A carregar perfil…' : 'Perfil avançado';
  }

  isCalculationProfileInactive(offer: InvoiceComparisonOffer): boolean {
    const profile = this.getCalculationProfile(offer);

    return profile?.active === false;
  }

  getStrategyLabel(strategy: SimulationCalculationStrategy): string {
    const labels: Record<SimulationCalculationStrategy, string> = {
      legacy_fixed: 'Legacy fixo',
      legacy_indexed: 'Legacy indexado',
      indexed_cost_plus: 'Custo indexado + margem',
      adjusted_factor_plus: 'Fator ajustado + margem',
      fixed_hedge_plus_system_cost: 'Hedge fixo + custo de sistema',
      weighted_mix: 'Mix ponderado',
      gas_adjusted: 'Gás ajustado',
    };

    return labels[strategy];
  }

  getAdvancedStrategySummary(offer: InvoiceComparisonOffer): string {
    const profile = this.getCalculationProfile(offer);

    if (!profile) {
      return 'Estratégia definida pelo perfil';
    }

    const electricityStrategy = profile.electricity?.strategy;
    const gasStrategy = profile.gas?.strategy;

    if (electricityStrategy && gasStrategy) {
      if (electricityStrategy === gasStrategy) {
        return this.getStrategyLabel(electricityStrategy);
      }

      return `Luz: ${this.getStrategyLabel(electricityStrategy)} · Gás: ${this.getStrategyLabel(
        gasStrategy,
      )}`;
    }

    if (electricityStrategy) {
      return this.getStrategyLabel(electricityStrategy);
    }

    if (gasStrategy) {
      return this.getStrategyLabel(gasStrategy);
    }

    return 'Estratégia definida pelo perfil';
  }

  getCommissionModeLabel(mode?: SimulationCommissionMode): string {
    if (!mode) {
      return '—';
    }

    const labels: Record<SimulationCommissionMode, string> = {
      team_table: 'Tabela de equipa',
      formula_margin: 'Margem da fórmula',
      hybrid: 'Híbrido',
    };

    return labels[mode];
  }

  getSalesCommission(offer: InvoiceComparisonOffer): number | undefined {
    if (offer.salesCommission !== undefined && offer.salesCommission !== null) {
      return offer.salesCommission;
    }

    return this.isAdvancedOffer(offer) ? undefined : offer.tariff.salesCommission;
  }

  getCrmCommission(offer: InvoiceComparisonOffer): number | undefined {
    if (offer.crmCertoCommission !== undefined && offer.crmCertoCommission !== null) {
      return offer.crmCertoCommission;
    }

    return this.isAdvancedOffer(offer) ? undefined : offer.tariff.crmCertoCommission;
  }

  getEmbeddedCommercialMargin(offer: InvoiceComparisonOffer): number | undefined {
    const value = offer.embeddedCommercialMarginEur;

    if (value === undefined || value === null || !Number.isFinite(Number(value))) {
      return undefined;
    }

    return Number(value);
  }

  getPricingBreakdown(offer: InvoiceComparisonOffer): AdvancedPricingBreakdown | null {
    return offer.pricingBreakdown ?? null;
  }

  hasAdvancedPricingBreakdown(offer: InvoiceComparisonOffer): boolean {
    const breakdown = this.getPricingBreakdown(offer);

    if (!breakdown) {
      return false;
    }

    return (
      this.getAdvancedBreakdownRows(offer).length > 0 ||
      this.getIncludedComponentStatuses(offer).length > 0 ||
      Boolean(breakdown.calculationMetadata)
    );
  }

  getAdvancedBreakdownRows(offer: InvoiceComparisonOffer): Array<{
    label: string;
    value: number;
  }> {
    const breakdown = this.getPricingBreakdown(offer);

    if (!breakdown) {
      return [];
    }

    const definitions: Array<{
      key:
        | 'marketEnergy'
        | 'fixedHedge'
        | 'renSystemCost'
        | 'networkAccess'
        | 'losses'
        | 'operatingMargin'
        | 'guaranteesOfOrigin'
        | 'contractualEnergyPrice'
        | 'normalizedComparableCost';
      label: string;
    }> = [
      {
        key: 'marketEnergy',
        label: 'Energia de mercado',
      },
      {
        key: 'fixedHedge',
        label: 'Hedge / referência fixa',
      },
      {
        key: 'renSystemCost',
        label: 'Custo de sistema REN/ERC',
      },
      {
        key: 'networkAccess',
        label: 'Acesso às redes / TAR',
      },
      {
        key: 'losses',
        label: 'Perdas',
      },
      {
        key: 'operatingMargin',
        label: 'Margem operacional',
      },
      {
        key: 'guaranteesOfOrigin',
        label: 'Garantias de Origem',
      },
      {
        key: 'contractualEnergyPrice',
        label: 'Preço contratual de energia',
      },
      {
        key: 'normalizedComparableCost',
        label: 'Comparável normalizado (técnico)',
      },
    ];

    return definitions.flatMap(({ key, label }) => {
      const value = breakdown[key];

      return value !== undefined && value !== null && Number.isFinite(Number(value))
        ? [
            {
              label,
              value: Number(value),
            },
          ]
        : [];
    });
  }

  formatAdvancedBreakdownValue(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      maximumFractionDigits: 6,
    }).format(value);
  }

  getIncludedComponentStatuses(offer: InvoiceComparisonOffer): Array<{
    label: string;
    included: boolean;
  }> {
    const included = this.getPricingBreakdown(offer)?.includedComponents;

    if (!included) {
      return [];
    }

    const definitions: Array<{
      key: keyof NonNullable<AdvancedPricingBreakdown['includedComponents']>;
      label: string;
    }> = [
      {
        key: 'networkAccessPower',
        label: 'TAR de potência',
      },
      {
        key: 'networkAccessFixedTerm',
        label: 'Termo fixo TAR gás',
      },
      {
        key: 'networkAccessEnergy',
        label: 'TAR de energia',
      },
      {
        key: 'losses',
        label: 'Perdas',
      },
      {
        key: 'renSystemCosts',
        label: 'REN / ERC',
      },
      {
        key: 'mfrr',
        label: 'mFRR',
      },
      {
        key: 'guaranteesOfOrigin',
        label: 'Garantias de Origem',
      },
      {
        key: 'socialTariffFinancing',
        label: 'Financiamento tarifa social',
      },
    ];

    return definitions.flatMap(({ key, label }) => {
      const value = included[key];

      return value === undefined
        ? []
        : [
            {
              label,
              included: Boolean(value),
            },
          ];
    });
  }

  getCalculationMetadataRows(offer: InvoiceComparisonOffer): Array<{
    label: string;
    value: string;
  }> {
    const metadata = this.getPricingBreakdown(offer)?.calculationMetadata;

    if (!metadata) {
      return [];
    }

    const rows = [
      {
        label: 'Strategy executada',
        value: metadata.strategy,
      },
      {
        label: 'Mercado',
        value: metadata.marketSource,
      },
      {
        label: 'Fonte regulatória',
        value: metadata.regulatorySource,
      },
      {
        label: 'Referência regulatória',
        value: metadata.regulatoryReferenceDate,
      },
      {
        label: 'Versão TAR',
        value: metadata.accessTariffVersion,
      },
    ];

    return rows.flatMap(({ label, value }) =>
      value?.trim()
        ? [
            {
              label,
              value: value.trim(),
            },
          ]
        : [],
    );
  }

  getNormalizedComparableCostEur(offer: InvoiceComparisonOffer): number | undefined {
    const value = offer.normalizedComparableCostEur;

    if (value === undefined || value === null || !Number.isFinite(Number(value))) {
      return undefined;
    }

    return Number(value);
  }

  getEstimateNotice(offer: InvoiceComparisonOffer | null): string {
    if (!offer || !this.isAdvancedOffer(offer)) {
      return this.partialEstimateNotice;
    }

    const breakdown = this.getPricingBreakdown(offer);

    if (!breakdown) {
      return 'Pricing Advanced: o valor foi calculado pela API, mas esta resposta não inclui um pricingBreakdown detalhado. O frontend não presume se TAR, impostos, IVA, contribuição audiovisual ou outras taxas estão incluídos.';
    }

    const accessFlagged = Boolean(
      breakdown.includedComponents?.networkAccessPower ||
      breakdown.includedComponents?.networkAccessFixedTerm ||
      breakdown.includedComponents?.networkAccessEnergy ||
      breakdown.networkAccess !== undefined,
    );

    if (accessFlagged) {
      return 'Pricing Advanced: o breakdown devolvido pela API inclui informação de acesso às redes/TAR. Impostos, IVA, contribuição audiovisual e outras taxas não são inferidos pelo frontend e só devem ser considerados incluídos quando o backend os indicar explicitamente.';
    }

    return 'Pricing Advanced: o breakdown devolvido pela API não assinala acesso às redes/TAR como incluído. O frontend também não estima impostos, IVA, contribuição audiovisual ou outras taxas.';
  }

  getResultsEstimateNotice(): string {
    if (!this.offers.length) {
      return this.partialEstimateNotice;
    }

    const advancedOffers = this.offers.filter((offer) => this.isAdvancedOffer(offer));

    if (!advancedOffers.length) {
      return this.partialEstimateNotice;
    }

    if (advancedOffers.length === this.offers.length) {
      return 'Resultados Advanced: os custos são devolvidos pelo pricing engine da API. Consulta o detalhe de cada oferta para verificar os componentes regulados/TAR que o backend assinala como incluídos. O frontend não infere impostos, IVA, contribuição audiovisual ou outras taxas.';
    }

    return 'Os resultados combinam ofertas Legacy e Advanced. Nas ofertas Advanced, consulta o breakdown individual para verificar TAR e componentes regulados; nas Legacy mantém-se a estimativa parcial. O frontend não recalcula nem infere impostos ou taxas.';
  }

  getCommercialContextBadges(): string[] {
    const badges: string[] = [];
    const paymentMethod = this.comparisonCommercialContext?.paymentMethod;
    const invoiceDelivery = this.comparisonCommercialContext?.invoiceDelivery;

    if (paymentMethod === 'direct_debit') {
      badges.push('DD · Débito Direto');
    } else if (paymentMethod === 'multibanco') {
      badges.push('MB · Multibanco');
    } else if (paymentMethod === 'other') {
      badges.push('Outro método de pagamento');
    }

    if (invoiceDelivery === 'electronic') {
      badges.push('FE · Fatura eletrónica');
    } else if (invoiceDelivery === 'paper') {
      badges.push('FP · Fatura em papel');
    }

    return badges;
  }

  getProfileMarginSummaries(offer: InvoiceComparisonOffer): string[] {
    const profile = this.getCalculationProfile(offer);

    if (!profile) {
      return [];
    }

    const summaries: string[] = [];

    const appendConfigMargins = (
      energyLabel: string,
      config: SimulationCalculationProfile['electricity'] | SimulationCalculationProfile['gas'],
    ): void => {
      if (!config) {
        return;
      }

      if (config.margin) {
        summaries.push(`${energyLabel}: ${this.formatFormulaMargin(config.margin)}`);
      }

      for (const component of config.components ?? []) {
        if (!component.margin) {
          continue;
        }

        summaries.push(
          `${energyLabel}/${component.code}: ${this.formatFormulaMargin(component.margin)}`,
        );
      }
    };

    appendConfigMargins('Luz', profile.electricity);
    appendConfigMargins('Gás', profile.gas);

    return Array.from(new Set(summaries));
  }

  private formatFormulaMargin(margin: SimulationFormulaMargin): string {
    const kindLabels: Record<SimulationFormulaMargin['kind'], string> = {
      K: 'K',
      OPERATING_MARGIN: 'Margem operacional',
      FEE: 'FEE',
    };

    const unit = margin.unit === 'EUR_MWH' ? '€/MWh' : 'c€/kWh';

    const value = new Intl.NumberFormat('pt-PT', {
      maximumFractionDigits: 6,
    }).format(margin.value);

    return `${kindLabels[margin.kind]} ${value} ${unit}`;
  }

  formatCurrency(value?: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(Number(value || 0));
  }

  formatOptionalCurrency(value?: number | null): string {
    if (value === undefined || value === null || !Number.isFinite(Number(value))) {
      return '—';
    }

    return this.formatCurrency(Number(value));
  }

  getInvoicePeriodCost(offer: InvoiceComparisonOffer): number | undefined {
    return offer.invoicePeriodCost ?? offer.simulation.details.totalCost;
  }

  getNormalizedMonthlyCost(offer: InvoiceComparisonOffer): number {
    return offer.normalizedMonthlyCost ?? offer.simulation.estimatedMonthlyCost;
  }

  getNormalizedAnnualCost(offer: InvoiceComparisonOffer): number | undefined {
    return offer.normalizedAnnualCost;
  }

  getInvoicePeriodSaving(offer: InvoiceComparisonOffer): number | undefined {
    return offer.comparison.invoicePeriodSaving;
  }

  getNormalizedMonthlySaving(offer: InvoiceComparisonOffer): number {
    return offer.comparison.monthlySaving;
  }

  getNormalizedAnnualSaving(offer: InvoiceComparisonOffer): number {
    return offer.comparison.yearlySaving;
  }

  getComparisonPeriodDays(offer?: InvoiceComparisonOffer): number | null {
    return this.comparisonMeta?.periodDays ?? offer?.simulation.details.days ?? null;
  }

  getMonthlyNormalizationLabel(): string {
    const days = this.comparisonMeta?.normalizedMonthDays;

    return days ? `Normalizado a ${days} dias` : 'Normalização mensal';
  }

  getAnnualNormalizationLabel(): string {
    const months = this.comparisonMeta?.normalizedYearMonths;

    return months ? `Normalizado a ${months} meses` : 'Normalização anual';
  }

  formatPercentage(value?: number | null): string {
    if (value === undefined || value === null) {
      return '—';
    }

    return new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  formatScenarioPrice(value?: number): string {
    if (value === null || value === undefined) {
      return '—';
    }

    return new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 5,
      maximumFractionDigits: 5,
    }).format(value);
  }

  getProviderLogo(providerName: string): string {
    const normalized = (providerName || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const logos: Record<string, string> = {
      repsol: 'assets/companies/repsol.png',

      wallbox: 'assets/companies/wallbox.png',

      meo: 'assets/companies/meo.png',

      'meo energias': 'assets/companies/meo.png',

      galp: 'assets/companies/galp.png',

      iberdrola: 'assets/companies/iberdrola.png',

      yes: 'assets/companies/yes.png',

      'yes energy': 'assets/companies/yes.png',

      endesa: 'assets/companies/endesa.png',

      portulogos: 'assets/companies/portulogos.png',

      'nossa energia': 'assets/companies/nossa-energia.png',

      ezu: 'assets/companies/ezu.png',

      audax: 'assets/companies/audax.png',

      plenitude: 'assets/companies/plenitude.png',
    };

    return logos[normalized] ?? 'assets/companies/default.png';
  }

  onLogoError(provider: string): void {
    this.hasLogoError[provider] = true;
  }

  private buildInvoiceComparePayload(): InvoiceComparisonRequest | null {
    const currentInvoiceAmount = Number(this.form.currentInvoiceAmount);

    if (!Number.isFinite(currentInvoiceAmount) || currentInvoiceAmount <= 0) {
      this.errorMessage = 'O valor atual da fatura é obrigatório.';

      return null;
    }

    const days = Number(this.form.days);

    if (!Number.isFinite(days) || days < 1) {
      this.errorMessage = 'O número de dias faturados deve ser válido.';

      return null;
    }

    const hasElectricity = this.shouldShowElectricityFields();
    const hasGas = this.shouldShowGasFields();

    const payload: InvoiceComparisonRequest = {
      productType: this.form.productType,
      segment: this.form.segment,
      days,
      currentInvoiceAmount,
      isLoyalty: this.form.isLoyalty,
      discountConditions: this.buildDiscountConditions(),
    };

    this.addIfFilled(payload, 'currentProvider', this.form.currentProvider.trim());

    let powerKva: number | null = null;

    if (hasElectricity) {
      powerKva = this.getPowerKva();

      if (powerKva === null || !Number.isFinite(powerKva) || powerKva <= 0) {
        this.errorMessage = 'A potência contratada é obrigatória.';

        return null;
      }

      payload.powerKva = powerKva;
      payload.tariffType = this.form.tariffType;

      if (this.shouldShowCycleType()) {
        payload.cycleType = this.form.cycleType;
      }

      if (!this.applyInvoiceElectricityConsumption(payload)) {
        return null;
      }

      if (this.includeElectricityConsumptionProfile) {
        const intervalProfile = this.buildElectricityConsumptionProfile();

        if (!intervalProfile) {
          return null;
        }

        payload.electricityConsumptionProfile = intervalProfile;
      }
    }

    if (hasGas) {
      const gasTier = this.getGasTier();

      if (gasTier === null || !Number.isFinite(gasTier) || gasTier < 1) {
        this.errorMessage = 'O escalão de gás é obrigatório.';

        return null;
      }

      payload.gasTier = gasTier;

      const gasConsumptionKwh = Number(this.form.gasConsumptionKwh);

      if (
        this.form.gasConsumptionKwh === null ||
        !Number.isFinite(gasConsumptionKwh) ||
        gasConsumptionKwh <= 0
      ) {
        this.errorMessage =
          this.form.productType === 'dual'
            ? 'Num produto Dual, o consumo de gás é obrigatório.'
            : 'O consumo de gás é obrigatório.';

        return null;
      }

      payload.gasConsumptionKwh = gasConsumptionKwh;
    }

    const commercialContext = this.buildCommercialContext();

    if (commercialContext === null) {
      return null;
    }

    if (Object.keys(commercialContext).length > 0) {
      payload.commercialContext = commercialContext;
    }

    return this.cleanPayload(payload);
  }

  private applyInvoiceElectricityConsumption(payload: InvoiceComparisonRequest): boolean {
    if (this.form.tariffType === 'simple') {
      const consumption = Number(this.form.electricityConsumptionKwh);

      if (
        this.form.electricityConsumptionKwh === null ||
        !Number.isFinite(consumption) ||
        consumption <= 0
      ) {
        this.errorMessage =
          this.form.productType === 'dual'
            ? 'Num produto Dual, o consumo de eletricidade é obrigatório.'
            : 'O consumo de eletricidade é obrigatório.';

        return false;
      }

      payload.electricityConsumptionKwh = consumption;

      return true;
    }

    const periodEntries = this.getRequiredElectricityPeriodEntries();

    const missingPeriod = periodEntries.find(
      ([, , value]) =>
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0,
    );

    if (missingPeriod) {
      this.errorMessage = `Indica um consumo válido para ${missingPeriod[1]}.`;
      return false;
    }

    const total = periodEntries.reduce((sum, [, , value]) => sum + Number(value), 0);

    if (total <= 0) {
      this.errorMessage =
        this.form.productType === 'dual'
          ? 'Num produto Dual, o consumo de eletricidade é obrigatório.'
          : 'O consumo de eletricidade é obrigatório.';
      return false;
    }

    payload.electricityConsumption = Object.fromEntries(
      periodEntries.map(([key, , value]) => [key, Number(value)]),
    ) as NonNullable<InvoiceComparisonRequest['electricityConsumption']>;

    return true;
  }

  private getRequiredElectricityPeriodEntries(): Array<
    [ElectricityPeriodKey, string, number | null]
  > {
    if (this.form.tariffType === 'bi_hourly') {
      return [
        ['foraVazio', 'Fora vazio', this.form.foraVazio],
        ['vazio', 'Vazio', this.form.vazio],
      ];
    }

    if (this.form.tariffType === 'tri_hourly') {
      return [
        ['ponta', 'Ponta', this.form.ponta],
        ['cheias', 'Cheias', this.form.cheias],
        ['vazio', 'Vazio', this.form.vazio],
      ];
    }

    return [
      ['ponta', 'Ponta', this.form.ponta],
      ['cheias', 'Cheias', this.form.cheias],
      ['vazio', 'Vazio', this.form.vazio],
      ['superVazio', 'Super vazio', this.form.superVazio],
    ];
  }

  private buildElectricityConsumptionProfile(): SimulationElectricityConsumptionProfile | null {
    const intervalMinutes = Number(this.form.electricityConsumptionProfile.intervalMinutes);

    if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) {
      this.errorMessage =
        'No perfil intervalar, o intervalo em minutos deve ser um número inteiro positivo.';
      return null;
    }

    const rawLines = this.form.electricityConsumptionProfile.intervalsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!rawLines.length) {
      this.errorMessage = 'Adiciona pelo menos um intervalo de consumo de eletricidade.';
      return null;
    }

    const intervals: SimulationElectricityConsumptionProfile['intervals'] = [];
    const seenStartAt = new Set<string>();

    for (let index = 0; index < rawLines.length; index += 1) {
      const line = rawLines[index];
      const parts = line.split(';').map((part) => part.trim());

      if (index === 0 && parts[0]?.toLowerCase() === 'startat') {
        continue;
      }

      const [startAt, rawConsumption, tariffPeriod] = parts;
      const consumptionKwh = Number((rawConsumption || '').replace(',', '.'));

      if (!startAt || !rawConsumption) {
        this.errorMessage = `Linha ${index + 1} do perfil intervalar inválida. Usa startAt;consumptionKwh;tariffPeriod.`;
        return null;
      }

      if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(
          startAt,
        )
      ) {
        this.errorMessage = `Linha ${index + 1}: startAt deve estar em formato ISO, por exemplo 2026-10-01T00:00.`;
        return null;
      }

      if (!Number.isFinite(consumptionKwh) || consumptionKwh < 0) {
        this.errorMessage = `Linha ${index + 1}: o consumo deve ser um número igual ou superior a zero.`;
        return null;
      }

      if (seenStartAt.has(startAt)) {
        this.errorMessage = `O instante ${startAt} aparece repetido no perfil intervalar.`;
        return null;
      }

      seenStartAt.add(startAt);

      intervals.push({
        startAt,
        consumptionKwh,
        ...(tariffPeriod ? { tariffPeriod } : {}),
      });
    }

    if (!intervals.length) {
      this.errorMessage = 'Adiciona pelo menos um intervalo de consumo de eletricidade.';
      return null;
    }

    if (intervals.every((interval) => interval.consumptionKwh <= 0)) {
      this.errorMessage =
        'O perfil intervalar deve conter consumo de eletricidade superior a zero.';
      return null;
    }

    const source = this.form.electricityConsumptionProfile.source.trim();

    return {
      ...(source ? { source } : {}),
      intervalMinutes,
      intervals,
    };
  }

  private buildCommercialContext(): SimulationCommercialContext | null {
    const context: SimulationCommercialContext = {};
    const raw = this.form.commercialContext;

    if (this.shouldShowElectricityFields()) {
      this.addIfFilled(context, 'electricityCustomerClass', raw.electricityCustomerClass.trim());
      this.addIfFilled(context, 'voltageLevel', raw.voltageLevel.trim());

      if (raw.contractedPowerKw !== null) {
        const contractedPowerKw = Number(raw.contractedPowerKw);

        if (!Number.isFinite(contractedPowerKw) || contractedPowerKw <= 0) {
          this.errorMessage = 'A potência contratada em kW do contexto comercial deve ser válida.';
          return null;
        }

        context.contractedPowerKw = contractedPowerKw;
      }

      if (raw.peakPowerKw !== null) {
        const peakPowerKw = Number(raw.peakPowerKw);

        if (!Number.isFinite(peakPowerKw) || peakPowerKw < 0) {
          this.errorMessage = 'A potência de ponta do contexto comercial deve ser válida.';
          return null;
        }

        context.peakPowerKw = peakPowerKw;
      }
    }

    if (this.shouldShowGasFields()) {
      this.addIfFilled(context, 'gasNetworkLevel', raw.gasNetworkLevel.trim());
    }

    this.addIfFilled(context, 'supplyStartDate', raw.supplyStartDate);

    if (raw.contractTermMonths !== null) {
      const contractTermMonths = Number(raw.contractTermMonths);

      if (!Number.isInteger(contractTermMonths) || contractTermMonths <= 0) {
        this.errorMessage = 'A duração do contrato deve ser indicada em meses inteiros positivos.';
        return null;
      }

      context.contractTermMonths = contractTermMonths;
    }

    this.addIfFilled(context, 'paymentMethod', raw.paymentMethod);
    this.addIfFilled(context, 'invoiceDelivery', raw.invoiceDelivery);
    this.addIfFilled(context, 'marginOptionCode', raw.marginOptionCode.trim());

    return context;
  }

  private buildDiscountConditions(): SimulationDiscountConditions {
    const hasElectricity = this.shouldShowElectricityFields();
    const hasGas = this.shouldShowGasFields();

    return {
      electronicInvoice: Boolean(this.form.discountConditions.electronicInvoice),
      directDebit: Boolean(this.form.discountConditions.directDebit),
      welcomeBonus: Boolean(this.form.discountConditions.welcomeBonus),
      sva: Boolean(this.form.discountConditions.sva),
      loyalty: Boolean(this.form.discountConditions.loyalty),
      gasBonus: hasGas ? Boolean(this.form.discountConditions.gasBonus) : false,
      PEL: hasElectricity && this.electricityIberdrolaCondition === 'PEL',
      PELPlus: hasElectricity && this.electricityIberdrolaCondition === 'PELPlus',
      MGI: hasGas && this.gasIberdrolaCondition === 'MGI',
    };
  }

  private loadCalculationProfilesForOffers(offers: InvoiceComparisonOffer[]): void {
    const referencedProfileIds = Array.from(
      new Set(
        offers
          .map((offer) => offer.tariff.calculationProfileId)
          .filter((profileId): profileId is string => Boolean(profileId)),
      ),
    );

    if (!referencedProfileIds.length || this.isLoadingCalculationProfiles) {
      return;
    }

    const hasAllReferencedProfiles = referencedProfileIds.every((profileId) =>
      this.calculationProfilesById.has(profileId),
    );

    if (this.calculationProfilesLoaded && hasAllReferencedProfiles) {
      return;
    }

    this.isLoadingCalculationProfiles = true;

    this.simulatorService
      .getCalculationProfiles()
      .pipe(
        finalize(() => {
          this.isLoadingCalculationProfiles = false;
        }),
      )
      .subscribe({
        next: (profiles) => {
          this.calculationProfilesById.clear();

          for (const profile of profiles) {
            this.calculationProfilesById.set(profile.id, profile);
          }

          this.calculationProfilesLoaded = true;
        },
        error: () => {
          this.calculationProfilesLoaded = false;
        },
      });
  }

  private normalizeIberdrolaConditions(): void {
    if (this.form.productType === 'electricity') {
      this.gasIberdrolaCondition = 'none';
      this.form.discountConditions.MGI = false;
      return;
    }

    if (this.form.productType === 'gas') {
      this.electricityIberdrolaCondition = 'none';
      this.form.discountConditions.PEL = false;
      this.form.discountConditions.PELPlus = false;
    }
  }

  private cleanPayload(payload: InvoiceComparisonRequest): InvoiceComparisonRequest {
    return Object.fromEntries(
      Object.entries(payload).filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      ),
    ) as InvoiceComparisonRequest;
  }

  private getPowerKva(): number | null {
    if (this.form.powerKva === OTHER_POWER) {
      return this.customPower === null ? null : Number(this.customPower);
    }

    return Number(this.form.powerKva);
  }

  private getGasTier(): number | null {
    if (this.form.gasTier === OTHER_GAS_LEVEL) {
      return this.customGasTier === null ? null : Number(this.customGasTier);
    }

    return Number(this.form.gasTier);
  }

  private clearElectricityFields(): void {
    this.form.tariffType = 'simple';
    this.form.cycleType = 'daily';
    this.form.powerKva = 6.9;

    this.customPower = null;
    this.includeElectricityConsumptionProfile = false;

    this.clearInvoiceElectricityConsumption();
    this.clearIntervalElectricityConsumption();

    this.form.commercialContext.electricityCustomerClass = '';
    this.form.commercialContext.contractedPowerKw = null;
    this.form.commercialContext.peakPowerKw = null;
    this.form.commercialContext.voltageLevel = '';
  }

  private clearInvoiceElectricityConsumption(): void {
    this.form.electricityConsumptionKwh = null;
    this.form.foraVazio = null;
    this.form.vazio = null;
    this.form.superVazio = null;
    this.form.ponta = null;
    this.form.cheias = null;
  }

  private clearIntervalElectricityConsumption(): void {
    this.form.electricityConsumptionProfile.source = '';
    this.form.electricityConsumptionProfile.intervalMinutes = 60;
    this.form.electricityConsumptionProfile.intervalsText = '';
  }

  private clearGasFields(): void {
    this.form.gasTier = 1;

    this.customGasTier = null;

    this.form.gasConsumptionKwh = null;

    this.form.commercialContext.gasNetworkLevel = '';
  }

  private clearResults(): void {
    this.errorMessage = '';
    this.offers = [];
    this.hasSimulation = false;
    this.selectedOffer = null;
    this.comparisonMeta = null;
    this.comparisonCommercialContext = null;
    this.comparisonDiscountConditions = null;
  }

  private addIfFilled<T extends object>(payload: T, key: string, value: unknown): void {
    if (value === null || value === undefined || value === '') {
      return;
    }

    (payload as Record<string, unknown>)[key] = value;
  }

  private getComparisonErrorMessage(error: {
    error?: {
      message?: string;
    };
  }): string {
    const backendMessage = error?.error?.message || '';

    if (backendMessage.includes('Daily, weekly and monthly OMIE averages')) {
      return 'Não existem atualmente todos os valores OMIE necessários para simular os tarifários indexados de eletricidade.';
    }

    if (backendMessage.includes('Daily, next month and next quarter MIBGAS prices')) {
      return 'Não existem atualmente todos os valores MIBGAS necessários para simular os tarifários indexados de gás.';
    }

    if (backendMessage.includes('PEL and PELPlus cannot both be enabled')) {
      return 'Não é possível selecionar simultaneamente PEL e PEL Plus.';
    }

    if (backendMessage.includes('PEL and PELPlus are only available')) {
      return 'PEL e PEL Plus só estão disponíveis em propostas de eletricidade.';
    }

    return backendMessage || 'Não foi possível realizar a comparação da fatura.';
  }

  openOfferDetails(offer: InvoiceComparisonOffer): void {
    this.selectedOffer = offer;
  }

  closeOfferDetails(): void {
    this.selectedOffer = null;
  }

  hasElectricityPrices(offer: InvoiceComparisonOffer): boolean {
    return (
      offer.tariff.powerPricePerDay !== undefined ||
      offer.tariff.singleEnergyPrice !== undefined ||
      offer.tariff.foraVazioEnergyPrice !== undefined ||
      offer.tariff.vazioEnergyPrice !== undefined ||
      offer.tariff.pontaEnergyPrice !== undefined ||
      offer.tariff.cheiasEnergyPrice !== undefined ||
      offer.tariff.superVazioEnergyPrice !== undefined
    );
  }

  hasGasPrices(offer: InvoiceComparisonOffer): boolean {
    return offer.tariff.fixedTermPerDay !== undefined || offer.tariff.gasEnergyPrice !== undefined;
  }

  hasCampaignDates(offer: InvoiceComparisonOffer): boolean {
    return Boolean(offer.tariff.startDate || offer.tariff.endDate);
  }

  hasDualCostBreakdown(offer: InvoiceComparisonOffer): boolean {
    return Boolean(offer.simulation.details.electricityCost || offer.simulation.details.gasCost);
  }

  formatDecimalPrice(value?: number): string {
    if (value === null || value === undefined) {
      return '—';
    }

    return new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 5,
    }).format(value);
  }

  formatDate(date?: string | null): string {
    if (!date) {
      return '—';
    }

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);

    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return `${day}/${month}/${year}`;
    }

    return date;
  }

  openProposalPreview(offer: InvoiceComparisonOffer): void {
    const profileId = offer.tariff.calculationProfileId;
    const profile = this.getCalculationProfile(offer);

    if (profileId && !profile) {
      this.simulatorService.getCalculationProfileById(profileId).subscribe({
        next: (loadedProfile) => {
          this.calculationProfilesById.set(loadedProfile.id, loadedProfile);

          this.navigateToProposalPreview(offer, loadedProfile);
        },
        error: () => {
          this.navigateToProposalPreview(offer, null);
        },
      });

      return;
    }

    this.navigateToProposalPreview(offer, profile);
  }

  private navigateToProposalPreview(
    offer: InvoiceComparisonOffer,
    calculationProfile: SimulationCalculationProfile | null,
  ): void {
    this.router.navigate(['/home/simulator/proposal-preview'], {
      state: {
        offer,

        current: {
          provider: this.form.currentProvider,

          invoiceAmount: this.form.currentInvoiceAmount,

          days: this.form.days,
        },

        discountConditions: this.comparisonDiscountConditions
          ? {
              ...this.comparisonDiscountConditions,
            }
          : {},

        commercialContext: this.comparisonCommercialContext
          ? {
              ...this.comparisonCommercialContext,
            }
          : null,

        comparisonMeta: this.comparisonMeta ? { ...this.comparisonMeta } : null,

        calculationProfile,
      },
    });
  }

  isDifferentCycle(offer: InvoiceComparisonOffer): boolean {
    return (
      Boolean(this.form.cycleType) &&
      Boolean(offer.tariff.cycleType) &&
      this.form.cycleType !== offer.tariff.cycleType
    );
  }

  getCycleDifferenceText(offer: InvoiceComparisonOffer): string {
    return `${this.getCycleTypeLabel(this.form.cycleType)} → ${this.getCycleTypeLabel(
      offer.tariff.cycleType,
    )}`;
  }

  getDiscountSummary(offer: InvoiceComparisonOffer): string {
    const details = offer.simulation.details;

    if (offer.tariff.productType !== 'dual') {
      const percentage = details.discountPercentage;

      return percentage !== undefined && percentage !== null
        ? `${this.formatPercentage(percentage)}%`
        : '';
    }

    const electricityPercentage = details.electricityCost?.discountPercentage;

    const gasPercentage = details.gasCost?.discountPercentage;

    const hasElectricityPercentage =
      electricityPercentage !== undefined && electricityPercentage !== null;

    const hasGasPercentage = gasPercentage !== undefined && gasPercentage !== null;

    if (hasElectricityPercentage && hasGasPercentage) {
      if (Number(electricityPercentage) === Number(gasPercentage)) {
        return `${this.formatPercentage(electricityPercentage)}%`;
      }

      return `Luz ${this.formatPercentage(electricityPercentage)}% · Gás ${this.formatPercentage(
        gasPercentage,
      )}%`;
    }

    if (hasElectricityPercentage) {
      return `Luz ${this.formatPercentage(electricityPercentage)}%`;
    }

    if (hasGasPercentage) {
      return `Gás ${this.formatPercentage(gasPercentage)}%`;
    }

    return '';
  }

  get sortedOffers(): InvoiceComparisonOffer[] {
    const effectiveSortBy =
      this.sortBy === 'crmCertoCommission' && !this.canViewCrmCommission ? 'saving' : this.sortBy;

    return [...this.offers].sort((a, b) => {
      switch (effectiveSortBy) {
        case 'salesCommission':
          return (this.getSalesCommission(b) ?? 0) - (this.getSalesCommission(a) ?? 0);

        case 'crmCertoCommission':
          return (this.getCrmCommission(b) ?? 0) - (this.getCrmCommission(a) ?? 0);

        case 'price':
          return this.getNormalizedMonthlyCost(a) - this.getNormalizedMonthlyCost(b);

        case 'saving':
        default:
          return this.getNormalizedMonthlySaving(b) - this.getNormalizedMonthlySaving(a);
      }
    });
  }
}
