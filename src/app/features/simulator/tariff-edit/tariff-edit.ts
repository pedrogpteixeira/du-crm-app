import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { Company, CompanyService } from '../../../core/services/company';

import {
  ElectricityPriceMode,
  GasPriceMode,
  ProductType,
  Segment,
  SimulationTariff,
  SimulationTariffFilters,
  SimulatorService,
  TariffType,
  UpdateSimulationTariffRequest,
} from '../../../core/services/simulator';

import {
  ELECTRICITY_POWERS,
  GAS_LEVELS,
} from '../../../core/constants/energy';

@Component({
  selector: 'app-tariff-edit',
  imports: [CommonModule, FormsModule],
  templateUrl: './tariff-edit.html',
  styleUrl: './tariff-edit.scss',
})
export class TariffEdit implements OnInit {
  private readonly simulatorService = inject(SimulatorService);
  private readonly companyService = inject(CompanyService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly availablePowers = ELECTRICITY_POWERS;
  readonly availableGasLevels = GAS_LEVELS;

  companies: Company[] = [];

  isLoadingCompanies = false;
  isSearching = false;
  isSaving = false;
  isDeleting = false;

  successMessage = '';
  errorMessage = '';

  tariffs: SimulationTariff[] = [];
  selectedTariff: SimulationTariff | null = null;

  filters: {
    name: string;
    companyId: string;
    segment: '' | Segment;
    productType: '' | ProductType;
    tariffType: '' | TariffType;
    electricityPriceMode: '' | ElectricityPriceMode;
    gasPriceMode: '' | GasPriceMode;
  } = {
    name: '',
    companyId: '',
    segment: '',
    productType: '',
    tariffType: '',
    electricityPriceMode: '',
    gasPriceMode: '',
  };

  editForm: UpdateSimulationTariffRequest = {};

  ngOnInit(): void {
    this.loadCompanies();
  }

  private loadCompanies(): void {
    this.isLoadingCompanies = true;

    this.companyService
      .getCompanies()
      .pipe(
        finalize(() => {
          this.isLoadingCompanies = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (companies) => {
          this.companies = companies.filter(
            (company) => company.active,
          );
        },
        error: () => {
          this.showError('Não foi possível carregar as empresas.');
        },
      });
  }

  searchTariffs(): void {
    const filters: SimulationTariffFilters = {
      name: this.filters.name || undefined,
      companyId: this.filters.companyId || undefined,
      segment: this.filters.segment || undefined,
      productType: this.filters.productType || undefined,
      tariffType: this.filters.tariffType || undefined,

      electricityPriceMode:
        this.filters.electricityPriceMode || undefined,

      gasPriceMode:
        this.filters.gasPriceMode || undefined,
    };

    if (!Object.keys(filters).length) {
      this.showError('Preenche pelo menos um filtro antes de pesquisar.');
      return;
    }

    this.isSearching = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedTariff = null;
    this.tariffs = [];

    this.simulatorService
      .getSimulationTariffs(filters)
      .pipe(
        finalize(() => {
          this.isSearching = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (tariffs) => {
          this.tariffs = tariffs;

          if (!tariffs.length) {
            this.showError('Não foram encontrados tarifários.');
          }
        },
        error: () => {
          this.showError('Não foi possível pesquisar tarifários.');
        },
      });
  }

  selectTariff(tariff: SimulationTariff): void {
    this.selectedTariff = tariff;

    this.editForm = {
      companyId: tariff.provider.id,
      name: tariff.name,
      productType: tariff.productType,
      electricityPriceMode: tariff.electricityPriceMode,
      gasPriceMode: tariff.gasPriceMode,
      segment: tariff.segment,
      tariffType: tariff.tariffType,
      cycleType: tariff.cycleType,
      powerKva: tariff.powerKva,
      gasTier: tariff.gasTier,
      powerPricePerDay: tariff.powerPricePerDay,
      fixedTermPerDay: tariff.fixedTermPerDay,
      singleEnergyPrice: tariff.singleEnergyPrice,
      gasEnergyPrice: tariff.gasEnergyPrice,
      foraVazioEnergyPrice: tariff.foraVazioEnergyPrice,
      vazioEnergyPrice: tariff.vazioEnergyPrice,
      pontaEnergyPrice: tariff.pontaEnergyPrice,
      cheiasEnergyPrice: tariff.cheiasEnergyPrice,
      superVazioEnergyPrice: tariff.superVazioEnergyPrice,
      salesCommission: tariff.salesCommission,
      startDate: tariff.startDate
        ? tariff.startDate.substring(0, 10)
        : '',
      endDate: tariff.endDate
        ? tariff.endDate.substring(0, 10)
        : '',
      active: tariff.active,
    };
  }

  saveTariff(): void {
    if (!this.selectedTariff) {
      return;
    }

    if (!this.validateUpdateForm()) {
      return;
    }

    const payload = this.buildUpdatePayload();

    if (!Object.keys(payload).length) {
      this.showError('Não existem alterações para guardar.');
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.simulatorService
      .updateSimulationTariff(this.selectedTariff.id, payload)
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (updatedTariff) => {
          this.selectedTariff = updatedTariff;

          this.tariffs = this.tariffs.map((tariff) =>
            tariff.id === updatedTariff.id ? updatedTariff : tariff,
          );

          this.showSuccess('Tarifário atualizado com sucesso.');
        },
        error: (error) => {
          if (error?.status === 409) {
            this.showError(
              error?.error?.message ||
                'Já existe um tarifário com esta configuração.',
            );
            return;
          }

          this.showError(
            error?.error?.details?.join(' ') ||
              error?.error?.message ||
              'Não foi possível atualizar o tarifário.',
          );
        },
      });
  }

  private validateUpdateForm(): boolean {
    if (!this.editForm.name?.trim()) {
      this.showError('O nome do tarifário é obrigatório.');
      return false;
    }

    if (
      this.editForm.salesCommission === undefined ||
      this.editForm.salesCommission === null ||
      !Number.isFinite(Number(this.editForm.salesCommission)) ||
      Number(this.editForm.salesCommission) < 0
    ) {
      this.showError(
        'Introduz uma comissão de venda válida.',
      );
      return false;
    }

    if (this.shouldEditShowElectricityFields()) {
      if (
        this.editForm.powerKva === undefined ||
        this.editForm.powerKva === null ||
        this.editForm.powerPricePerDay === undefined ||
        this.editForm.powerPricePerDay === null
      ) {
        this.showError(
          'A potência e o preço de potência por dia são obrigatórios.',
        );

        return false;
      }

      if (
        this.shouldEditShowCycleType() &&
        !this.editForm.cycleType
      ) {
        this.showError('Seleciona o ciclo horário.');
        return false;
      }

      if (
        this.editForm.electricityPriceMode === 'fixed' &&
        !this.validateFixedElectricityPrices()
      ) {
        return false;
      }
    }

    if (this.shouldEditShowGasFields()) {
      if (
        this.editForm.gasTier === undefined ||
        this.editForm.gasTier === null ||
        this.editForm.fixedTermPerDay === undefined ||
        this.editForm.fixedTermPerDay === null
      ) {
        this.showError(
          'O escalão e o termo fixo do gás são obrigatórios.',
        );

        return false;
      }

      if (
        this.editForm.gasPriceMode === 'fixed' &&
        (
          this.editForm.gasEnergyPrice === undefined ||
          this.editForm.gasEnergyPrice === null
        )
      ) {
        this.showError(
          'O preço de energia do gás é obrigatório.',
        );

        return false;
      }
    }

    return true;
  }

  private validateFixedElectricityPrices(): boolean {
    const isMissing = (
      value: number | undefined,
    ): boolean =>
      value === undefined ||
      value === null ||
      !Number.isFinite(Number(value)) ||
      Number(value) < 0;

    switch (this.editForm.tariffType) {
      case 'simple':
        if (isMissing(this.editForm.singleEnergyPrice)) {
          this.showError(
            'O preço de energia simples é obrigatório.',
          );

          return false;
        }

        break;

      case 'bi_hourly':
        if (
          isMissing(this.editForm.foraVazioEnergyPrice) ||
          isMissing(this.editForm.vazioEnergyPrice)
        ) {
          this.showError(
            'Os preços fora vazio e vazio são obrigatórios.',
          );

          return false;
        }

        break;

      case 'tri_hourly':
        if (
          isMissing(this.editForm.pontaEnergyPrice) ||
          isMissing(this.editForm.cheiasEnergyPrice) ||
          isMissing(this.editForm.vazioEnergyPrice)
        ) {
          this.showError(
            'Os preços ponta, cheias e vazio são obrigatórios.',
          );

          return false;
        }

        break;

      case 'tetra_hourly':
        if (
          isMissing(this.editForm.pontaEnergyPrice) ||
          isMissing(this.editForm.cheiasEnergyPrice) ||
          isMissing(this.editForm.vazioEnergyPrice) ||
          isMissing(this.editForm.superVazioEnergyPrice)
        ) {
          this.showError(
            'Os preços ponta, cheias, vazio e super vazio são obrigatórios.',
          );

          return false;
        }

        break;
    }

    return true;
  }

  clearFilters(): void {
    this.filters = {
      name: '',
      companyId: '',
      segment: '',
      productType: '',
      tariffType: '',
      electricityPriceMode: '',
      gasPriceMode: '',
    };

    this.tariffs = [];
    this.selectedTariff = null;
    this.errorMessage = '';
    this.successMessage = '';
  }

  private buildUpdatePayload(): UpdateSimulationTariffRequest {
    if (!this.selectedTariff) {
      return {};
    }

    const payload: UpdateSimulationTariffRequest = {
      name: this.editForm.name,
      segment: this.editForm.segment,

      salesCommission: this.editForm.salesCommission,
      active: this.editForm.active,

      startDate: this.editForm.startDate
        ? new Date(this.editForm.startDate).toISOString()
        : undefined,

      endDate: this.editForm.endDate
        ? new Date(this.editForm.endDate).toISOString()
        : undefined,
    };

    if (this.shouldEditShowElectricityFields()) {
      payload.powerKva = this.editForm.powerKva;
      payload.powerPricePerDay =
        this.editForm.powerPricePerDay;

      if (this.shouldEditShowCycleType()) {
        payload.cycleType = this.editForm.cycleType;
      }

      if (
        this.editForm.electricityPriceMode === 'fixed'
      ) {
        this.appendElectricityPricesToPayload(payload);
      }
    }

    if (this.shouldEditShowGasFields()) {
      payload.gasTier = this.editForm.gasTier;
      payload.fixedTermPerDay =
        this.editForm.fixedTermPerDay;

      if (this.editForm.gasPriceMode === 'fixed') {
        payload.gasEnergyPrice =
          this.editForm.gasEnergyPrice;
      }
    }

    return this.cleanPayload(payload);
  }

  private appendElectricityPricesToPayload(
    payload: UpdateSimulationTariffRequest,
  ): void {
    switch (this.editForm.tariffType) {
      case 'simple':
        payload.singleEnergyPrice =
          this.editForm.singleEnergyPrice;
        break;

      case 'bi_hourly':
        payload.foraVazioEnergyPrice =
          this.editForm.foraVazioEnergyPrice;

        payload.vazioEnergyPrice =
          this.editForm.vazioEnergyPrice;
        break;

      case 'tri_hourly':
        payload.pontaEnergyPrice =
          this.editForm.pontaEnergyPrice;

        payload.cheiasEnergyPrice =
          this.editForm.cheiasEnergyPrice;

        payload.vazioEnergyPrice =
          this.editForm.vazioEnergyPrice;
        break;

      case 'tetra_hourly':
        payload.pontaEnergyPrice =
          this.editForm.pontaEnergyPrice;

        payload.cheiasEnergyPrice =
          this.editForm.cheiasEnergyPrice;

        payload.vazioEnergyPrice =
          this.editForm.vazioEnergyPrice;

        payload.superVazioEnergyPrice =
          this.editForm.superVazioEnergyPrice;
        break;
    }
  }

  deleteTariff(): void {
    if (!this.selectedTariff) {
      return;
    }

    const confirmed = confirm(
      `Tens a certeza que queres eliminar o tarifário "${this.selectedTariff.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    this.isDeleting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.simulatorService
      .deleteSimulationTariff(this.selectedTariff.id)
      .pipe(
        finalize(() => {
          this.isDeleting = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.tariffs = this.tariffs.filter(
            (tariff) => tariff.id !== this.selectedTariff?.id,
          );

          this.selectedTariff = null;
          this.editForm = {};

          this.showSuccess('Tarifário eliminado com sucesso.');
        },
        error: (error) => {
          this.showError(
            error?.error?.message ||
              'Não foi possível eliminar o tarifário.',
          );
        },
      });
  }

  private cleanPayload<T extends Record<string, unknown>>(payload: T): T {
    return Object.fromEntries(
      Object.entries(payload).filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== '',
      ),
    ) as T;
  }

  private showSuccess(message: string): void {
    this.successMessage = message;

    setTimeout(() => {
      this.successMessage = '';
      this.cdr.detectChanges();
    }, 4000);
  }

  private showError(message: string): void {
    this.errorMessage = message;

    setTimeout(() => {
      this.errorMessage = '';
      this.cdr.detectChanges();
    }, 5000);
  }

  getProductTypeLabel(value?: string): string {
    const labels: Record<string, string> = {
      electricity: 'Eletricidade',
      gas: 'Gás',
      dual: 'Luz + Gás',
    };

    return value ? labels[value] || value : '—';
  }

  getSegmentLabel(value?: string): string {
    const labels: Record<string, string> = {
      residential: 'Residencial',
      business: 'Empresarial',
      condominium: 'Condomínio',
    };

    return value ? labels[value] || value : '—';
  }

  getTariffTypeLabel(value?: string): string {
    const labels: Record<string, string> = {
      simple: 'Simples',
      bi_hourly: 'Bi-horário',
      tri_hourly: 'Tri-horário',
      tetra_hourly: 'Tetra-horário',
    };

    return value ? labels[value] || value : '—';
  }

  shouldEditShowElectricityFields(): boolean {
    return (
      this.editForm.productType === 'electricity' ||
      this.editForm.productType === 'dual'
    );
  }

  shouldEditShowGasFields(): boolean {
    return (
      this.editForm.productType === 'gas' ||
      this.editForm.productType === 'dual'
    );
  }

  shouldEditShowCycleType(): boolean {
    return (
      this.shouldEditShowElectricityFields() &&
      this.editForm.tariffType !== 'simple'
    );
  }

  shouldEditShowFixedElectricityPrices(): boolean {
    return (
      this.shouldEditShowElectricityFields() &&
      this.editForm.electricityPriceMode === 'fixed'
    );
  }

  shouldEditShowFixedGasPrice(): boolean {
    return (
      this.shouldEditShowGasFields() &&
      this.editForm.gasPriceMode === 'fixed'
    );
  }

  shouldEditShowSimplePrices(): boolean {
    return (
      this.shouldEditShowFixedElectricityPrices() &&
      this.editForm.tariffType === 'simple'
    );
  }

  shouldEditShowBiHourlyPrices(): boolean {
    return (
      this.shouldEditShowFixedElectricityPrices() &&
      this.editForm.tariffType === 'bi_hourly'
    );
  }

  shouldEditShowTriHourlyPrices(): boolean {
    return (
      this.shouldEditShowFixedElectricityPrices() &&
      this.editForm.tariffType === 'tri_hourly'
    );
  }

  shouldEditShowTetraHourlyPrices(): boolean {
    return (
      this.shouldEditShowFixedElectricityPrices() &&
      this.editForm.tariffType === 'tetra_hourly'
    );
  }

  getPriceModeLabel(value?: string): string {
    const labels: Record<string, string> = {
      fixed: 'Preço fixo',
      indexed: 'Preço indexado',
    };

    return value ? labels[value] || value : '—';
  }

  getCycleTypeLabel(value?: string): string {
    const labels: Record<string, string> = {
      daily: 'Diário',
      weekly: 'Semanal',
    };

    return value ? labels[value] || value : '—';
  }

  showElectricityModeBadge(tariff: SimulationTariff): boolean {
    return (
      tariff.productType === 'electricity' ||
      tariff.productType === 'dual'
    );
  }

  showGasModeBadge(tariff: SimulationTariff): boolean {
    return (
      tariff.productType === 'gas' ||
      tariff.productType === 'dual'
    );
  }

  onFilterProductTypeChange(): void {
    if (this.filters.productType === 'electricity') {
      this.filters.gasPriceMode = '';
    }

    if (this.filters.productType === 'gas') {
      this.filters.electricityPriceMode = '';
      this.filters.tariffType = '';
    }
  }
}