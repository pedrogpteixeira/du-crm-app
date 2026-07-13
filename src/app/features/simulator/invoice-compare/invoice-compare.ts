import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import {
  CycleType,
  IndexedElectricityScenarios,
  IndexedGasScenarios,
  IndexedSimulationScenario,
  InvoiceComparisonOffer,
  InvoiceComparisonRequest,
  ProductType,
  Segment,
  SimulationDiscountConditions,
  SimulatorService,
  TariffType,
} from '../../../core/services/simulator';

import {
  ELECTRICITY_POWERS,
  GAS_LEVELS,
  OTHER_GAS_LEVEL,
  OTHER_POWER,
} from '../../../core/constants/energy';

type PowerSelection =
  | number
  | typeof OTHER_POWER;

type GasTierSelection =
  | number
  | typeof OTHER_GAS_LEVEL;

type ElectricityScenarioKey =
  keyof IndexedElectricityScenarios;

type GasScenarioKey =
  keyof IndexedGasScenarios;

@Component({
  selector: 'app-invoice-compare',
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl: './invoice-compare.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './invoice-compare.scss',
})
export class InvoiceCompare {
  private readonly simulatorService =
    inject(SimulatorService);

  private readonly router =
    inject(Router);

  readonly availablePowers =
    ELECTRICITY_POWERS;

  readonly otherPowerValue =
    OTHER_POWER;

  readonly availableGasLevels =
    GAS_LEVELS;

  readonly otherGasLevelValue =
    OTHER_GAS_LEVEL;

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

  isLoading = false;
  hasSimulation = false;
  errorMessage = '';

  hasLogoError: Record<string, boolean> = {};

  offers: InvoiceComparisonOffer[] = [];

  customPower: number | null = null;
  customGasTier: number | null = null;

  selectedOffer:
    | InvoiceComparisonOffer
    | null = null;

  form = {
    currentProvider: '',

    productType:
      'electricity' as ProductType,

    segment:
      'business' as Segment,

    tariffType:
      'simple' as TariffType,

    cycleType:
      'daily' as CycleType,

    powerKva:
      6.9 as PowerSelection,

    gasTier:
      1 as GasTierSelection,

    days: 30,

    currentInvoiceAmount:
      null as number | null,

    electricityConsumptionKwh:
      null as number | null,

    gasConsumptionKwh:
      null as number | null,

    foraVazio:
      null as number | null,

    vazio:
      null as number | null,

    superVazio:
      null as number | null,

    ponta:
      null as number | null,

    cheias:
      null as number | null,

    discountConditions: {
      electronicInvoice: false,
      directDebit: false,
      welcomeBonus: false,
      sva: false,
      gasBonus: false,
    } as Required<SimulationDiscountConditions>,
  };

