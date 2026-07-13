import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import {
  IndexedElectricityScenarios,
  IndexedGasScenarios,
  IndexedSimulationScenario,
  SimulationDiscountConditions,
  SimulationEnergyCostDetails,
  TariffDiscounts,
} from '../../../core/services/simulator';

import { ProposalData } from './proposal-document.types';

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

type ElectricityScenarioKey =
  keyof IndexedElectricityScenarios;

type GasScenarioKey =
  keyof IndexedGasScenarios;

interface DiscountDisplayItem {
  label: string;
  value: number;
}

interface ConditionDisplayItem {
  label: string;
  active: boolean;
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
    'Estimativa parcial: os valores apresentados incluem os termos comerciais de energia e os termos fixos configurados, mas ainda não incluem todas as tarifas de acesso às redes, impostos, IVA, contribuição audiovisual e outras taxas legalmente aplicáveis. O valor final da fatura poderá ser superior.';

  readonly electricityScenarioKeys:
    ElectricityScenarioKey[] = [
      'daily',
      'weekly',
      'monthly',
    ];

  readonly gasScenarioKeys:
    GasScenarioKey[] = [
      'daily',
      'nextMonth',
      'nextQuarter',
    ];

  get theme(): ProposalTheme {
    const provider = this.normalizeProviderName(
      this.proposal.offer.tariff.provider.name,
    );

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
        name:
          this.proposal.offer.tariff.provider.name,

        logo:
          'assets/companies/default.png',

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

  private normalizeProviderName(
    provider?: string,
  ): string {
    return (provider || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  hasElectricity(): boolean {
    const productType =
      this.proposal.offer.tariff.productType;

    return (
      productType === 'electricity' ||
      productType === 'dual'
    );
  }

  hasGas(): boolean {
    const productType =
      this.proposal.offer.tariff.productType;

    return (
      productType === 'gas' ||
      productType === 'dual'
    );
  }

  isIndexedElectricity(): boolean {
    return (
      this.hasElectricity() &&
      this.proposal.offer.tariff
        .electricityPriceMode === 'indexed'
    );
  }

  isIndexedGas(): boolean {
    return (
      this.hasGas() &&
      this.proposal.offer.tariff
        .gasPriceMode === 'indexed'
    );
  }

  isFixedElectricity(): boolean {
    return (
      this.hasElectricity() &&
      this.proposal.offer.tariff
        .electricityPriceMode === 'fixed'
    );
  }

  isFixedGas(): boolean {
    return (
      this.hasGas() &&
      this.proposal.offer.tariff
        .gasPriceMode === 'fixed'
    );
  }

  hasElectricityScenarios(): boolean {
    return Boolean(
      this.proposal.offer.simulation.details
        .indexedElectricityScenarios,
    );
  }

  hasGasScenarios(): boolean {
    return Boolean(
      this.proposal.offer.simulation.details
        .indexedGasScenarios,
    );
  }

  getElectricityScenario(
    key: ElectricityScenarioKey,
  ): IndexedSimulationScenario | null {
    return (
      this.proposal.offer.simulation.details
        .indexedElectricityScenarios?.[key] ??
      null
    );
  }

  getGasScenario(
    key: GasScenarioKey,
  ): IndexedSimulationScenario | null {
    return (
      this.proposal.offer.simulation.details
        .indexedGasScenarios?.[key] ??
      null
    );
  }

  getElectricityScenarioLabel(
    key: ElectricityScenarioKey,
  ): string {
    const labels:
      Record<ElectricityScenarioKey, string> = {
        daily: 'Média diária',
        weekly: 'Média semanal',
        monthly: 'Média mensal',
      };

    return labels[key];
  }

  getGasScenarioLabel(
    key: GasScenarioKey,
  ): string {
    const labels:
      Record<GasScenarioKey, string> = {
        daily: 'Diário',
        nextMonth: 'Próximo mês',
        nextQuarter: 'Próximo trimestre',
      };

    return labels[key];
  }

  isMainElectricityScenario(
    key: ElectricityScenarioKey,
  ): boolean {
    return key === 'monthly';
  }

  isMainGasScenario(
    key: GasScenarioKey,
  ): boolean {
    return key === 'nextMonth';
  }

  getElectricityDiscounts():
    DiscountDisplayItem[] {
    return this.getDiscountDisplayItems(
      this.proposal.offer.tariff
        .electricityDiscounts,
    );
  }

  getGasDiscounts():
    DiscountDisplayItem[] {
    return this.getDiscountDisplayItems(
      this.proposal.offer.tariff
        .gasDiscounts,
    );
  }

  hasElectricityDiscounts(): boolean {
    return (
      this.getElectricityDiscounts().length >
      0
    );
  }

  hasGasDiscounts(): boolean {
    return (
      this.getGasDiscounts().length > 0
    );
  }

  getSelectedConditions():
    ConditionDisplayItem[] {
    const conditions =
      this.proposal.discountConditions;

    if (!conditions) {
      return [];
    }

    const labels:
      Record<
        keyof SimulationDiscountConditions,
        string
      > = {
        electronicInvoice:
          'Fatura eletrónica',

        directDebit:
          'Débito direto',

        welcomeBonus:
          'Bónus de boas-vindas',

        sva:
          'Serviço de valor acrescentado',

        gasBonus:
          'Bónus de gás',
      };

    return (
      Object.entries(conditions) as Array<
        [
          keyof SimulationDiscountConditions,
          boolean | undefined,
        ]
      >
    )
      .filter(([, active]) =>
        Boolean(active),
      )
      .map(([key, active]) => ({
        label: labels[key],
        active: Boolean(active),
      }));
  }

  hasSelectedConditions(): boolean {
    return (
      this.getSelectedConditions().length > 0
    );
  }

  hasGeneralDiscount(): boolean {
    return (
      Number(
        this.proposal.offer.simulation.details
          .discountValue,
      ) > 0
    );
  }

  hasElectricityCost(): boolean {
    return Boolean(
      this.proposal.offer.simulation.details
        .electricityCost,
    );
  }

  hasGasCost(): boolean {
    return Boolean(
      this.proposal.offer.simulation.details
        .gasCost,
    );
  }

  getElectricityCost():
    | SimulationEnergyCostDetails
    | null {
    return (
      this.proposal.offer.simulation.details
        .electricityCost ?? null
    );
  }

  getGasCost():
    | SimulationEnergyCostDetails
    | null {
    return (
      this.proposal.offer.simulation.details
        .gasCost ?? null
    );
  }

  private getDiscountDisplayItems(
    discounts?: TariffDiscounts,
  ): DiscountDisplayItem[] {
    if (!discounts) {
      return [];
    }

    const labels:
      Record<keyof TariffDiscounts, string> = {
        electronicInvoice:
          'Fatura eletrónica',

        directDebit:
          'Débito direto',

        welcomeBonus:
          'Bónus de boas-vindas',

        sva:
          'Serviço de valor acrescentado',

        gasBonus:
          'Bónus de gás',
      };

    return (
      Object.entries(discounts) as Array<
        [keyof TariffDiscounts, number]
      >
    )
      .filter(([, value]) => {
        return (
          value !== null &&
          value !== undefined &&
          Number(value) > 0
        );
      })
      .map(([key, value]) => ({
        label: labels[key],
        value: Number(value),
      }));
  }

  formatCurrency(value?: number): string {
    return new Intl.NumberFormat(
      'pt-PT',
      {
        style: 'currency',
        currency: 'EUR',
      },
    ).format(Number(value || 0));
  }

  formatPercentage(value?: number): string {
    return new Intl.NumberFormat(
      'pt-PT',
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      },
    ).format(Number(value || 0));
  }

  formatDate(date = new Date()): string {
    return new Intl.DateTimeFormat(
      'pt-PT',
    ).format(date);
  }

  getProductLabel(value?: string): string {
    const labels: Record<string, string> = {
      electricity: 'Eletricidade',
      gas: 'Gás',
      dual: 'Luz + Gás',
    };

    return value
      ? labels[value] || value
      : '—';
  }

  getTariffLabel(value?: string): string {
    const labels: Record<string, string> = {
      simple: 'Simples',
      bi_hourly: 'Bi-horário',
      tri_hourly: 'Tri-horário',
      tetra_hourly: 'Tetra-horário',
    };

    return value
      ? labels[value] || value
      : '—';
  }

  getCycleLabel(value?: string): string {
    const labels: Record<string, string> = {
      daily: 'Diário',
      weekly: 'Semanal',
    };

    return value
      ? labels[value] || value
      : '—';
  }

  getPriceModeLabel(
    value?: string,
  ): string {
    const labels: Record<string, string> = {
      fixed: 'Preço fixo',
      indexed: 'Preço indexado',
    };

    return value
      ? labels[value] || value
      : '—';
  }

  getSegmentLabel(value?: string): string {
    const labels: Record<string, string> = {
      business: 'Empresa',
      residential: 'Cliente particular',
      condominium: 'Condomínio',
    };

    return value
      ? labels[value] || value
      : 'Cliente';
  }

  getCoverTitle(): string {
    const segment =
      this.proposal.offer.tariff.segment;

    const titles: Record<string, string> = {
      business:
        'A energia certa\npara o seu negócio.',

      residential:
        'A energia certa\npara a sua casa.',

      condominium:
        'A energia certa\npara o seu condomínio.',
    };

    return (
      titles[segment || ''] ||
      'A energia certa\npara si.'
    );
  }

  getCoverIntro(): string {
    const segment =
      this.proposal.offer.tariff.segment;

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

  formatPrice(
    value?: number,
    suffix = '€/kWh',
  ): string {
    if (
      value === undefined ||
      value === null
    ) {
      return '—';
    }

    return `${new Intl.NumberFormat(
      'pt-PT',
      {
        minimumFractionDigits: 4,
        maximumFractionDigits: 5,
      },
    ).format(value)} ${suffix}`;
  }
}