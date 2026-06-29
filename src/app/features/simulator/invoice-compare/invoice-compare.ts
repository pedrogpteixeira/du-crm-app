import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  CycleType,
  InvoiceComparisonOffer,
  InvoiceComparisonRequest,
  ProductType,
  Segment,
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

@Component({
  selector: 'app-invoice-compare',
  imports: [CommonModule, FormsModule],
  templateUrl: './invoice-compare.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './invoice-compare.scss',
})
export class InvoiceCompare {
  private readonly simulatorService = inject(SimulatorService);

  readonly availablePowers = ELECTRICITY_POWERS;
  readonly otherPowerValue = OTHER_POWER;

  readonly availableGasLevels = GAS_LEVELS;
  readonly otherGasLevelValue = OTHER_GAS_LEVEL;

  isLoading = false;
  hasSimulation = false;
  errorMessage = '';

  hasLogoError: Record<string, boolean> = {};

  offers: InvoiceComparisonOffer[] = [];

  customPower: number | null = null;
  customGasTier: number | null = null;

  selectedOffer: InvoiceComparisonOffer | null = null;

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
  };

  compareInvoice(): void {
    const payload = this.buildPayload();

    if (!payload) {
      return;
    }

    this.isLoading = true;
    this.hasSimulation = false;
    this.errorMessage = '';
    this.offers = [];

    this.simulatorService.compareInvoice(payload).subscribe({
      next: (response) => {
        this.offers = response.offers || [];
        this.hasSimulation = true;
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Não foi possível realizar a comparação da fatura.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  onProductTypeChange(): void {
    this.errorMessage = '';
    this.offers = [];
    this.hasSimulation = false;

    if (this.form.productType === 'gas') {
      this.clearElectricityFields();
      return;
    }

    if (this.form.productType === 'electricity') {
      this.clearGasFields();
    }
  }

  onTariffTypeChange(): void {
    this.errorMessage = '';
    this.offers = [];
    this.hasSimulation = false;

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

  shouldShowCycleType(): boolean {
    return this.shouldShowElectricityFields() && this.form.tariffType !== 'simple';
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

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  }

  getProviderLogo(providerName: string): string | null {
    const logos: Record<string, string> = {
      Repsol: 'assets/companies/repsol.png',
      'Meo Energias': 'assets/companies/meo.png',
      MEO: 'assets/companies/meo.png',
    };

    return logos[providerName] ?? null;
  }

  onLogoError(provider: string): void {
    this.hasLogoError[provider] = true;
  }

  private buildPayload(): InvoiceComparisonRequest | null {
    if (!this.form.currentInvoiceAmount) {
      this.errorMessage = 'O valor atual da fatura é obrigatório.';
      return null;
    }

    const payload: InvoiceComparisonRequest = {
      productType: this.form.productType,
      segment: this.form.segment,
      days: this.form.days,
      currentInvoiceAmount: this.form.currentInvoiceAmount,
    };

    this.addIfFilled(payload, 'currentProvider', this.form.currentProvider);

    if (this.shouldShowElectricityFields()) {
      const powerKva = this.getPowerKva();

      if (!powerKva) {
        this.errorMessage = 'A potência contratada é obrigatória.';
        return null;
      }

      payload.powerKva = powerKva;
      payload.tariffType = this.form.tariffType;

      if (this.shouldShowCycleType()) {
        payload.cycleType = this.form.cycleType;
      }

      if (this.form.tariffType === 'simple') {
        this.addIfFilled(payload, 'electricityConsumptionKwh', this.form.electricityConsumptionKwh);
      }

      if (this.form.tariffType === 'bi_hourly') {
        payload.electricityConsumption = {
          foraVazio: this.form.foraVazio || undefined,
          vazio: this.form.vazio || undefined,
        };
      }

      if (this.form.tariffType === 'tri_hourly') {
        payload.electricityConsumption = {
          ponta: this.form.ponta || undefined,
          cheias: this.form.cheias || undefined,
          vazio: this.form.vazio || undefined,
        };
      }

      if (this.form.tariffType === 'tetra_hourly') {
        payload.electricityConsumption = {
          ponta: this.form.ponta || undefined,
          cheias: this.form.cheias || undefined,
          vazio: this.form.vazio || undefined,
          superVazio: this.form.superVazio || undefined,
        };
      }
    }

    if (this.shouldShowGasFields()) {
      const gasTier = this.getGasTier();

      if (!gasTier) {
        this.errorMessage = 'O escalão de gás é obrigatório.';
        return null;
      }

      payload.gasTier = gasTier;

      this.addIfFilled(payload, 'gasConsumptionKwh', this.form.gasConsumptionKwh);
    }

    return payload;
  }

  private getPowerKva(): number | null {
    if (this.form.powerKva === OTHER_POWER) {
      return this.customPower;
    }

    return this.form.powerKva;
  }

  private getGasTier(): number | null {
    if (this.form.gasTier === OTHER_GAS_LEVEL) {
      return this.customGasTier;
    }

    return this.form.gasTier;
  }

  private clearElectricityFields(): void {
    this.form.tariffType = 'simple';
    this.form.cycleType = 'daily';
    this.form.powerKva = 6.9;
    this.customPower = null;

    this.form.electricityConsumptionKwh = null;
    this.form.foraVazio = null;
    this.form.vazio = null;
    this.form.superVazio = null;
    this.form.ponta = null;
    this.form.cheias = null;
  }

  private clearGasFields(): void {
    this.form.gasTier = 1;
    this.customGasTier = null;
    this.form.gasConsumptionKwh = null;
  }

  private addIfFilled<T extends object>(payload: T, key: string, value: unknown): void {
    if (value === null || value === undefined || value === '') {
      return;
    }

    (payload as Record<string, unknown>)[key] = value;
  }

  openOfferDetails(offer: InvoiceComparisonOffer): void {
    this.selectedOffer = offer;
  }

  closeOfferDetails(): void {
    this.selectedOffer = null;
  }

  hasElectricityPrices(offer: InvoiceComparisonOffer): boolean {
    return (
      !!offer.tariff.powerPricePerDay ||
      !!offer.tariff.singleEnergyPrice ||
      !!offer.tariff.foraVazioEnergyPrice ||
      !!offer.tariff.vazioEnergyPrice ||
      !!offer.tariff.pontaEnergyPrice ||
      !!offer.tariff.cheiasEnergyPrice ||
      !!offer.tariff.superVazioEnergyPrice
    );
  }

  hasGasPrices(offer: InvoiceComparisonOffer): boolean {
    return !!offer.tariff.fixedTermPerDay || !!offer.tariff.gasEnergyPrice;
  }

  hasCampaignDates(offer: InvoiceComparisonOffer): boolean {
    return !!offer.tariff.startDate || !!offer.tariff.endDate;
  }

  hasDualCostBreakdown(offer: InvoiceComparisonOffer): boolean {
    return !!offer.simulation.details.electricityCost || !!offer.simulation.details.gasCost;
  }

  formatDecimalPrice(value?: number): string {
    if (value === null || value === undefined) {
      return '—';
    }

    return new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value);
  }

  formatDate(date?: string): string {
    if (!date) {
      return '—';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsedDate);
  }
}
