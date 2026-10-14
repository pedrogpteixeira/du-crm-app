import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import {
  AdvancedPricingBreakdown,
  IndexedElectricityScenarios,
  IndexedGasScenarios,
  IndexedSimulationScenario,
  SimulationCalculationStrategy,
  SimulationCommissionMode,
  SimulationDiscountConditions,
  SimulationEnergyCostDetails,
  TariffDiscounts,
} from '../../../core/services/simulator';

import { ProposalData } from './proposal-document.types';
import { getSimulationCalculationBasisLabel } from '../../../core/utils/simulation-calculation-basis';

interface ProposalTheme {
  name: string;
  logo: string;

  primary: string;
  secondary: string;
  light: string;

  coverGradient: string;
  savingCard: string;
  accentIcon: string;

  fontColor: string;
}

type ElectricityScenarioKey = keyof IndexedElectricityScenarios;

type GasScenarioKey = keyof IndexedGasScenarios;

interface DiscountDisplayItem {
  label: string;
  value: number;
}

interface ProposalInfoItem {
  label: string;
  value: string;
}

interface PricingBreakdownItem {
  label: string;
  value: number;
}

interface IncludedComponentItem {
  label: string;
  included: boolean;
}

@Component({
  selector: 'app-proposal-document',
  imports: [CommonModule],
  templateUrl: './proposal-document.html',
  styleUrl: './proposal-document.scss',
})
export class ProposalDocument {
  @Input({ required: true })
  proposal!: ProposalData;

  readonly partialEstimateNotice =
    'Estimativa parcial: Os Preços de potência é o valor definido pelas entidades competentes em relação às Tarifas de Acesso às Redes (Energia e Potência). As variações que se venham a verificar nos elementos regulados (tarifas de acesso e outros) aplicáveis, assim como os novos que possam surgir, transferir-se-ão para o cliente, tanto no caso de acréscimo como de decréscimo. Os preços de potência incluem a tarifa de acessos às redes, nos termos definidos pela ERSE, os quais, caso sejam objeto de alteração, serão refletidos diretamente no preço final. Não incluem  Impostos, IVA, contribuição audiovisual e outras taxas legalmente aplicáveis.';

  readonly electricityScenarioKeys: ElectricityScenarioKey[] = ['daily', 'weekly', 'monthly'];

  readonly gasScenarioKeys: GasScenarioKey[] = ['daily', 'nextMonth', 'nextQuarter'];

