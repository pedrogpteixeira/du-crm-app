import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Company, CompanyService } from '../../../core/services/company';

import {
  CreateSimulationTariffRequest,
  SimulationCycleType,
  SimulationProductType,
  SimulationSegment,
  SimulationTariffType,
  SimulatorService,
} from '../../../core/services/simulator';

import {
  ELECTRICITY_POWERS,
  GAS_LEVELS,
} from '../../../core/constants/energy';

@Component({
  selector: 'app-tariff-create',
  imports: [CommonModule, FormsModule],
  templateUrl: './tariff-create.html',
  styleUrl: './tariff-create.scss',
})
export class TariffCreate implements OnInit{
  private readonly simulatorService = inject(SimulatorService);
  private readonly companyService = inject(CompanyService);

  readonly availablePowers = ELECTRICITY_POWERS;
  readonly availableGasLevels = GAS_LEVELS;

  companies: Company[] = [];
  isLoadingCompanies = false;

  isCreating = false;
  successMessage = '';
  errorMessage = '';

  form = {
    companyId: '',
    name: '',

    productType: 'electricity' as SimulationProductType,
    segment: 'business' as SimulationSegment,

    tariffType: 'simple' as SimulationTariffType,
    cycleType: 'daily' as SimulationCycleType,

    powerKva: 6.9 as number | null,
    gasTier: 1 as number | null,

    powerPricePerDay: null as number | null,
    fixedTermPerDay: null as number | null,

    singleEnergyPrice: null as number | null,
    gasEnergyPrice: null as number | null,

    foraVazioEnergyPrice: null as number | null,
    vazioEnergyPrice: null as number | null,
    pontaEnergyPrice: null as number | null,
    cheiasEnergyPrice: null as number | null,
    superVazioEnergyPrice: null as number | null,

    startDate: '',
    endDate: '',
  };

  ngOnInit(): void {
    this.loadCompanies();
  }

  private loadCompanies(): void {
    this.isLoadingCompanies = true;

    this.companyService.getCompanies().subscribe({
      next: (companies) => {
        this.companies = companies.filter(
          (company) => company.active,
        );

        if (this.companies.length && !this.form.companyId) {
          this.form.companyId = this.companies[0].id;
        }
      },
      complete: () => {
        this.isLoadingCompanies = false;
      },
    });
  }

  onProductTypeChange(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.productType === 'gas') {
      this.clearElectricityFields();
      return;
    }

    if (this.form.productType === 'electricity') {
      this.clearGasFields();
      this.form.tariffType ||= 'simple';
      this.form.powerKva ||= 6.9;
      return;
    }

