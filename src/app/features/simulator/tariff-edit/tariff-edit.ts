import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  Company,
  CompanyService,
} from '../../../core/services/company';

import {
  ElectricityPriceMode,
  GasPriceMode,
  ProductType,
  Segment,
  SimulationTariff,
  SimulationTariffFilters,
  SimulatorService,
  TariffDiscounts,
  TariffType,
  UpdateSimulationTariffRequest,
} from '../../../core/services/simulator';

import {
  ELECTRICITY_POWERS,
  GAS_LEVELS,
} from '../../../core/constants/energy';

interface SearchFilters {
  name: string;
  companyId: string;
  segment: '' | Segment;
  productType: '' | ProductType;
  tariffType: '' | TariffType;
  electricityPriceMode: '' | ElectricityPriceMode;
  gasPriceMode: '' | GasPriceMode;
}

interface DiscountFormValue {
  electronicInvoice: number | null;
  directDebit: number | null;
  welcomeBonus: number | null;
  sva: number | null;
  gasBonus: number | null;
}

@Component({
  selector: 'app-tariff-edit',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  templateUrl: './tariff-edit.html',
  styleUrl: './tariff-edit.scss',
})
export class TariffEdit implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly simulatorService = inject(SimulatorService);
  private readonly companyService = inject(CompanyService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly availablePowers = ELECTRICITY_POWERS;
  readonly availableGasLevels = GAS_LEVELS;

  companies: Company[] = [];

  tariffs: SimulationTariff[] = [];
  selectedTariff: SimulationTariff | null = null;
  originalTariff: SimulationTariff | null = null;

  isLoadingCompanies = false;
  isSearching = false;
  isSaving = false;
  isDeleting = false;

  showElectricityDiscounts = false;
  showGasDiscounts = false;

  successMessage = '';
  errorMessage = '';

  filters: SearchFilters = {
    name: '',
    companyId: '',
    segment: '',
    productType: '',
    tariffType: '',
    electricityPriceMode: '',
    gasPriceMode: '',
  };

  readonly editForm = this.fb.group({
    name: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(2),
    ]),

    segment: this.fb.control<Segment | null>(null),

    cycleType: this.fb.control<'daily' | 'weekly' | null>(null),

    powerKva: this.fb.control<number | null>(null),
    gasTier: this.fb.control<number | null>(null),

    powerPricePerDay: this.fb.control<number | null>(null),
    fixedTermPerDay: this.fb.control<number | null>(null),

    singleEnergyPrice: this.fb.control<number | null>(null),
    foraVazioEnergyPrice: this.fb.control<number | null>(null),
    vazioEnergyPrice: this.fb.control<number | null>(null),
    pontaEnergyPrice: this.fb.control<number | null>(null),
    cheiasEnergyPrice: this.fb.control<number | null>(null),
    superVazioEnergyPrice: this.fb.control<number | null>(null),

    gasEnergyPrice: this.fb.control<number | null>(null),

    electricityAdjustmentFactor:
      this.fb.control<number | null>(null),

    electricityAdditionalCostPerKwh:
      this.fb.control<number | null>(null),

    gasLossPercentage:
      this.fb.control<number | null>(null),

    gasAdditionalCostPerKwh:
      this.fb.control<number | null>(null),

    electricityDiscounts: this.fb.group({
      electronicInvoice: this.fb.control<number | null>(null),
      directDebit: this.fb.control<number | null>(null),
      welcomeBonus: this.fb.control<number | null>(null),
      sva: this.fb.control<number | null>(null),
      gasBonus: this.fb.control<number | null>(null),
    }),

    gasDiscounts: this.fb.group({
      electronicInvoice: this.fb.control<number | null>(null),
      directDebit: this.fb.control<number | null>(null),
      welcomeBonus: this.fb.control<number | null>(null),
      sva: this.fb.control<number | null>(null),
      gasBonus: this.fb.control<number | null>(null),
    }),

    salesCommission: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),

    startDate: this.fb.nonNullable.control(''),
    endDate: this.fb.nonNullable.control(''),

    active: this.fb.nonNullable.control(true),
  });

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
        error: (error) => {
          this.showError(
            error?.error?.message ||
              'Não foi possível carregar as empresas.',
          );
        },
      });
  }

  searchTariffs(): void {
    const filters: SimulationTariffFilters = {
      name: this.filters.name.trim() || undefined,
      companyId: this.filters.companyId || undefined,
      segment: this.filters.segment || undefined,
      productType: this.filters.productType || undefined,
      tariffType: this.filters.tariffType || undefined,
      electricityPriceMode:
        this.filters.electricityPriceMode || undefined,
      gasPriceMode:
        this.filters.gasPriceMode || undefined,
    };

    if (!Object.values(filters).some(Boolean)) {
      this.showError(
        'Preenche pelo menos um filtro antes de pesquisar.',
      );

      return;
    }

    this.isSearching = true;
    this.clearMessages();

    this.tariffs = [];
    this.clearSelection();

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
            this.showError(
              'Não foram encontrados tarifários.',
            );
          }
        },
        error: (error) => {
          this.showError(
            error?.error?.message ||
              'Não foi possível pesquisar tarifários.',
          );
        },
      });
  }

  selectTariff(tariff: SimulationTariff): void {
    this.selectedTariff = this.cloneTariff(tariff);
    this.originalTariff = this.cloneTariff(tariff);

    this.showElectricityDiscounts = Boolean(
      tariff.electricityDiscounts &&
        Object.keys(tariff.electricityDiscounts).length,
    );

    this.showGasDiscounts = Boolean(
      tariff.gasDiscounts &&
        Object.keys(tariff.gasDiscounts).length,
    );

    this.editForm.reset(
      {
        name: tariff.name,
        segment: tariff.segment ?? null,

        cycleType: tariff.cycleType ?? null,

        powerKva: tariff.powerKva ?? null,
        gasTier: tariff.gasTier ?? null,

        powerPricePerDay:
          tariff.powerPricePerDay ?? null,

        fixedTermPerDay:
          tariff.fixedTermPerDay ?? null,

        singleEnergyPrice:
          tariff.singleEnergyPrice ?? null,

        foraVazioEnergyPrice:
          tariff.foraVazioEnergyPrice ?? null,

        vazioEnergyPrice:
          tariff.vazioEnergyPrice ?? null,

        pontaEnergyPrice:
          tariff.pontaEnergyPrice ?? null,

        cheiasEnergyPrice:
          tariff.cheiasEnergyPrice ?? null,

        superVazioEnergyPrice:
          tariff.superVazioEnergyPrice ?? null,

        gasEnergyPrice:
          tariff.gasEnergyPrice ?? null,

        electricityAdjustmentFactor:
          tariff.electricityAdjustmentFactor ?? null,

        electricityAdditionalCostPerKwh:
          tariff.electricityAdditionalCostPerKwh ?? null,

        gasLossPercentage:
          tariff.gasLossPercentage ?? null,

        gasAdditionalCostPerKwh:
          tariff.gasAdditionalCostPerKwh ?? null,

        electricityDiscounts:
          this.toDiscountFormValue(
            tariff.electricityDiscounts,
          ),

        gasDiscounts:
          this.toDiscountFormValue(
            tariff.gasDiscounts,
          ),

        salesCommission:
          tariff.salesCommission ?? null,

        startDate:
          this.toDateInputValue(tariff.startDate),

        endDate:
          this.toDateInputValue(tariff.endDate),

        active: tariff.active,
      },
      {
        emitEvent: false,
      },
    );

    this.configureValidators();
    this.editForm.markAsPristine();
    this.editForm.markAsUntouched();
  }

  private configureValidators(): void {
    const controls = this.editForm.controls;

    const numericControls = [
      controls.powerKva,
      controls.gasTier,
      controls.powerPricePerDay,
      controls.fixedTermPerDay,
      controls.singleEnergyPrice,
      controls.foraVazioEnergyPrice,
      controls.vazioEnergyPrice,
      controls.pontaEnergyPrice,
      controls.cheiasEnergyPrice,
      controls.superVazioEnergyPrice,
      controls.gasEnergyPrice,
      controls.electricityAdjustmentFactor,
      controls.electricityAdditionalCostPerKwh,
      controls.gasLossPercentage,
      controls.gasAdditionalCostPerKwh,
    ];

    numericControls.forEach((control) => {
      control.clearValidators();
    });

    controls.segment.setValidators(
      Validators.required,
    );

    if (this.shouldEditShowElectricityFields()) {
      controls.powerKva.setValidators([
        Validators.required,
        Validators.min(0),
      ]);

      controls.powerPricePerDay.setValidators([
        Validators.required,
        Validators.min(0),
      ]);

      if (this.shouldEditShowCycleType()) {
        controls.cycleType.setValidators(
          Validators.required,
        );
      } else {
        controls.cycleType.clearValidators();
      }

      if (this.isFixedElectricity()) {
        this.configureFixedElectricityValidators();
      }

      if (this.isIndexedElectricity()) {
        controls.electricityAdjustmentFactor.setValidators([
          Validators.required,
          Validators.min(0),
        ]);

        controls.electricityAdditionalCostPerKwh.setValidators([
          Validators.required,
          Validators.min(0),
        ]);
      }
    }

    if (this.shouldEditShowGasFields()) {
      controls.gasTier.setValidators([
        Validators.required,
        Validators.min(1),
      ]);

      controls.fixedTermPerDay.setValidators([
        Validators.required,
        Validators.min(0),
      ]);

      if (this.isFixedGas()) {
        controls.gasEnergyPrice.setValidators([
          Validators.required,
          Validators.min(0),
        ]);
      }

      if (this.isIndexedGas()) {
        controls.gasLossPercentage.setValidators([
          Validators.required,
          Validators.min(0),
        ]);

        controls.gasAdditionalCostPerKwh.setValidators([
          Validators.required,
          Validators.min(0),
        ]);
      }
    }

    numericControls.forEach((control) => {
      control.updateValueAndValidity({
        emitEvent: false,
      });
    });

    controls.segment.updateValueAndValidity({
      emitEvent: false,
    });

    controls.cycleType.updateValueAndValidity({
      emitEvent: false,
    });

    this.configureDiscountValidators();
  }

  private configureFixedElectricityValidators(): void {
    const controls = this.editForm.controls;

    const validators = [
      Validators.required,
      Validators.min(0),
    ];

    switch (this.selectedTariff?.tariffType) {
      case 'simple':
        controls.singleEnergyPrice.setValidators(
          validators,
        );
        break;

      case 'bi_hourly':
        controls.foraVazioEnergyPrice.setValidators(
          validators,
        );

        controls.vazioEnergyPrice.setValidators(
          validators,
        );
        break;

      case 'tri_hourly':
        controls.pontaEnergyPrice.setValidators(
          validators,
        );

        controls.cheiasEnergyPrice.setValidators(
          validators,
        );

        controls.vazioEnergyPrice.setValidators(
          validators,
        );
        break;

      case 'tetra_hourly':
        controls.pontaEnergyPrice.setValidators(
          validators,
        );

        controls.cheiasEnergyPrice.setValidators(
          validators,
        );

        controls.vazioEnergyPrice.setValidators(
          validators,
        );

        controls.superVazioEnergyPrice.setValidators(
          validators,
        );
        break;
    }
  }

  private configureDiscountValidators(): void {
    const validators = [
      Validators.min(0),
      Validators.max(100),
    ];

    Object.values(
      this.editForm.controls.electricityDiscounts.controls,
    ).forEach((control) => {
      control.clearValidators();

      if (this.isFixedElectricity()) {
        control.setValidators(validators);
      }

      control.updateValueAndValidity({
        emitEvent: false,
      });
    });

    Object.values(
      this.editForm.controls.gasDiscounts.controls,
    ).forEach((control) => {
      control.clearValidators();

      if (this.isFixedGas()) {
        control.setValidators(validators);
      }

      control.updateValueAndValidity({
        emitEvent: false,
      });
    });
  }

  saveTariff(): void {
    if (
      !this.selectedTariff ||
      !this.originalTariff ||
      this.isSaving
    ) {
      return;
    }

    this.clearMessages();
    this.configureValidators();

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();

      this.showError(
        'Preenche corretamente todos os campos obrigatórios.',
      );

      return;
    }

    const payload = this.buildPatchPayload();

    if (!Object.keys(payload).length) {
      return;
    }

    this.isSaving = true;

    this.simulatorService
      .updateSimulationTariff(
        this.selectedTariff.id,
        payload,
      )
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (updatedTariff) => {
          this.selectedTariff =
            this.cloneTariff(updatedTariff);

          this.originalTariff =
            this.cloneTariff(updatedTariff);

          this.tariffs = this.tariffs.map((tariff) =>
            tariff.id === updatedTariff.id
              ? updatedTariff
              : tariff,
          );

          this.selectTariff(updatedTariff);

          this.editForm.markAsPristine();

          this.showSuccess(
            'Tarifário atualizado com sucesso.',
          );
        },
        error: (error) => {
          this.showBackendError(
            error,
            'Não foi possível atualizar o tarifário.',
          );
        },
      });
  }

  hasChanges(): boolean {
    if (!this.originalTariff) {
      return false;
    }

    return Object.keys(
      this.buildPatchPayload(),
    ).length > 0;
  }

  private buildPatchPayload(): UpdateSimulationTariffRequest {
    if (!this.originalTariff) {
      return {};
    }

    const original = this.originalTariff;
    const current = this.editForm.getRawValue();

    const payload: UpdateSimulationTariffRequest = {};

    this.addChangedString(
      payload,
      'name',
      original.name,
      current.name.trim(),
    );

    this.addChangedValue(
      payload,
      'segment',
      original.segment,
      current.segment ?? undefined,
    );

    this.addChangedNumber(
      payload,
      'salesCommission',
      original.salesCommission,
      current.salesCommission,
    );

    this.addChangedValue(
      payload,
      'active',
      original.active,
      current.active,
    );

    this.appendDateChange(
      payload,
      'startDate',
      original.startDate,
      current.startDate,
    );

    this.appendDateChange(
      payload,
      'endDate',
      original.endDate,
      current.endDate,
    );

    if (this.shouldEditShowElectricityFields()) {
      this.addChangedNumber(
        payload,
        'powerKva',
        original.powerKva,
        current.powerKva,
      );

      this.addChangedNumber(
        payload,
        'powerPricePerDay',
        original.powerPricePerDay,
        current.powerPricePerDay,
      );

      if (this.shouldEditShowCycleType()) {
        this.addChangedValue(
          payload,
          'cycleType',
          original.cycleType,
          current.cycleType ?? undefined,
        );
      }

      if (this.isFixedElectricity()) {
        this.appendFixedElectricityChanges(
          payload,
          current,
        );

        const currentDiscounts =
          this.buildCompleteDiscounts(
            current.electricityDiscounts,
          );

        const originalDiscounts =
          this.buildCompleteDiscounts(
            this.toDiscountFormValue(
              original.electricityDiscounts,
            ),
          );

        if (
          !this.areEqual(
            originalDiscounts,
            currentDiscounts,
          )
        ) {
          payload.electricityDiscounts =
            currentDiscounts;
        }
      }

      if (this.isIndexedElectricity()) {
        this.addChangedNumber(
          payload,
          'electricityAdjustmentFactor',
          original.electricityAdjustmentFactor,
          current.electricityAdjustmentFactor,
        );

        this.addChangedNumber(
          payload,
          'electricityAdditionalCostPerKwh',
          original.electricityAdditionalCostPerKwh,
          current.electricityAdditionalCostPerKwh,
        );
      }
    }

    if (this.shouldEditShowGasFields()) {
      this.addChangedNumber(
        payload,
        'gasTier',
        original.gasTier,
        current.gasTier,
      );

      this.addChangedNumber(
        payload,
        'fixedTermPerDay',
        original.fixedTermPerDay,
        current.fixedTermPerDay,
      );

      if (this.isFixedGas()) {
        this.addChangedNumber(
          payload,
          'gasEnergyPrice',
          original.gasEnergyPrice,
          current.gasEnergyPrice,
        );

        const currentDiscounts =
          this.buildCompleteDiscounts(
            current.gasDiscounts,
          );

        const originalDiscounts =
          this.buildCompleteDiscounts(
            this.toDiscountFormValue(
              original.gasDiscounts,
            ),
          );

        if (
          !this.areEqual(
            originalDiscounts,
            currentDiscounts,
          )
        ) {
          payload.gasDiscounts =
            currentDiscounts;
        }
      }

      if (this.isIndexedGas()) {
        this.addChangedNumber(
          payload,
          'gasLossPercentage',
          original.gasLossPercentage,
          current.gasLossPercentage,
        );

        this.addChangedNumber(
          payload,
          'gasAdditionalCostPerKwh',
          original.gasAdditionalCostPerKwh,
          current.gasAdditionalCostPerKwh,
        );
      }
    }

    return payload;
  }

  private appendFixedElectricityChanges(
    payload: UpdateSimulationTariffRequest,
    current: ReturnType<
      typeof this.editForm.getRawValue
    >,
  ): void {
    switch (this.selectedTariff?.tariffType) {
      case 'simple':
        this.addChangedNumber(
          payload,
          'singleEnergyPrice',
          this.originalTariff?.singleEnergyPrice,
          current.singleEnergyPrice,
        );
        break;

      case 'bi_hourly':
        this.addChangedNumber(
          payload,
          'foraVazioEnergyPrice',
          this.originalTariff?.foraVazioEnergyPrice,
          current.foraVazioEnergyPrice,
        );

        this.addChangedNumber(
          payload,
          'vazioEnergyPrice',
          this.originalTariff?.vazioEnergyPrice,
          current.vazioEnergyPrice,
        );
        break;

      case 'tri_hourly':
        this.addChangedNumber(
          payload,
          'pontaEnergyPrice',
          this.originalTariff?.pontaEnergyPrice,
          current.pontaEnergyPrice,
        );

        this.addChangedNumber(
          payload,
          'cheiasEnergyPrice',
          this.originalTariff?.cheiasEnergyPrice,
          current.cheiasEnergyPrice,
        );

        this.addChangedNumber(
          payload,
          'vazioEnergyPrice',
          this.originalTariff?.vazioEnergyPrice,
          current.vazioEnergyPrice,
        );
        break;

      case 'tetra_hourly':
        this.addChangedNumber(
          payload,
          'pontaEnergyPrice',
          this.originalTariff?.pontaEnergyPrice,
          current.pontaEnergyPrice,
        );

        this.addChangedNumber(
          payload,
          'cheiasEnergyPrice',
          this.originalTariff?.cheiasEnergyPrice,
          current.cheiasEnergyPrice,
        );

        this.addChangedNumber(
          payload,
          'vazioEnergyPrice',
          this.originalTariff?.vazioEnergyPrice,
          current.vazioEnergyPrice,
        );

        this.addChangedNumber(
          payload,
          'superVazioEnergyPrice',
          this.originalTariff?.superVazioEnergyPrice,
          current.superVazioEnergyPrice,
        );
        break;
    }
  }

  private addChangedNumber<
    K extends keyof UpdateSimulationTariffRequest,
  >(
    payload: UpdateSimulationTariffRequest,
    key: K,
    originalValue: number | undefined,
    currentValue: number | null,
  ): void {
    if (currentValue === null) {
      return;
    }

    const parsed = Number(currentValue);

    if (
      Number.isFinite(parsed) &&
      parsed !== originalValue
    ) {
      (payload[key] as number | undefined) = parsed;
    }
  }

  private addChangedString<
    K extends keyof UpdateSimulationTariffRequest,
  >(
    payload: UpdateSimulationTariffRequest,
    key: K,
    originalValue: string | undefined,
    currentValue: string,
  ): void {
    if (
      currentValue &&
      currentValue !== originalValue
    ) {
      (payload[key] as string | undefined) =
        currentValue;
    }
  }

  private addChangedValue<
    K extends keyof UpdateSimulationTariffRequest,
  >(
    payload: UpdateSimulationTariffRequest,
    key: K,
    originalValue: unknown,
    currentValue: unknown,
  ): void {
    if (
      currentValue !== undefined &&
      currentValue !== originalValue
    ) {
      (payload[key] as unknown) = currentValue;
    }
  }

  private appendDateChange(
    payload: UpdateSimulationTariffRequest,
    key: 'startDate' | 'endDate',
    originalDate: string | null | undefined,
    currentDate: string,
  ): void {
    const originalInputValue =
      this.toDateInputValue(originalDate);

    if (currentDate === originalInputValue) {
      return;
    }

    payload[key] = currentDate || null;
  }

  deleteTariff(): void {
    if (
      !this.selectedTariff ||
      this.isDeleting
    ) {
      return;
    }

    const confirmed = confirm(
      `Tens a certeza que queres eliminar o tarifário "${this.selectedTariff.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    this.isDeleting = true;
    this.clearMessages();

    this.simulatorService
      .deleteSimulationTariff(
        this.selectedTariff.id,
      )
      .pipe(
        finalize(() => {
          this.isDeleting = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          const deletedId =
            this.selectedTariff?.id;

          this.tariffs = this.tariffs.filter(
            (tariff) =>
              tariff.id !== deletedId,
          );

          this.clearSelection();

          this.showSuccess(
            'Tarifário eliminado com sucesso.',
          );
        },
        error: (error) => {
          this.showBackendError(
            error,
            'Não foi possível eliminar o tarifário.',
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
      electricityPriceMode: '',
      gasPriceMode: '',
    };

    this.tariffs = [];
    this.clearSelection();
    this.clearMessages();
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

  toggleElectricityDiscounts(): void {
    this.showElectricityDiscounts =
      !this.showElectricityDiscounts;
  }

  toggleGasDiscounts(): void {
    this.showGasDiscounts =
      !this.showGasDiscounts;
  }

  shouldEditShowElectricityFields(): boolean {
    return (
      this.selectedTariff?.productType ===
        'electricity' ||
      this.selectedTariff?.productType ===
        'dual'
    );
  }

  shouldEditShowGasFields(): boolean {
    return (
      this.selectedTariff?.productType === 'gas' ||
      this.selectedTariff?.productType === 'dual'
    );
  }

  shouldEditShowCycleType(): boolean {
    return (
      this.shouldEditShowElectricityFields() &&
      this.selectedTariff?.tariffType !== 'simple'
    );
  }

  isFixedElectricity(): boolean {
    return (
      this.shouldEditShowElectricityFields() &&
      this.selectedTariff?.electricityPriceMode ===
        'fixed'
    );
  }

  isIndexedElectricity(): boolean {
    return (
      this.shouldEditShowElectricityFields() &&
      this.selectedTariff?.electricityPriceMode ===
        'indexed'
    );
  }

  isFixedGas(): boolean {
    return (
      this.shouldEditShowGasFields() &&
      this.selectedTariff?.gasPriceMode ===
        'fixed'
    );
  }

  isIndexedGas(): boolean {
    return (
      this.shouldEditShowGasFields() &&
      this.selectedTariff?.gasPriceMode ===
        'indexed'
    );
  }

  shouldEditShowSimplePrices(): boolean {
    return (
      this.isFixedElectricity() &&
      this.selectedTariff?.tariffType ===
        'simple'
    );
  }

  shouldEditShowBiHourlyPrices(): boolean {
    return (
      this.isFixedElectricity() &&
      this.selectedTariff?.tariffType ===
        'bi_hourly'
    );
  }

  shouldEditShowTriHourlyPrices(): boolean {
    return (
      this.isFixedElectricity() &&
      this.selectedTariff?.tariffType ===
        'tri_hourly'
    );
  }

  shouldEditShowTetraHourlyPrices(): boolean {
    return (
      this.isFixedElectricity() &&
      this.selectedTariff?.tariffType ===
        'tetra_hourly'
    );
  }

  getProductTypeLabel(value?: string): string {
    const labels: Record<string, string> = {
      electricity: 'Eletricidade',
      gas: 'Gás',
      dual: 'Luz + Gás',
    };

    return value
      ? labels[value] || value
      : '—';
  }

  getSegmentLabel(value?: string): string {
    const labels: Record<string, string> = {
      residential: 'Residencial',
      business: 'Empresarial',
      condominium: 'Condomínio',
    };

    return value
      ? labels[value] || value
      : '—';
  }

  getTariffTypeLabel(value?: string): string {
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

  getPriceModeLabel(value?: string): string {
    const labels: Record<string, string> = {
      fixed: 'Preço fixo',
      indexed: 'Preço indexado',
    };

    return value
      ? labels[value] || value
      : '—';
  }

  showElectricityModeBadge(
    tariff: SimulationTariff,
  ): boolean {
    return (
      tariff.productType === 'electricity' ||
      tariff.productType === 'dual'
    );
  }

  showGasModeBadge(
    tariff: SimulationTariff,
  ): boolean {
    return (
      tariff.productType === 'gas' ||
      tariff.productType === 'dual'
    );
  }

  private buildCompleteDiscounts(
    discounts: DiscountFormValue,
  ): TariffDiscounts {
    const result: TariffDiscounts = {};

    Object.entries(discounts).forEach(
      ([key, value]) => {
        if (
          value !== null &&
          value !== undefined &&
          Number(value) > 0
        ) {
          result[key as keyof TariffDiscounts] =
            Number(value);
        }
      },
    );

    return result;
  }

  private toDiscountFormValue(
    discounts?: TariffDiscounts,
  ): DiscountFormValue {
    return {
      electronicInvoice:
        discounts?.electronicInvoice ?? null,

      directDebit:
        discounts?.directDebit ?? null,

      welcomeBonus:
        discounts?.welcomeBonus ?? null,

      sva:
        discounts?.sva ?? null,

      gasBonus:
        discounts?.gasBonus ?? null,
    };
  }

  private toDateInputValue(
    value?: string | null,
  ): string {
    return value
      ? value.substring(0, 10)
      : '';
  }

  private areEqual(
    first: unknown,
    second: unknown,
  ): boolean {
    return (
      JSON.stringify(first) ===
      JSON.stringify(second)
    );
  }

  private cloneTariff(
    tariff: SimulationTariff,
  ): SimulationTariff {
    return structuredClone(tariff);
  }

  private clearSelection(): void {
    this.selectedTariff = null;
    this.originalTariff = null;

    this.editForm.reset();
    this.showElectricityDiscounts = false;
    this.showGasDiscounts = false;
  }

  private showBackendError(
    error: {
      error?: {
        message?: string;
        fields?: string[];
        details?: string[];
      };
    },
    fallback: string,
  ): void {
    const message =
      error?.error?.message ||
      error?.error?.details?.join(' ') ||
      fallback;

    const fields = Array.isArray(
      error?.error?.fields,
    )
      ? error.error.fields.join(', ')
      : '';

    this.showError(
      fields
        ? `${message} Campos: ${fields}.`
        : message,
    );
  }

  private clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
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
}