  get theme(): ProposalTheme {
    const provider = this.normalizeProviderName(this.proposal.offer.tariff.provider.name);

    const themes: Record<string, ProposalTheme> = {
      repsol: {
        name: 'Repsol',
        logo: 'assets/companies/repsol.png',
        primary: '#ff7a00',
        secondary: '#18a957',
        light: '#c8f3e9',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      wallbox: {
        name: 'Wallbox',
        logo: 'assets/companies/wallbox.png',
        primary: '#0f172a',
        secondary: '#16a34a',
        light: '#ecfdf5',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      'meo energias': {
        name: 'MEO Energia',
        logo: 'assets/companies/meo.png',
        primary: '#0050a4',
        secondary: '#00b8d9',
        light: '#eaf6ff',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      meo: {
        name: 'MEO Energia',
        logo: 'assets/companies/meo.png',
        primary: '#0050a4',
        secondary: '#00b8d9',
        light: '#eaf6ff',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      galp: {
        name: 'Galp',
        logo: 'assets/companies/galp.png',
        primary: '#f36f21',
        secondary: '#ff8a00',
        light: '#fff1e7',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      iberdrola: {
        name: 'Iberdrola',
        logo: 'assets/companies/iberdrola.png',
        primary: '#00843d',
        secondary: '#7ab800',
        light: '#edf8ef',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      'yes energy': {
        name: 'Yes Energy',
        logo: 'assets/companies/yes.png',
        primary: '#6b21a8',
        secondary: '#9333ea',
        light: '#f3e8ff',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      endesa: {
        name: 'Endesa',
        logo: 'assets/companies/endesa.png',
        primary: '#005eb8',
        secondary: '#00a3e0',
        light: '#eaf6ff',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      portulogos: {
        name: 'Portulogos',
        logo: 'assets/companies/portulogos.png',
        primary: '#0066a4',
        secondary: '#00a7d8',
        light: '#eaf8ff',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      'nossa energia': {
        name: 'Nossa Energia',
        logo: 'assets/companies/nossa-energia.png',
        primary: '#e53935',
        secondary: '#f6a800',
        light: '#fff5e5',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      ezu: {
        name: 'Ezu',
        logo: 'assets/companies/ezu.png',
        primary: '#e30613',
        secondary: '#c80012',
        light: '#fdebec',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      audax: {
        name: 'Audax',
        logo: 'assets/companies/audax.png',
        primary: '#d71920',
        secondary: '#f37021',
        light: '#fff1ec',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      plenitude: {
        name: 'Plenitude',
        logo: 'assets/companies/plenitude.png',
        primary: '#006b3f',
        secondary: '#b7d800',
        light: '#f3fae8',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },
    };

    return (
      themes[provider] || {
        name: this.proposal.offer.tariff.provider.name,

        logo: 'assets/companies/default.png',

        primary: '#008db1',
        secondary: '#00b894',
        light: '#eef6fa',

        coverGradient: '',
        savingCard: '',
        accentIcon: '',

        fontColor: '#243646',
      }
    );
  }

  private normalizeProviderName(provider?: string): string {
    return (provider || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  hasElectricity(): boolean {
    const productType = this.proposal.offer.tariff.productType;

    return productType === 'electricity' || productType === 'dual';
  }

  hasGas(): boolean {
    const productType = this.proposal.offer.tariff.productType;

    return productType === 'gas' || productType === 'dual';
  }

  isIndexedElectricity(): boolean {
    return this.hasElectricity() && this.proposal.offer.tariff.electricityPriceMode === 'indexed';
  }

  isIndexedGas(): boolean {
    return this.hasGas() && this.proposal.offer.tariff.gasPriceMode === 'indexed';
  }

  isFixedElectricity(): boolean {
    return this.hasElectricity() && this.proposal.offer.tariff.electricityPriceMode === 'fixed';
  }

  isFixedGas(): boolean {
    return this.hasGas() && this.proposal.offer.tariff.gasPriceMode === 'fixed';
  }

  hasElectricityScenarios(): boolean {
    return Boolean(this.proposal.offer.simulation.details.indexedElectricityScenarios);
  }

  hasGasScenarios(): boolean {
    return Boolean(this.proposal.offer.simulation.details.indexedGasScenarios);
  }

  getElectricityScenario(key: ElectricityScenarioKey): IndexedSimulationScenario | null {
    return this.proposal.offer.simulation.details.indexedElectricityScenarios?.[key] ?? null;
  }

  getGasScenario(key: GasScenarioKey): IndexedSimulationScenario | null {
    return this.proposal.offer.simulation.details.indexedGasScenarios?.[key] ?? null;
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

  isAdvancedOffer(): boolean {
    return Boolean(this.proposal.offer.tariff.calculationProfileId);
  }

  getCalculationProfileLabel(): string {
    const profile = this.proposal.calculationProfile;

    if (profile) {
      return `${profile.familyCode} · Versão ${profile.version}`;
    }

    return this.isAdvancedOffer() ? 'Perfil de cálculo Advanced' : 'Legacy';
  }

  getCalculationProfileStatusLabel(): string {
    const profile = this.proposal.calculationProfile;

    if (!profile) {
      return '—';
    }

    return profile.active ? 'Ativo' : 'Histórico / inativo';
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

  getStrategyLabel(strategy?: SimulationCalculationStrategy): string {
    if (!strategy) {
      return '—';
    }

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

  getProfileEnergyStrategies(): ProposalInfoItem[] {
    const profile = this.proposal.calculationProfile;
    const items: ProposalInfoItem[] = [];

    if (profile?.electricity) {
      items.push({
        label: 'Estratégia eletricidade',
        value: this.getStrategyLabel(profile.electricity.strategy),
      });
    }

    if (profile?.gas) {
      items.push({
        label: 'Estratégia gás',
        value: this.getStrategyLabel(profile.gas.strategy),
      });
    }

    return items;
  }

  getInvoicePeriodCost(): number | undefined {
    return (
      this.proposal.offer.invoicePeriodCost ?? this.proposal.offer.simulation.details.totalCost
    );
  }

  getNormalizedMonthlyCost(): number | undefined {
    return (
      this.proposal.offer.normalizedMonthlyCost ??
      this.proposal.offer.simulation.estimatedMonthlyCost
    );
  }

  getNormalizedAnnualCost(): number | undefined {
    return this.proposal.offer.normalizedAnnualCost;
  }

  getPeriodDays(): number | null {
    return (
      this.proposal.comparisonMeta?.periodDays ??
      this.proposal.offer.simulation.details.days ??
      this.proposal.current.days ??
      null
    );
  }

  getMonthlyNormalizationText(): string {
    const days = this.proposal.comparisonMeta?.normalizedMonthDays;

    return days ? `${days} dias` : 'Período mensal normalizado';
  }

  getAnnualNormalizationText(): string {
    const months = this.proposal.comparisonMeta?.normalizedYearMonths;

    return months ? `${months} meses` : 'Período anual normalizado';
  }

  getValidityLabel(): string {
    const startDate = this.proposal.offer.tariff.startDate;
    const endDate = this.proposal.offer.tariff.endDate;

    if (startDate && endDate) {
      return `${this.formatCivilDate(startDate)} — ${this.formatCivilDate(endDate)}`;
    }

    if (startDate) {
      return `Desde ${this.formatCivilDate(startDate)}`;
    }

    if (endDate) {
      return `Até ${this.formatCivilDate(endDate)}`;
    }

    return 'Sem período definido';
  }

  getCommercialContextItems(): ProposalInfoItem[] {
    const context = this.proposal.commercialContext;

    if (!context) {
      return [];
    }

    const items: ProposalInfoItem[] = [];

    if (context.paymentMethod) {
      const paymentLabels = {
        direct_debit: 'Débito Direto',
        multibanco: 'Multibanco',
        other: 'Outro',
      };

      items.push({
        label: 'Pagamento',
        value: paymentLabels[context.paymentMethod],
      });
    }

    if (context.invoiceDelivery) {
      items.push({
        label: 'Fatura',
        value: context.invoiceDelivery === 'electronic' ? 'Fatura eletrónica' : 'Fatura em papel',
      });
    }

    if (context.contractTermMonths) {
      items.push({
        label: 'Duração contratual',
        value: `${context.contractTermMonths} meses`,
      });
    }

    if (context.supplyStartDate) {
      items.push({
        label: 'Início de fornecimento',
        value: this.formatCivilDate(context.supplyStartDate),
      });
    }

    if (context.contractedPowerKw !== undefined) {
      items.push({
        label: 'Potência contratada',
        value: `${context.contractedPowerKw} kW`,
      });
    }

    if (context.voltageLevel) {
      items.push({
        label: 'Nível de tensão',
        value: context.voltageLevel,
      });
    }

    if (context.gasNetworkLevel) {
      items.push({
        label: 'Rede de gás',
        value: context.gasNetworkLevel,
      });
    }

    return items;
  }

  getAppliedConditionLabels(): string[] {
    const conditions = this.proposal.discountConditions;

    if (!conditions) {
      return [];
    }

    const labels: Array<[keyof SimulationDiscountConditions, string]> = [
      ['directDebit', 'Débito Direto'],
      ['electronicInvoice', 'Fatura eletrónica'],
      ['welcomeBonus', 'Bónus de boas-vindas'],
      ['sva', 'SVA'],
      ['loyalty', 'Fidelização'],
      ['gasBonus', 'Bónus de gás'],
      ['PEL', 'PEL'],
      ['PELPlus', 'PEL Plus'],
      ['MGI', 'MGI'],
    ];

    return labels.filter(([key]) => Boolean(conditions[key])).map(([, label]) => label);
  }

  getCalculationBasisLabel(): string | null {
    return getSimulationCalculationBasisLabel(
      this.proposal.offer.simulation.calculationBasis,
      this.proposal.offer.simulation.estimated,
    );
  }

  hasPricingBreakdown(): boolean {
    return Boolean(this.proposal.offer.pricingBreakdown);
  }

  getPricingBreakdownItems(): PricingBreakdownItem[] {
    const breakdown = this.proposal.offer.pricingBreakdown;

    if (!breakdown) {
      return [];
    }

    const definitions: Array<[keyof AdvancedPricingBreakdown, string]> = [
      ['marketEnergy', 'Energia de mercado'],
      ['fixedHedge', 'Hedge fixo'],
      ['renSystemCost', 'Custos de sistema REN'],
      ['networkAccess', 'Acesso às redes / TAR'],
      ['losses', 'Perdas'],
      ['operatingMargin', 'Margem operacional'],
      ['guaranteesOfOrigin', 'Garantias de Origem'],
      ['contractualEnergyPrice', 'Preço de energia contratual'],
      ['normalizedComparableCost', 'Custo comparável normalizado'],
    ];

    return definitions.flatMap(([key, label]) => {
      const value = breakdown[key];

      return typeof value === 'number' ? [{ label, value }] : [];
    });
  }

  getIncludedComponentItems(): IncludedComponentItem[] {
    const components = this.proposal.offer.pricingBreakdown?.includedComponents;

    if (!components) {
      return [];
    }

    const definitions = [
      ['networkAccessPower', 'TAR de potência'],
      ['networkAccessFixedTerm', 'Termo fixo TAR gás'],
      ['networkAccessEnergy', 'TAR de energia'],
      ['losses', 'Perdas'],
      ['renSystemCosts', 'REN / ERC'],
      ['mfrr', 'mFRR'],
      ['guaranteesOfOrigin', 'Garantias de Origem'],
      ['socialTariffFinancing', 'Financiamento tarifa social'],
    ] as const;

    return definitions.flatMap(([key, label]) => {
      const value = components[key];

      return value === undefined ? [] : [{ label, included: value }];
    });
  }

  getPricingMetadataItems(): ProposalInfoItem[] {
    const metadata = this.proposal.offer.pricingBreakdown?.calculationMetadata;

    const items: ProposalInfoItem[] = [];
    const calculationBasisLabel = this.getCalculationBasisLabel();

    if (calculationBasisLabel) {
      items.push({
        label: 'Base do cálculo',
        value: calculationBasisLabel,
      });
    }

    if (!metadata) {
      return items;
    }

    if (metadata.strategy) {
      items.push({
        label: 'Estratégia executada',
        value: metadata.strategy,
      });
    }

    if (metadata.marketSource) {
      items.push({
        label: 'Mercado',
        value: metadata.marketSource.toUpperCase(),
      });
    }

    if (metadata.regulatorySource) {
      items.push({
        label: 'Fonte regulatória',
        value: metadata.regulatorySource,
      });
    }

    if (metadata.regulatoryReferenceDate) {
      items.push({
        label: 'Referência regulatória',
        value: this.formatCivilDate(metadata.regulatoryReferenceDate),
      });
    }

    if (metadata.accessTariffVersion) {
      items.push({
        label: 'Versão TAR',
        value: metadata.accessTariffVersion,
      });
    }

    return items;
  }

  getEstimateNotice(): string {
    if (!this.isAdvancedOffer()) {
      return this.partialEstimateNotice;
    }

    const included = this.proposal.offer.pricingBreakdown?.includedComponents;

    if (!included) {
      return 'Pricing Advanced: o valor foi calculado pela API, mas esta oferta não devolveu detalhe suficiente para confirmar individualmente TAR e componentes regulados. O frontend não recalcula nem infere impostos, IVA, contribuição audiovisual ou outras taxas.';
    }

    if (
      included.networkAccessPower ||
      included.networkAccessFixedTerm ||
      included.networkAccessEnergy
    ) {
      return 'Pricing Advanced: o breakdown devolvido pela API assinala componentes de acesso às redes/TAR como incluídos. Impostos, IVA, contribuição audiovisual e outras taxas só são considerados quando explicitamente devolvidos pelo backend; o frontend não os estima.';
    }

    return 'Pricing Advanced: o breakdown devolvido pela API não assinala acesso às redes/TAR como incluído. O frontend não recalcula nem infere impostos, IVA, contribuição audiovisual ou outras taxas.';
  }

  formatBreakdownValue(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    }).format(value);
  }

  private formatCivilDate(value: string): string {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!match) {
      return value;
    }

    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  getElectricityDiscounts(): DiscountDisplayItem[] {
    return this.getDiscountDisplayItems(this.proposal.offer.tariff.electricityDiscounts);
  }

  getGasDiscounts(): DiscountDisplayItem[] {
    return this.getDiscountDisplayItems(this.proposal.offer.tariff.gasDiscounts);
  }

  hasElectricityDiscounts(): boolean {
    return this.getElectricityDiscounts().length > 0;
  }

  hasGasDiscounts(): boolean {
    return this.getGasDiscounts().length > 0;
  }

  hasGeneralDiscount(): boolean {
    return Number(this.proposal.offer.simulation.details.discountValue) > 0;
  }

  hasElectricityCost(): boolean {
    return Boolean(this.proposal.offer.simulation.details.electricityCost);
  }

  hasGasCost(): boolean {
    return Boolean(this.proposal.offer.simulation.details.gasCost);
  }

  getElectricityCost(): SimulationEnergyCostDetails | null {
    return this.proposal.offer.simulation.details.electricityCost ?? null;
  }

  getGasCost(): SimulationEnergyCostDetails | null {
    return this.proposal.offer.simulation.details.gasCost ?? null;
  }

  private getDiscountDisplayItems(discounts?: TariffDiscounts): DiscountDisplayItem[] {
    if (!discounts) {
      return [];
    }

    const labels: Record<keyof TariffDiscounts, string> = {
      electronicInvoice: 'Fatura eletrónica',

      directDebit: 'Débito direto',

      welcomeBonus: 'Bónus de boas-vindas',

      sva: 'Serviço de valor acrescentado',

      PEL: 'PEL',

      PELPlus: 'PEL Plus',

      MGI: 'MGI',

      loyalty: 'Fidelização',

      gasBonus: 'Bónus de gás',
    };

    return (Object.entries(discounts) as Array<[keyof TariffDiscounts, number]>)
      .filter(([, value]) => {
        return value !== null && value !== undefined && Number(value) > 0;
      })
      .map(([key, value]) => ({
        label: labels[key],
        value: Number(value),
      }));
  }

  formatCurrency(value?: number | null): string {
    if (value === undefined || value === null) {
      return '—';
    }

    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  }

  formatPercentage(value?: number): string {
    return new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    }).format(Number(value || 0));
  }

  formatDate(date = new Date()): string {
    return new Intl.DateTimeFormat('pt-PT').format(date);
  }

  getProductLabel(value?: string): string {
    const labels: Record<string, string> = {
      electricity: 'Eletricidade',
      gas: 'Gás',
      dual: 'Luz + Gás',
    };

    return value ? labels[value] || value : '—';
  }

  getTariffLabel(value?: string): string {
    const labels: Record<string, string> = {
      simple: 'Simples',
      bi_hourly: 'Bi-horário',
      tri_hourly: 'Tri-horário',
      tetra_hourly: 'Tetra-horário',
    };

    return value ? labels[value] || value : '—';
  }

  getCycleLabel(value?: string): string {
    const labels: Record<string, string> = {
      daily: 'Diário',
      weekly: 'Semanal',
    };

    return value ? labels[value] || value : '—';
  }

  getPriceModeLabel(value?: string): string {
    const labels: Record<string, string> = {
      fixed: 'Preço fixo',
      indexed: 'Preço indexado',
    };

    return value ? labels[value] || value : '—';
  }

  getSegmentLabel(value?: string): string {
    const labels: Record<string, string> = {
      business: 'Empresa',
      residential: 'Cliente particular',
      condominium: 'Condomínio',
    };

    return value ? labels[value] || value : 'Cliente';
  }

  getCoverTitle(): string {
    const segment = this.proposal.offer.tariff.segment;

    const titles: Record<string, string> = {
      business: 'A energia certa\npara o seu negócio.',

      residential: 'A energia certa\npara a sua casa.',

      condominium: 'A energia certa\npara o seu condomínio.',
    };

    return titles[segment || ''] || 'A energia certa\npara si.';
  }

  getCoverIntro(): string {
    const segment = this.proposal.offer.tariff.segment;

    const intros: Record<string, string> = {
      business:
        'Proposta personalizada com base na fatura atual e nos consumos indicados para o seu negócio.',

      residential:
        'Proposta personalizada com base na fatura atual e nos consumos indicados para a sua casa.',

      condominium:
        'Proposta personalizada com base na fatura atual e nos consumos indicados para o seu condomínio.',
    };

    return (
      intros[segment || ''] ||
      'Proposta personalizada com base na fatura atual e nos consumos indicados.'
    );
  }

  formatPrice(value?: number, suffix = '€/kWh'): string {
    if (value === undefined || value === null) {
      return '—';
    }

    return `${new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 5,
    }).format(value)} ${suffix}`;
  }
}