  compareInvoice(): void {
    if (this.isLoading) {
      return;
    }

    const payload =
      this.buildInvoiceComparePayload();

    if (!payload) {
      return;
    }

    this.isLoading = true;
    this.hasSimulation = false;
    this.errorMessage = '';
    this.offers = [];
    this.selectedOffer = null;

    this.simulatorService
      .compareInvoice(payload)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.offers =
            response.offers || [];

          this.hasSimulation = true;
        },
        error: (error) => {
          this.errorMessage =
            this.getComparisonErrorMessage(error);

          this.hasSimulation = false;
        },
      });
  }

  onProductTypeChange(): void {
    this.clearResults();

    if (this.form.productType === 'gas') {
      this.clearElectricityFields();
      return;
    }

    if (
      this.form.productType ===
      'electricity'
    ) {
      this.clearGasFields();

      this.form.discountConditions.gasBonus =
        false;
    }
  }

  onTariffTypeChange(): void {
    this.clearResults();

    if (
      this.form.tariffType === 'simple'
    ) {
      this.form.cycleType = 'daily';

      this.form.foraVazio = null;
      this.form.vazio = null;
      this.form.superVazio = null;
      this.form.ponta = null;
      this.form.cheias = null;

      return;
    }

    this.form.electricityConsumptionKwh =
      null;

    if (
      this.form.tariffType ===
      'bi_hourly'
    ) {
      this.form.ponta = null;
      this.form.cheias = null;
      this.form.superVazio = null;

      return;
    }

    if (
      this.form.tariffType ===
      'tri_hourly'
    ) {
      this.form.foraVazio = null;
      this.form.superVazio = null;

      return;
    }

    if (
      this.form.tariffType ===
      'tetra_hourly'
    ) {
      this.form.foraVazio = null;
    }
  }

  shouldShowElectricityFields(): boolean {
    return (
      this.form.productType ===
        'electricity' ||
      this.form.productType ===
        'dual'
    );
  }

  shouldShowGasFields(): boolean {
    return (
      this.form.productType === 'gas' ||
      this.form.productType === 'dual'
    );
  }

  shouldShowGasBonus(): boolean {
    return (
      this.form.productType === 'gas' ||
      this.form.productType === 'dual'
    );
  }

  shouldShowCycleType(): boolean {
    return (
      this.shouldShowElectricityFields() &&
      this.form.tariffType !== 'simple'
    );
  }

  shouldShowSimpleConsumption(): boolean {
    return (
      this.shouldShowElectricityFields() &&
      this.form.tariffType === 'simple'
    );
  }

  shouldShowBiHourlyConsumption(): boolean {
    return (
      this.shouldShowElectricityFields() &&
      this.form.tariffType ===
        'bi_hourly'
    );
  }

  shouldShowTriHourlyConsumption(): boolean {
    return (
      this.shouldShowElectricityFields() &&
      this.form.tariffType ===
        'tri_hourly'
    );
  }

  shouldShowTetraHourlyConsumption(): boolean {
    return (
      this.shouldShowElectricityFields() &&
      this.form.tariffType ===
        'tetra_hourly'
    );
  }

  hasGeneralDiscount(
    offer: InvoiceComparisonOffer,
  ): boolean {
    return (
      Number(
        offer.simulation.details.discountValue,
      ) > 0
    );
  }

  hasElectricityDiscount(
    offer: InvoiceComparisonOffer,
  ): boolean {
    return (
      Number(
        offer.simulation.details
          .electricityCost?.discountValue,
      ) > 0
    );
  }

  hasGasDiscount(
    offer: InvoiceComparisonOffer,
  ): boolean {
    return (
      Number(
        offer.simulation.details
          .gasCost?.discountValue,
      ) > 0
    );
  }

  hasIndexedElectricityScenarios(
    offer: InvoiceComparisonOffer,
  ): boolean {
    return Boolean(
      offer.simulation.details
        .indexedElectricityScenarios,
    );
  }

  hasIndexedGasScenarios(
    offer: InvoiceComparisonOffer,
  ): boolean {
    return Boolean(
      offer.simulation.details
        .indexedGasScenarios,
    );
  }

  getElectricityScenario(
    offer: InvoiceComparisonOffer,
    key: ElectricityScenarioKey,
  ): IndexedSimulationScenario | null {
    return (
      offer.simulation.details
        .indexedElectricityScenarios?.[key] ||
      null
    );
  }

  getGasScenario(
    offer: InvoiceComparisonOffer,
    key: GasScenarioKey,
  ): IndexedSimulationScenario | null {
    return (
      offer.simulation.details
        .indexedGasScenarios?.[key] ||
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

  getTariffTypeLabel(
    tariffType?: string,
  ): string {
    const labels: Record<string, string> = {
      simple: 'Simples',
      bi_hourly: 'Bi-horário',
      tri_hourly: 'Tri-horário',
      tetra_hourly: 'Tetra-horário',
    };

    return tariffType
      ? labels[tariffType] || tariffType
      : '—';
  }

  getCycleTypeLabel(
    cycleType?: string,
  ): string {
    const labels: Record<string, string> = {
      daily: 'Diário',
      weekly: 'Semanal',
    };

    return cycleType
      ? labels[cycleType] || cycleType
      : '—';
  }

  getProductTypeLabel(
    productType?: string,
  ): string {
    const labels: Record<string, string> = {
      electricity: 'Eletricidade',
      gas: 'Gás',
      dual: 'Luz + Gás',
    };

    return productType
      ? labels[productType] || productType
      : '—';
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

  formatScenarioPrice(
    value?: number,
  ): string {
    if (
      value === null ||
      value === undefined
    ) {
      return '—';
    }

    return new Intl.NumberFormat(
      'pt-PT',
      {
        minimumFractionDigits: 5,
        maximumFractionDigits: 5,
      },
    ).format(value);
  }

  getProviderLogo(
    providerName: string,
  ): string {
    const normalized =
      (providerName || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          '',
        );

    const logos:
      Record<string, string> = {
        repsol:
          'assets/companies/repsol.png',

        wallbox:
          'assets/companies/wallbox.png',

        meo:
          'assets/companies/meo.png',

        'meo energias':
          'assets/companies/meo.png',

        galp:
          'assets/companies/galp.png',

        iberdrola:
          'assets/companies/iberdrola.png',

        yes:
          'assets/companies/yes.png',

        'yes energy':
          'assets/companies/yes.png',

        endesa:
          'assets/companies/endesa.png',

        portulogos:
          'assets/companies/portulogos.png',

        'nossa energia':
          'assets/companies/nossa-energia.png',

        ezu:
          'assets/companies/ezu.png',

        audax:
          'assets/companies/audax.png',

        plenitude:
          'assets/companies/plenitude.png',
      };

    return (
      logos[normalized] ??
      'assets/companies/default.png'
    );
  }

  onLogoError(provider: string): void {
    this.hasLogoError[provider] = true;
  }

  private buildInvoiceComparePayload():
    | InvoiceComparisonRequest
    | null {
    const currentInvoiceAmount =
      Number(
        this.form.currentInvoiceAmount,
      );

    if (
      !Number.isFinite(
        currentInvoiceAmount,
      ) ||
      currentInvoiceAmount <= 0
    ) {
      this.errorMessage =
        'O valor atual da fatura é obrigatório.';

      return null;
    }

    const days = Number(this.form.days);

    if (
      !Number.isFinite(days) ||
      days < 1
    ) {
      this.errorMessage =
        'O número de dias faturados deve ser válido.';

      return null;
    }

    const payload:
      InvoiceComparisonRequest = {
        productType:
          this.form.productType,

        segment:
          this.form.segment,

        days,

        currentInvoiceAmount,

        discountConditions:
          this.buildDiscountConditions(),
      };

    this.addIfFilled(
      payload,
      'currentProvider',
      this.form.currentProvider.trim(),
    );

    if (
      this.shouldShowElectricityFields()
    ) {
      const powerKva =
        this.getPowerKva();

      if (
        powerKva === null ||
        !Number.isFinite(powerKva) ||
        powerKva <= 0
      ) {
        this.errorMessage =
          'A potência contratada é obrigatória.';

        return null;
      }

      payload.powerKva = powerKva;

      payload.tariffType =
        this.form.tariffType;

      if (
        this.shouldShowCycleType()
      ) {
        payload.cycleType =
          this.form.cycleType;
      }

      if (
        this.form.tariffType ===
        'simple'
      ) {
        this.addNumericIfFilled(
          payload,
          'electricityConsumptionKwh',
          this.form
            .electricityConsumptionKwh,
        );
      }

      if (this.form.tariffType === 'bi_hourly') {
        payload.electricityConsumption =
          this.cleanConsumption({
            foraVazio:
              this.form.foraVazio ?? undefined,

            vazio:
              this.form.vazio ?? undefined,
          });
      }

      if (this.form.tariffType === 'tri_hourly') {
        payload.electricityConsumption =
          this.cleanConsumption({
            ponta:
              this.form.ponta ?? undefined,

            cheias:
              this.form.cheias ?? undefined,

            vazio:
              this.form.vazio ?? undefined,
          });
      }

      if (this.form.tariffType === 'tetra_hourly') {
        payload.electricityConsumption =
          this.cleanConsumption({
            ponta:
              this.form.ponta ?? undefined,

            cheias:
              this.form.cheias ?? undefined,

            vazio:
              this.form.vazio ?? undefined,

            superVazio:
              this.form.superVazio ?? undefined,
          });
      }
    }

    if (
      this.shouldShowGasFields()
    ) {
      const gasTier =
        this.getGasTier();

      if (
        gasTier === null ||
        !Number.isFinite(gasTier) ||
        gasTier < 1
      ) {
        this.errorMessage =
          'O escalão de gás é obrigatório.';

        return null;
      }

      payload.gasTier = gasTier;

      this.addNumericIfFilled(
        payload,
        'gasConsumptionKwh',
        this.form.gasConsumptionKwh,
      );
    }

    return this.cleanPayload(payload);
  }

  private buildDiscountConditions():
    SimulationDiscountConditions {
    return {
      electronicInvoice:
        Boolean(
          this.form.discountConditions
            .electronicInvoice,
        ),

      directDebit:
        Boolean(
          this.form.discountConditions
            .directDebit,
        ),

      welcomeBonus:
        Boolean(
          this.form.discountConditions
            .welcomeBonus,
        ),

      sva:
        Boolean(
          this.form.discountConditions
            .sva,
        ),

      gasBonus:
        this.shouldShowGasBonus()
          ? Boolean(
              this.form.discountConditions
                .gasBonus,
            )
          : false,
    };
  }

  private cleanConsumption(
    consumption:
      InvoiceComparisonRequest['electricityConsumption'],
  ): InvoiceComparisonRequest['electricityConsumption'] {
    if (!consumption) {
      return undefined;
    }

    type ElectricityConsumption = NonNullable<
      InvoiceComparisonRequest['electricityConsumption']
    >;

    const cleanedConsumption = Object.fromEntries(
      Object.entries(consumption)
        .filter(([, value]) => {
          return (
            value !== undefined &&
            value !== null &&
            Number.isFinite(Number(value))
          );
        })
        .map(([key, value]) => [
          key,
          Number(value),
        ]),
    ) as ElectricityConsumption;

    return Object.keys(cleanedConsumption).length
      ? cleanedConsumption
      : undefined;
  }

  private cleanPayload(
    payload: InvoiceComparisonRequest,
  ): InvoiceComparisonRequest {
    return Object.fromEntries(
      Object.entries(payload).filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== '',
      ),
    ) as InvoiceComparisonRequest;
  }

  private getPowerKva(): number | null {
    if (
      this.form.powerKva ===
      OTHER_POWER
    ) {
      return this.customPower === null
        ? null
        : Number(this.customPower);
    }

    return Number(
      this.form.powerKva,
    );
  }

  private getGasTier(): number | null {
    if (
      this.form.gasTier ===
      OTHER_GAS_LEVEL
    ) {
      return this.customGasTier === null
        ? null
        : Number(this.customGasTier);
    }

    return Number(
      this.form.gasTier,
    );
  }

  private clearElectricityFields(): void {
    this.form.tariffType = 'simple';
    this.form.cycleType = 'daily';
    this.form.powerKva = 6.9;

    this.customPower = null;

    this.form.electricityConsumptionKwh =
      null;

    this.form.foraVazio = null;
    this.form.vazio = null;
    this.form.superVazio = null;
    this.form.ponta = null;
    this.form.cheias = null;
  }

  private clearGasFields(): void {
    this.form.gasTier = 1;

    this.customGasTier = null;

    this.form.gasConsumptionKwh =
      null;
  }

  private clearResults(): void {
    this.errorMessage = '';
    this.offers = [];
    this.hasSimulation = false;
    this.selectedOffer = null;
  }

  private addIfFilled<T extends object>(
    payload: T,
    key: string,
    value: unknown,
  ): void {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return;
    }

    (
      payload as Record<string, unknown>
    )[key] = value;
  }

  private addNumericIfFilled<
    T extends object,
  >(
    payload: T,
    key: string,
    value: number | null,
  ): void {
    if (
      value === null ||
      value === undefined
    ) {
      return;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return;
    }

    (
      payload as Record<string, unknown>
    )[key] = parsed;
  }

  private getComparisonErrorMessage(
    error: {
      error?: {
        message?: string;
      };
    },
  ): string {
    const backendMessage =
      error?.error?.message || '';

    if (
      backendMessage.includes(
        'Daily, weekly and monthly OMIE averages',
      )
    ) {
      return 'Não existem atualmente todos os valores OMIE necessários para simular os tarifários indexados de eletricidade.';
    }

    if (
      backendMessage.includes(
        'Daily, next month and next quarter MIBGAS prices',
      )
    ) {
      return 'Não existem atualmente todos os valores MIBGAS necessários para simular os tarifários indexados de gás.';
    }

    return (
      backendMessage ||
      'Não foi possível realizar a comparação da fatura.'
    );
  }

  openOfferDetails(
    offer: InvoiceComparisonOffer,
  ): void {
    this.selectedOffer = offer;
  }

  closeOfferDetails(): void {
    this.selectedOffer = null;
  }

  hasElectricityPrices(
    offer: InvoiceComparisonOffer,
  ): boolean {
    return (
      offer.tariff.powerPricePerDay !==
        undefined ||
      offer.tariff.singleEnergyPrice !==
        undefined ||
      offer.tariff
        .foraVazioEnergyPrice !==
        undefined ||
      offer.tariff.vazioEnergyPrice !==
        undefined ||
      offer.tariff.pontaEnergyPrice !==
        undefined ||
      offer.tariff.cheiasEnergyPrice !==
        undefined ||
      offer.tariff
        .superVazioEnergyPrice !==
        undefined
    );
  }

  hasGasPrices(
    offer: InvoiceComparisonOffer,
  ): boolean {
    return (
      offer.tariff.fixedTermPerDay !==
        undefined ||
      offer.tariff.gasEnergyPrice !==
        undefined
    );
  }

  hasCampaignDates(
    offer: InvoiceComparisonOffer,
  ): boolean {
    return Boolean(
      offer.tariff.startDate ||
      offer.tariff.endDate,
    );
  }

  hasDualCostBreakdown(
    offer: InvoiceComparisonOffer,
  ): boolean {
    return Boolean(
      offer.simulation.details
        .electricityCost ||
      offer.simulation.details.gasCost,
    );
  }

  formatDecimalPrice(
    value?: number,
  ): string {
    if (
      value === null ||
      value === undefined
    ) {
      return '—';
    }

    return new Intl.NumberFormat(
      'pt-PT',
      {
        minimumFractionDigits: 4,
        maximumFractionDigits: 5,
      },
    ).format(value);
  }

  formatDate(
    date?: string | null,
  ): string {
    if (!date) {
      return '—';
    }

    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime(),
      )
    ) {
      return '—';
    }

    return new Intl.DateTimeFormat(
      'pt-PT',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    ).format(parsedDate);
  }

  openProposalPreview(
    offer: InvoiceComparisonOffer,
  ): void {
    this.router.navigate(
      ['/home/simulator/proposal-preview'],
      {
        state: {
          offer,

          current: {
            provider:
              this.form.currentProvider,

            invoiceAmount:
              this.form.currentInvoiceAmount,

            days:
              this.form.days,
          },

          discountConditions: {
            ...this.form.discountConditions,
          },
        },
      },
    );
  }

  isDifferentCycle(
    offer: InvoiceComparisonOffer,
  ): boolean {
    return (
      Boolean(this.form.cycleType) &&
      Boolean(offer.tariff.cycleType) &&
      this.form.cycleType !==
        offer.tariff.cycleType
    );
  }

  getCycleDifferenceText(
    offer: InvoiceComparisonOffer,
  ): string {
    return `${this.getCycleTypeLabel(
      this.form.cycleType,
    )} → ${this.getCycleTypeLabel(
      offer.tariff.cycleType,
    )}`;
  }
}