    if (this.form.productType === 'dual') {
      this.form.tariffType ||= 'simple';
      this.form.powerKva ||= 6.9;
      this.form.gasTier ||= 1;
    }
  }

  onTariffTypeChange(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.tariffType === 'simple') {
      this.form.cycleType = 'daily';
      this.form.foraVazioEnergyPrice = null;
      this.form.vazioEnergyPrice = null;
      this.form.pontaEnergyPrice = null;
      this.form.cheiasEnergyPrice = null;
      this.form.superVazioEnergyPrice = null;
      return;
    }

    this.form.singleEnergyPrice = null;

    if (this.form.tariffType === 'bi_hourly') {
      this.form.pontaEnergyPrice = null;
      this.form.cheiasEnergyPrice = null;
      this.form.superVazioEnergyPrice = null;
      return;
    }

    if (this.form.tariffType === 'tri_hourly') {
      this.form.foraVazioEnergyPrice = null;
      this.form.superVazioEnergyPrice = null;
      return;
    }

    if (this.form.tariffType === 'tetra_hourly') {
      this.form.foraVazioEnergyPrice = null;
    }
  }

  createTariff(): void {
    const payload = this.buildPayload();

    if (!payload) {
      return;
    }

    this.isCreating = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.simulatorService.createSimulationTariff(payload).subscribe({
      next: () => {
        this.successMessage = 'Tarifário criado com sucesso.';
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.details?.join(' ') ||
          error?.error?.message ||
          'Não foi possível criar o tarifário.';
      },
      complete: () => {
        this.isCreating = false;
      },
    });
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

  shouldShowSimplePrices(): boolean {
    return this.shouldShowElectricityFields() && this.form.tariffType === 'simple';
  }

  shouldShowBiHourlyPrices(): boolean {
    return this.shouldShowElectricityFields() && this.form.tariffType === 'bi_hourly';
  }

  shouldShowTriHourlyPrices(): boolean {
    return this.shouldShowElectricityFields() && this.form.tariffType === 'tri_hourly';
  }

  shouldShowTetraHourlyPrices(): boolean {
    return this.shouldShowElectricityFields() && this.form.tariffType === 'tetra_hourly';
  }

  private buildPayload(): CreateSimulationTariffRequest | null {
    if (!this.form.companyId.trim()) {
      this.errorMessage = 'A empresa é obrigatória.';
      return null;
    }

    if (!this.form.name.trim()) {
      this.errorMessage = 'O nome do tarifário é obrigatório.';
      return null;
    }

    const payload: CreateSimulationTariffRequest = {
      companyId: this.form.companyId.trim(),
      name: this.form.name.trim(),
      productType: this.form.productType,
      segment: this.form.segment,
    };

    if (this.shouldShowElectricityFields()) {
      if (!this.form.powerKva || !this.form.powerPricePerDay) {
        this.errorMessage = 'A potência e o preço potência/dia são obrigatórios.';
        return null;
      }

      payload.tariffType = this.form.tariffType;
      payload.powerKva = this.form.powerKva;
      payload.powerPricePerDay = this.form.powerPricePerDay;

      if (this.shouldShowCycleType()) {
        payload.cycleType = this.form.cycleType;
      }

      if (this.form.tariffType === 'simple') {
        if (!this.form.singleEnergyPrice) {
          this.errorMessage = 'O preço de energia simples é obrigatório.';
          return null;
        }

        payload.singleEnergyPrice = this.form.singleEnergyPrice;
      }

      if (this.form.tariffType === 'bi_hourly') {
        if (!this.form.foraVazioEnergyPrice || !this.form.vazioEnergyPrice) {
          this.errorMessage = 'Os preços fora vazio e vazio são obrigatórios.';
          return null;
        }

        payload.foraVazioEnergyPrice = this.form.foraVazioEnergyPrice;
        payload.vazioEnergyPrice = this.form.vazioEnergyPrice;
      }

      if (this.form.tariffType === 'tri_hourly') {
        if (
          !this.form.pontaEnergyPrice ||
          !this.form.cheiasEnergyPrice ||
          !this.form.vazioEnergyPrice
        ) {
          this.errorMessage = 'Os preços ponta, cheias e vazio são obrigatórios.';
          return null;
        }

        payload.pontaEnergyPrice = this.form.pontaEnergyPrice;
        payload.cheiasEnergyPrice = this.form.cheiasEnergyPrice;
        payload.vazioEnergyPrice = this.form.vazioEnergyPrice;
      }

      if (this.form.tariffType === 'tetra_hourly') {
        if (
          !this.form.pontaEnergyPrice ||
          !this.form.cheiasEnergyPrice ||
          !this.form.vazioEnergyPrice ||
          !this.form.superVazioEnergyPrice
        ) {
          this.errorMessage =
            'Os preços ponta, cheias, vazio e super vazio são obrigatórios.';
          return null;
        }

        payload.pontaEnergyPrice = this.form.pontaEnergyPrice;
        payload.cheiasEnergyPrice = this.form.cheiasEnergyPrice;
        payload.vazioEnergyPrice = this.form.vazioEnergyPrice;
        payload.superVazioEnergyPrice = this.form.superVazioEnergyPrice;
      }
    }

    if (this.shouldShowGasFields()) {
      if (
        !this.form.gasTier ||
        !this.form.fixedTermPerDay ||
        !this.form.gasEnergyPrice
      ) {
        this.errorMessage =
          'O escalão, termo fixo/dia e preço de energia gás são obrigatórios.';
        return null;
      }

      payload.gasTier = this.form.gasTier;
      payload.fixedTermPerDay = this.form.fixedTermPerDay;
      payload.gasEnergyPrice = this.form.gasEnergyPrice;
    }

    if (this.form.startDate) {
      payload.startDate = new Date(this.form.startDate).toISOString();
    }

    if (this.form.endDate) {
      payload.endDate = new Date(this.form.endDate).toISOString();
    }

    return this.cleanPayload(payload);
  }

  private cleanPayload(
    payload: CreateSimulationTariffRequest,
  ): CreateSimulationTariffRequest {
    return Object.fromEntries(
      Object.entries(payload).filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== '',
      ),
    ) as CreateSimulationTariffRequest;
  }

  private clearElectricityFields(): void {
    this.form.tariffType = 'simple';
    this.form.cycleType = 'daily';

    this.form.powerKva = null;
    this.form.powerPricePerDay = null;

    this.form.singleEnergyPrice = null;
    this.form.foraVazioEnergyPrice = null;
    this.form.vazioEnergyPrice = null;
    this.form.pontaEnergyPrice = null;
    this.form.cheiasEnergyPrice = null;
    this.form.superVazioEnergyPrice = null;
  }

  private clearGasFields(): void {
    this.form.gasTier = null;
    this.form.fixedTermPerDay = null;
    this.form.gasEnergyPrice = null;
  }
}