import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import {
  Company,
  CompanyService,
} from '../../../core/services/company';

import {
  CreateSimulationTariffRequest,
  ElectricityPriceMode,
  GasPriceMode,
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
  imports: [
    CommonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './tariff-create.html',
  styleUrl: './tariff-create.scss',
})
export class TariffCreate implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly simulatorService = inject(SimulatorService);
  private readonly companyService = inject(CompanyService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly availablePowers = ELECTRICITY_POWERS;
  readonly availableGasLevels = GAS_LEVELS;

  companies: Company[] = [];

  isLoadingCompanies = false;
  isCreating = false;

  successMessage = '';
  errorMessage = '';

  readonly form = this.fb.group({
    companyId: this.fb.control(
      {
        value: null,
        disabled: true,
      },
      Validators.required,
    ),
    name: this.fb.nonNullable.control(''),

    productType:
      this.fb.nonNullable.control<SimulationProductType>('electricity'),

    segment:
      this.fb.nonNullable.control<SimulationSegment>('business'),

    tariffType:
      this.fb.nonNullable.control<SimulationTariffType>('simple'),

    electricityPriceMode:
      this.fb.control<ElectricityPriceMode | null>(null),

    gasPriceMode:
      this.fb.control<GasPriceMode | null>(null),

    cycleType:
      this.fb.control<SimulationCycleType | null>(null),

    powerKva:
      this.fb.control<number | null>(6.9),

    gasTier:
      this.fb.control<number | null>(1),

    powerPricePerDay:
      this.fb.control<number | null>(null),

    fixedTermPerDay:
      this.fb.control<number | null>(null),

    singleEnergyPrice:
      this.fb.control<number | null>(null),

    gasEnergyPrice:
      this.fb.control<number | null>(null),

    foraVazioEnergyPrice:
      this.fb.control<number | null>(null),

    vazioEnergyPrice:
      this.fb.control<number | null>(null),

    pontaEnergyPrice:
      this.fb.control<number | null>(null),

    cheiasEnergyPrice:
      this.fb.control<number | null>(null),

    superVazioEnergyPrice:
      this.fb.control<number | null>(null),

    salesCommission:
      this.fb.control<number | null>(null),

    startDate: this.fb.nonNullable.control(''),
    endDate: this.fb.nonNullable.control(''),
  });

  ngOnInit(): void {
    this.loadCompanies();
    this.listenToFormChanges();
    this.configureValidators();
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

          this.form.controls.companyId.enable();
        },
        error: () => {
          this.showError(
            'Não foi possível carregar as empresas.',
          );
        },
      });
  }

  private listenToFormChanges(): void {
    this.form.controls.productType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.onProductTypeChange();
      });

    this.form.controls.electricityPriceMode.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mode) => {
        this.onElectricityPriceModeChange(mode);
      });

    this.form.controls.gasPriceMode.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mode) => {
        this.onGasPriceModeChange(mode);
      });

    this.form.controls.tariffType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.onTariffTypeChange();
      });
  }

  private onProductTypeChange(): void {
    this.clearMessages();

    const productType =
      this.form.controls.productType.value;

    if (productType === 'electricity') {
      this.form.patchValue(
        {
          gasPriceMode: null,
          gasTier: null,
          fixedTermPerDay: null,
          gasEnergyPrice: null,
          powerKva:
            this.form.controls.powerKva.value ?? 6.9,
        },
        {
          emitEvent: false,
        },
      );
    }

    if (productType === 'gas') {
      this.form.patchValue(
        {
          electricityPriceMode: null,
          tariffType: 'simple',
          cycleType: null,
          powerKva: null,
          powerPricePerDay: null,
          gasTier:
            this.form.controls.gasTier.value ?? 1,
        },
        {
          emitEvent: false,
        },
      );

      this.clearElectricityConsumptionPrices();
    }

    if (productType === 'dual') {
      this.form.patchValue(
        {
          powerKva:
            this.form.controls.powerKva.value ?? 6.9,
          gasTier:
            this.form.controls.gasTier.value ?? 1,
        },
        {
          emitEvent: false,
        },
      );
    }

    this.configureValidators();
  }

  private onElectricityPriceModeChange(
    mode: ElectricityPriceMode | null,
  ): void {
    this.clearMessages();

    if (mode === 'indexed') {
      this.clearElectricityConsumptionPrices();
    }

    this.configureValidators();
  }

  private onGasPriceModeChange(
    mode: GasPriceMode | null,
  ): void {
    this.clearMessages();

    if (mode === 'indexed') {
      this.form.controls.gasEnergyPrice.setValue(
        null,
        {
          emitEvent: false,
        },
      );
    }

    this.configureValidators();
  }

  private onTariffTypeChange(): void {
    this.clearMessages();

    const tariffType =
      this.form.controls.tariffType.value;

    if (tariffType === 'simple') {
      this.form.patchValue(
        {
          cycleType: null,
          foraVazioEnergyPrice: null,
          vazioEnergyPrice: null,
          pontaEnergyPrice: null,
          cheiasEnergyPrice: null,
          superVazioEnergyPrice: null,
        },
        {
          emitEvent: false,
        },
      );
    }

    if (tariffType === 'bi_hourly') {
      this.form.patchValue(
        {
          singleEnergyPrice: null,
          pontaEnergyPrice: null,
          cheiasEnergyPrice: null,
          superVazioEnergyPrice: null,
        },
        {
          emitEvent: false,
        },
      );
    }

    if (tariffType === 'tri_hourly') {
      this.form.patchValue(
        {
          singleEnergyPrice: null,
          foraVazioEnergyPrice: null,
          superVazioEnergyPrice: null,
        },
        {
          emitEvent: false,
        },
      );
    }

    if (tariffType === 'tetra_hourly') {
      this.form.patchValue(
        {
          singleEnergyPrice: null,
          foraVazioEnergyPrice: null,
        },
        {
          emitEvent: false,
        },
      );
    }

    if (
      tariffType !== 'simple' &&
      !this.form.controls.cycleType.value
    ) {
      this.form.controls.cycleType.setValue(
        'daily',
        {
          emitEvent: false,
        },
      );
    }

    if (
      this.form.controls.electricityPriceMode.value ===
      'indexed'
    ) {
      this.clearElectricityConsumptionPrices();
    }

    this.configureValidators();
  }

  private configureValidators(): void {
    const controls = this.form.controls;

    Object.values(controls).forEach((control) => {
      control.clearValidators();
    });

    controls.companyId.setValidators(
      Validators.required,
    );

    controls.name.setValidators([
      Validators.required,
      Validators.minLength(2),
    ]);

    controls.productType.setValidators(
      Validators.required,
    );

    controls.segment.setValidators(
      Validators.required,
    );

    controls.salesCommission.setValidators([
      Validators.required,
      Validators.min(0),
    ]);

    if (this.shouldShowElectricityFields()) {
      controls.electricityPriceMode.setValidators(
        Validators.required,
      );

      controls.tariffType.setValidators(
        Validators.required,
      );

      controls.powerKva.setValidators([
        Validators.required,
        Validators.min(0),
      ]);

      controls.powerPricePerDay.setValidators([
        Validators.required,
        Validators.min(0),
      ]);

      if (this.shouldShowCycleType()) {
        controls.cycleType.setValidators(
          Validators.required,
        );
      }

      if (
        controls.electricityPriceMode.value === 'fixed'
      ) {
        this.configureFixedElectricityValidators();
      }
    }

    if (this.shouldShowGasFields()) {
      controls.gasPriceMode.setValidators(
        Validators.required,
      );

      controls.gasTier.setValidators([
        Validators.required,
        Validators.min(1),
      ]);

      controls.fixedTermPerDay.setValidators([
        Validators.required,
        Validators.min(0),
      ]);

      if (
        controls.gasPriceMode.value === 'fixed'
      ) {
        controls.gasEnergyPrice.setValidators([
          Validators.required,
          Validators.min(0),
        ]);
      }
    }

    Object.values(controls).forEach((control) => {
      control.updateValueAndValidity({
        emitEvent: false,
      });
    });
  }

  private configureFixedElectricityValidators(): void {
    const controls = this.form.controls;
    const validators = [
      Validators.required,
      Validators.min(0),
    ];

    switch (controls.tariffType.value) {
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

  createTariff(): void {
    this.clearMessages();
    this.configureValidators();

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      this.showError(
        'Preenche corretamente todos os campos obrigatórios.',
      );

      return;
    }

    const payload = this.buildPayload();

    if (!payload) {
      return;
    }

    this.isCreating = true;

    this.simulatorService
      .createSimulationTariff(payload)
      .pipe(
        finalize(() => {
          this.isCreating = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          if (
            response.status === 200 ||
            response.status === 201
          ) {
            this.showSuccess(
              `Tarifário "${response.body?.name}" criado com sucesso.`,
            );

            this.resetForm();
          }
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
              'Não foi possível criar o tarifário.',
          );
        },
      });
  }

  private buildPayload():
    | CreateSimulationTariffRequest
    | null {
    const value = this.form.getRawValue();

    if (!value.companyId) {
      this.showError('A empresa é obrigatória.');
      return null;
    }

    if (!value.name.trim()) {
      this.showError('O nome do tarifário é obrigatório.');
      return null;
    }

    if (
      value.salesCommission === null ||
      !Number.isFinite(value.salesCommission) ||
      value.salesCommission < 0
    ) {
      this.showError('A comissão de venda é obrigatória.');
      return null;
    }

    const payload: CreateSimulationTariffRequest = {
      companyId: value.companyId,
      name: value.name.trim(),
      productType: value.productType,
      segment: value.segment,
      salesCommission: value.salesCommission,
    };

    if (this.shouldShowElectricityFields()) {
      if (!value.electricityPriceMode) {
        this.showError(
          'Seleciona o modo de preço da eletricidade.',
        );
        return null;
      }

      if (
        value.powerKva === null ||
        value.powerPricePerDay === null
      ) {
        this.showError(
          'A potência e o preço de potência por dia são obrigatórios.',
        );
        return null;
      }

      payload.electricityPriceMode =
        value.electricityPriceMode;

      payload.tariffType = value.tariffType;
      payload.powerKva = value.powerKva;
      payload.powerPricePerDay =
        value.powerPricePerDay;

      if (this.shouldShowCycleType()) {
        if (!value.cycleType) {
          this.showError('Seleciona o ciclo horário.');
          return null;
        }

        payload.cycleType = value.cycleType;
      }

      if (
        value.electricityPriceMode === 'fixed'
      ) {
        this.appendFixedElectricityPrices(
          payload,
          value,
        );
      }
    }

    if (this.shouldShowGasFields()) {
      if (!value.gasPriceMode) {
        this.showError(
          'Seleciona o modo de preço do gás.',
        );
        return null;
      }

      if (
        value.gasTier === null ||
        value.fixedTermPerDay === null
      ) {
        this.showError(
          'O escalão e o termo fixo do gás são obrigatórios.',
        );
        return null;
      }

      payload.gasPriceMode = value.gasPriceMode;
      payload.gasTier = value.gasTier;
      payload.fixedTermPerDay =
        value.fixedTermPerDay;

      if (value.gasPriceMode === 'fixed') {
        if (value.gasEnergyPrice === null) {
          this.showError(
            'O preço de energia do gás é obrigatório.',
          );
          return null;
        }

        payload.gasEnergyPrice =
          value.gasEnergyPrice;
      }
    }

    if (value.startDate) {
      payload.startDate = new Date(
        value.startDate,
      ).toISOString();
    }

    if (value.endDate) {
      payload.endDate = new Date(
        value.endDate,
      ).toISOString();
    }

    return this.cleanPayload(payload);
  }

  private appendFixedElectricityPrices(
    payload: CreateSimulationTariffRequest,
    value: ReturnType<
      typeof this.form.getRawValue
    >,
  ): void {
    switch (value.tariffType) {
      case 'simple':
        payload.singleEnergyPrice =
          value.singleEnergyPrice!;

        break;

      case 'bi_hourly':
        payload.foraVazioEnergyPrice =
          value.foraVazioEnergyPrice!;

        payload.vazioEnergyPrice =
          value.vazioEnergyPrice!;

        break;

      case 'tri_hourly':
        payload.pontaEnergyPrice =
          value.pontaEnergyPrice!;

        payload.cheiasEnergyPrice =
          value.cheiasEnergyPrice!;

        payload.vazioEnergyPrice =
          value.vazioEnergyPrice!;

        break;

      case 'tetra_hourly':
        payload.pontaEnergyPrice =
          value.pontaEnergyPrice!;

        payload.cheiasEnergyPrice =
          value.cheiasEnergyPrice!;

        payload.vazioEnergyPrice =
          value.vazioEnergyPrice!;

        payload.superVazioEnergyPrice =
          value.superVazioEnergyPrice!;

        break;
    }
  }

  shouldShowElectricityFields(): boolean {
    return (
      this.form.controls.productType.value ===
        'electricity' ||
      this.form.controls.productType.value ===
        'dual'
    );
  }

  shouldShowGasFields(): boolean {
    return (
      this.form.controls.productType.value ===
        'gas' ||
      this.form.controls.productType.value ===
        'dual'
    );
  }

  shouldShowCycleType(): boolean {
    return (
      this.shouldShowElectricityFields() &&
      this.form.controls.tariffType.value !==
        'simple'
    );
  }

  shouldShowFixedElectricityPrices(): boolean {
    return (
      this.shouldShowElectricityFields() &&
      this.form.controls.electricityPriceMode
        .value === 'fixed'
    );
  }

  shouldShowFixedGasPrice(): boolean {
    return (
      this.shouldShowGasFields() &&
      this.form.controls.gasPriceMode.value ===
        'fixed'
    );
  }

  shouldShowSimplePrices(): boolean {
    return (
      this.shouldShowFixedElectricityPrices() &&
      this.form.controls.tariffType.value ===
        'simple'
    );
  }

  shouldShowBiHourlyPrices(): boolean {
    return (
      this.shouldShowFixedElectricityPrices() &&
      this.form.controls.tariffType.value ===
        'bi_hourly'
    );
  }

  shouldShowTriHourlyPrices(): boolean {
    return (
      this.shouldShowFixedElectricityPrices() &&
      this.form.controls.tariffType.value ===
        'tri_hourly'
    );
  }

  shouldShowTetraHourlyPrices(): boolean {
    return (
      this.shouldShowFixedElectricityPrices() &&
      this.form.controls.tariffType.value ===
        'tetra_hourly'
    );
  }

  isInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control: AbstractControl =
      this.form.controls[controlName];

    return (
      control.invalid &&
      (control.touched || control.dirty)
    );
  }

  private clearElectricityConsumptionPrices(): void {
    this.form.patchValue(
      {
        singleEnergyPrice: null,
        foraVazioEnergyPrice: null,
        vazioEnergyPrice: null,
        pontaEnergyPrice: null,
        cheiasEnergyPrice: null,
        superVazioEnergyPrice: null,
      },
      {
        emitEvent: false,
      },
    );
  }

  private resetForm(): void {
    this.form.reset(
      {
        companyId: null,
        name: '',

        productType: 'electricity',
        segment: 'business',

        electricityPriceMode: null,
        gasPriceMode: null,

        tariffType: 'simple',
        cycleType: null,

        powerKva: 6.9,
        gasTier: 1,

        powerPricePerDay: null,
        fixedTermPerDay: null,

        singleEnergyPrice: null,
        gasEnergyPrice: null,

        foraVazioEnergyPrice: null,
        vazioEnergyPrice: null,
        pontaEnergyPrice: null,
        cheiasEnergyPrice: null,
        superVazioEnergyPrice: null,

        salesCommission: null,

        startDate: '',
        endDate: '',
      },
      {
        emitEvent: false,
      },
    );

    this.configureValidators();
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