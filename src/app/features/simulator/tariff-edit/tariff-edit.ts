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
  ProductType,
  Segment,
  SimulationTariff,
  SimulationTariffFilters,
  SimulatorService,
  TariffType,
  UpdateSimulationTariffRequest,
} from '../../../core/services/simulator';

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
  } = {
    name: '',
    companyId: '',
    segment: '',
    productType: '',
    tariffType: '',
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

  clearFilters(): void {
    this.filters = {
      name: '',
      companyId: '',
      segment: '',
      productType: '',
      tariffType: '',
    };

    this.tariffs = [];
    this.selectedTariff = null;
  }

  private buildUpdatePayload(): UpdateSimulationTariffRequest {
    if (!this.selectedTariff) {
      return {};
    }

    const payload: UpdateSimulationTariffRequest = {
      name: this.editForm.name,
      segment: this.editForm.segment,

      cycleType: this.editForm.cycleType,

      powerKva: this.editForm.powerKva,
      gasTier: this.editForm.gasTier,

      powerPricePerDay: this.editForm.powerPricePerDay,
      fixedTermPerDay: this.editForm.fixedTermPerDay,

      singleEnergyPrice: this.editForm.singleEnergyPrice,
      gasEnergyPrice: this.editForm.gasEnergyPrice,

      foraVazioEnergyPrice: this.editForm.foraVazioEnergyPrice,
      vazioEnergyPrice: this.editForm.vazioEnergyPrice,
      pontaEnergyPrice: this.editForm.pontaEnergyPrice,
      cheiasEnergyPrice: this.editForm.cheiasEnergyPrice,
      superVazioEnergyPrice: this.editForm.superVazioEnergyPrice,

      salesCommission: this.editForm.salesCommission,
      active: this.editForm.active,

      startDate: this.editForm.startDate
        ? new Date(this.editForm.startDate).toISOString()
        : undefined,

      endDate: this.editForm.endDate
        ? new Date(this.editForm.endDate).toISOString()
        : undefined,
    };

    return this.cleanPayload(payload);
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

  shouldEditShowSimplePrices(): boolean {
    return (
      this.shouldEditShowElectricityFields() &&
      this.editForm.tariffType === 'simple'
    );
  }

  shouldEditShowBiHourlyPrices(): boolean {
    return (
      this.shouldEditShowElectricityFields() &&
      this.editForm.tariffType === 'bi_hourly'
    );
  }

  shouldEditShowTriHourlyPrices(): boolean {
    return (
      this.shouldEditShowElectricityFields() &&
      this.editForm.tariffType === 'tri_hourly'
    );
  }

  shouldEditShowTetraHourlyPrices(): boolean {
    return (
      this.shouldEditShowElectricityFields() &&
      this.editForm.tariffType === 'tetra_hourly'
    );
  }

  onEditProductTypeChange(): void {
    if (this.editForm.productType === 'gas') {
      this.editForm.tariffType = undefined;
      this.editForm.cycleType = undefined;
      this.editForm.powerKva = undefined;
      this.editForm.powerPricePerDay = undefined;

      this.clearEditElectricityPrices();
      return;
    }

    if (
      this.editForm.productType === 'electricity' ||
      this.editForm.productType === 'dual'
    ) {
      this.editForm.tariffType ||= 'simple';
    }

    if (this.editForm.productType === 'electricity') {
      this.clearEditGasFields();
    }
  }

  onEditTariffTypeChange(): void {
    if (this.editForm.tariffType === 'simple') {
      this.editForm.cycleType = undefined;

      this.editForm.foraVazioEnergyPrice = undefined;
      this.editForm.vazioEnergyPrice = undefined;
      this.editForm.pontaEnergyPrice = undefined;
      this.editForm.cheiasEnergyPrice = undefined;
      this.editForm.superVazioEnergyPrice = undefined;
      return;
    }

    this.editForm.singleEnergyPrice = undefined;

    if (this.editForm.tariffType === 'bi_hourly') {
      this.editForm.pontaEnergyPrice = undefined;
      this.editForm.cheiasEnergyPrice = undefined;
      this.editForm.superVazioEnergyPrice = undefined;
      return;
    }

    if (this.editForm.tariffType === 'tri_hourly') {
      this.editForm.foraVazioEnergyPrice = undefined;
      this.editForm.superVazioEnergyPrice = undefined;
      return;
    }

    if (this.editForm.tariffType === 'tetra_hourly') {
      this.editForm.foraVazioEnergyPrice = undefined;
    }
  }

  private clearEditElectricityPrices(): void {
    this.editForm.singleEnergyPrice = undefined;
    this.editForm.foraVazioEnergyPrice = undefined;
    this.editForm.vazioEnergyPrice = undefined;
    this.editForm.pontaEnergyPrice = undefined;
    this.editForm.cheiasEnergyPrice = undefined;
    this.editForm.superVazioEnergyPrice = undefined;
  }

  private clearEditGasFields(): void {
    this.editForm.gasTier = undefined;
    this.editForm.fixedTermPerDay = undefined;
    this.editForm.gasEnergyPrice = undefined;
  }
}