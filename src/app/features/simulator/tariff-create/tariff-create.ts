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
  TariffDiscounts,
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

  showElectricityDiscounts = false;
  showGasDiscounts = false;

  successMessage = '';
  errorMessage = '';

  readonly form = this.fb.group({
    companyId: this.fb.control<string | null>(
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

    gasEnergyPrice:
      this.fb.control<number | null>(null),

    electricityAdjustmentFactor:
      this.fb.control<number | null>(null),

    electricityAdditionalCostPerKwh:
      this.fb.control<number | null>(null),

    gasLossPercentage:
      this.fb.control<number | null>(null),

    gasAdditionalCostPerKwh:
      this.fb.control<number | null>(null),

    electricityDiscounts: this.fb.group({
      electronicInvoice:
        this.fb.control<number | null>(null),

      directDebit:
        this.fb.control<number | null>(null),

      welcomeBonus:
        this.fb.control<number | null>(null),

      sva:
        this.fb.control<number | null>(null),

      gasBonus:
        this.fb.control<number | null>(null),
    }),

    gasDiscounts: this.fb.group({
      electronicInvoice:
        this.fb.control<number | null>(null),

      directDebit:
        this.fb.control<number | null>(null),

      welcomeBonus:
        this.fb.control<number | null>(null),

      sva:
        this.fb.control<number | null>(null),

      gasBonus:
        this.fb.control<number | null>(null),
    }),

    salesCommission:
      this.fb.control<number | null>(null),

    startDate:
      this.fb.nonNullable.control(''),

    endDate:
      this.fb.nonNullable.control(''),
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
        error: (error) => {
          this.showError(
            error?.error?.message ||
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
      this.clearGasFields();

      this.form.patchValue(
        {
          powerKva:
            this.form.controls.powerKva.value ?? 6.9,
        },
        {
          emitEvent: false,
        },
      );
    }

    if (productType === 'gas') {
      this.clearElectricityFields();

      this.form.patchValue(
        {
          gasTier:
            this.form.controls.gasTier.value ?? 1,
        },
        {
          emitEvent: false,
        },
      );
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
      this.clearElectricityDiscounts();
      this.showElectricityDiscounts = false;
    }

    if (mode === 'fixed') {
      this.form.patchValue(
        {
          electricityAdjustmentFactor: null,
          electricityAdditionalCostPerKwh: null,
        },
        {
          emitEvent: false,
        },
      );
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

      this.clearGasDiscounts();
      this.showGasDiscounts = false;
    }

    if (mode === 'fixed') {
      this.form.patchValue(
        {
          gasLossPercentage: null,
          gasAdditionalCostPerKwh: null,
        },
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

    Object.entries(controls).forEach(
      ([key, control]) => {
        if (
          key !== 'electricityDiscounts' &&
          key !== 'gasDiscounts'
        ) {
          control.clearValidators();
        }
      },
    );

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
        controls.electricityPriceMode.value ===
        'fixed'
      ) {
        this.configureFixedElectricityValidators();
      }

      if (
        controls.electricityPriceMode.value ===
        'indexed'
      ) {
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
        controls.gasPriceMode.value ===
        'fixed'
      ) {
        controls.gasEnergyPrice.setValidators([
          Validators.required,
          Validators.min(0),
        ]);
      }

      if (
        controls.gasPriceMode.value ===
        'indexed'
      ) {
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

    Object.entries(controls).forEach(
      ([key, control]) => {
        if (
          key !== 'electricityDiscounts' &&
          key !== 'gasDiscounts'
        ) {
          control.updateValueAndValidity({
            emitEvent: false,
          });
        }
      },
    );

    this.configureDiscountValidators();
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

  private configureDiscountValidators(): void {
    const discountValidators = [
      Validators.min(0),
      Validators.max(100),
    ];

    Object.values(
      this.form.controls.electricityDiscounts.controls,
    ).forEach((control) => {
      control.clearValidators();

      if (
        this.shouldShowFixedElectricityPrices()
      ) {
        control.setValidators(discountValidators);
      }

      control.updateValueAndValidity({
        emitEvent: false,
      });
    });

    Object.values(
      this.form.controls.gasDiscounts.controls,
    ).forEach((control) => {
      control.clearValidators();

      if (this.shouldShowFixedGasPrice()) {
        control.setValidators(discountValidators);
      }

      control.updateValueAndValidity({
        emitEvent: false,
      });
    });
  }

  createTariff(): void {
    if (this.isCreating) {
      return;
    }

    this.clearMessages();
    this.configureValidators();

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      this.showError(
        'Preenche corretamente todos os campos obrigatórios.',
      );

      return;
    }

    const payload = this.buildCreatePayload();

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
          const createdTariff = response.body;

          this.showSuccess(
            createdTariff?.name
              ? `Tarifário "${createdTariff.name}" criado com sucesso.`
              : 'Tarifário criado com sucesso.',
          );

          this.resetForm();
        },
        error: (error) => {
          const message =
            error?.error?.message ||
            'Não foi possível criar o tarifário.';

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
        },
      });
  }

  private buildCreatePayload():
    | CreateSimulationTariffRequest
    | null {
    const value = this.form.getRawValue();

    if (!value.companyId) {
      this.showError('A empresa é obrigatória.');
      return null;
    }

    if (!value.name.trim()) {
      this.showError(
        'O nome do tarifário é obrigatório.',
      );

      return null;
    }

    if (
      value.salesCommission === null ||
      !Number.isFinite(
        Number(value.salesCommission),
      ) ||
      Number(value.salesCommission) < 0
    ) {
      this.showError(
        'A comissão de venda é obrigatória.',
      );

      return null;
    }

    const payload: CreateSimulationTariffRequest = {
      companyId: value.companyId,
      name: value.name.trim(),
      productType: value.productType,
      segment: value.segment,

      salesCommission:
        Number(value.salesCommission),
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

      payload.tariffType =
        value.tariffType;

      payload.powerKva =
        Number(value.powerKva);

      payload.powerPricePerDay =
        Number(value.powerPricePerDay);

      if (this.shouldShowCycleType()) {
        if (!value.cycleType) {
          this.showError(
            'Seleciona o ciclo horário.',
          );

          return null;
        }

        payload.cycleType =
          value.cycleType;
      }

      if (
        value.electricityPriceMode ===
        'fixed'
      ) {
        this.appendFixedElectricityPrices(
          payload,
          value,
        );

        const electricityDiscounts =
          this.buildDiscounts(
            value.electricityDiscounts,
          );

        if (electricityDiscounts) {
          payload.electricityDiscounts =
            electricityDiscounts;
        }
      }

      if (
        value.electricityPriceMode ===
        'indexed'
      ) {
        if (
          value.electricityAdjustmentFactor ===
            null ||
          value.electricityAdditionalCostPerKwh ===
            null
        ) {
          this.showError(
            'Preenche o fator de adequação e o custo adicional da eletricidade.',
          );

          return null;
        }

        payload.electricityAdjustmentFactor =
          Number(
            value.electricityAdjustmentFactor,
          );

        payload.electricityAdditionalCostPerKwh =
          Number(
            value.electricityAdditionalCostPerKwh,
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

      payload.gasPriceMode =
        value.gasPriceMode;

      payload.gasTier =
        Number(value.gasTier);

      payload.fixedTermPerDay =
        Number(value.fixedTermPerDay);

      if (value.gasPriceMode === 'fixed') {
        if (value.gasEnergyPrice === null) {
          this.showError(
            'O preço de energia do gás é obrigatório.',
          );

          return null;
        }

        payload.gasEnergyPrice =
          Number(value.gasEnergyPrice);

        const gasDiscounts =
          this.buildDiscounts(
            value.gasDiscounts,
          );

        if (gasDiscounts) {
          payload.gasDiscounts =
            gasDiscounts;
        }
      }

      if (
        value.gasPriceMode === 'indexed'
      ) {
        if (
          value.gasLossPercentage === null ||
          value.gasAdditionalCostPerKwh ===
            null
        ) {
          this.showError(
            'Preenche a percentagem de perdas e o custo adicional do gás.',
          );

          return null;
        }

        payload.gasLossPercentage =
          Number(value.gasLossPercentage);

        payload.gasAdditionalCostPerKwh =
          Number(
            value.gasAdditionalCostPerKwh,
          );
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
          Number(value.singleEnergyPrice);
        break;

      case 'bi_hourly':
        payload.foraVazioEnergyPrice =
          Number(
            value.foraVazioEnergyPrice,
          );

        payload.vazioEnergyPrice =
          Number(value.vazioEnergyPrice);
        break;

      case 'tri_hourly':
        payload.pontaEnergyPrice =
          Number(value.pontaEnergyPrice);

        payload.cheiasEnergyPrice =
          Number(value.cheiasEnergyPrice);

        payload.vazioEnergyPrice =
          Number(value.vazioEnergyPrice);
        break;

      case 'tetra_hourly':
        payload.pontaEnergyPrice =
          Number(value.pontaEnergyPrice);

        payload.cheiasEnergyPrice =
          Number(value.cheiasEnergyPrice);

        payload.vazioEnergyPrice =
          Number(value.vazioEnergyPrice);

        payload.superVazioEnergyPrice =
          Number(
            value.superVazioEnergyPrice,
          );
        break;
    }
  }

  private buildDiscounts(
    discounts: {
      electronicInvoice: number | null;
      directDebit: number | null;
      welcomeBonus: number | null;
      sva: number | null;
      gasBonus: number | null;
    },
  ): TariffDiscounts | undefined {
    const cleanedDiscounts =
      Object.fromEntries(
        Object.entries(discounts)
          .filter(([, value]) => {
            return (
              value !== null &&
              value !== undefined &&
              Number(value) > 0
            );
          })
          .map(([key, value]) => [
            key,
            Number(value),
          ]),
      ) as TariffDiscounts;

    return Object.keys(cleanedDiscounts).length
      ? cleanedDiscounts
      : undefined;
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

  shouldShowIndexedElectricityFields(): boolean {
    return (
      this.shouldShowElectricityFields() &&
      this.form.controls.electricityPriceMode
        .value === 'indexed'
    );
  }

  shouldShowFixedGasPrice(): boolean {
    return (
      this.shouldShowGasFields() &&
      this.form.controls.gasPriceMode.value ===
        'fixed'
    );
  }

  shouldShowIndexedGasFields(): boolean {
    return (
      this.shouldShowGasFields() &&
      this.form.controls.gasPriceMode.value ===
        'indexed'
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

  toggleElectricityDiscounts(): void {
    this.showElectricityDiscounts =
      !this.showElectricityDiscounts;
  }

  toggleGasDiscounts(): void {
    this.showGasDiscounts =
      !this.showGasDiscounts;
  }

  isInvalid(
    controlName: keyof typeof this.form.controls,
  ): boolean {
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

  private clearElectricityFields(): void {
    this.form.patchValue(
      {
        electricityPriceMode: null,
        tariffType: 'simple',
        cycleType: null,

        powerKva: null,
        powerPricePerDay: null,

        singleEnergyPrice: null,
        foraVazioEnergyPrice: null,
        vazioEnergyPrice: null,
        pontaEnergyPrice: null,
        cheiasEnergyPrice: null,
        superVazioEnergyPrice: null,

        electricityAdjustmentFactor: null,
        electricityAdditionalCostPerKwh: null,
      },
      {
        emitEvent: false,
      },
    );

    this.clearElectricityDiscounts();
    this.showElectricityDiscounts = false;
  }

  private clearGasFields(): void {
    this.form.patchValue(
      {
        gasPriceMode: null,
        gasTier: null,
        fixedTermPerDay: null,
        gasEnergyPrice: null,
        gasLossPercentage: null,
        gasAdditionalCostPerKwh: null,
      },
      {
        emitEvent: false,
      },
    );

    this.clearGasDiscounts();
    this.showGasDiscounts = false;
  }

  private clearElectricityDiscounts(): void {
    this.form.controls.electricityDiscounts.reset(
      {
        electronicInvoice: null,
        directDebit: null,
        welcomeBonus: null,
        sva: null,
        gasBonus: null,
      },
      {
        emitEvent: false,
      },
    );
  }

  private clearGasDiscounts(): void {
    this.form.controls.gasDiscounts.reset(
      {
        electronicInvoice: null,
        directDebit: null,
        welcomeBonus: null,
        sva: null,
        gasBonus: null,
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
        foraVazioEnergyPrice: null,
        vazioEnergyPrice: null,
        pontaEnergyPrice: null,
        cheiasEnergyPrice: null,
        superVazioEnergyPrice: null,

        gasEnergyPrice: null,

        electricityAdjustmentFactor: null,
        electricityAdditionalCostPerKwh: null,

        gasLossPercentage: null,
        gasAdditionalCostPerKwh: null,

        electricityDiscounts: {
          electronicInvoice: null,
          directDebit: null,
          welcomeBonus: null,
          sva: null,
          gasBonus: null,
        },

        gasDiscounts: {
          electronicInvoice: null,
          directDebit: null,
          welcomeBonus: null,
          sva: null,
          gasBonus: null,
        },

        salesCommission: null,

        startDate: '',
        endDate: '',
      },
      {
        emitEvent: false,
      },
    );

    this.showElectricityDiscounts = false;
    this.showGasDiscounts = false;

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