import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { ToastService } from '../../../core/services/toast';

import {
  Company,
  CompanyService,
} from '../../../core/services/company';

import {
  ElectricityPriceMode,
  GasPriceMode,
  ProductType,
  Segment,
  SimulationCalculationProfile,
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

import { IBERDROLA_COMPANY_ID } from '../../../core/services/iberdrola-contract';

import {
  profileAllowsElectricityEnergyPrices,
  profileAllowsGasEnergyPrice,
} from '../../../core/utils/simulation-calculation-profile';

type TariffCalculationEngine = 'legacy' | 'advanced';

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
  PEL?: number | null;
  PELPlus?: number | null;
  MGI?: number | null;
  loyalty?: number | null;
  gasBonus?: number | null;
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
  @ViewChild('editCardBody')
  private editCardBody?: ElementRef<HTMLElement>;

  private readonly fb = inject(FormBuilder);
  private readonly simulatorService = inject(SimulatorService);
  private readonly companyService = inject(CompanyService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly availablePowers = ELECTRICITY_POWERS;
  readonly availableGasLevels = GAS_LEVELS;

  companies: Company[] = [];
  calculationProfiles: SimulationCalculationProfile[] = [];

  tariffs: SimulationTariff[] = [];
  selectedTariff: SimulationTariff | null = null;
  originalTariff: SimulationTariff | null = null;

  isLoadingCompanies = false;
  isLoadingCalculationProfiles = false;
  isSearching = false;
  isSaving = false;
  isDeleting = false;

  private calculationProfilesLoaded = false;
  private linkedCalculationProfile: SimulationCalculationProfile | null = null;

  showElectricityDiscounts = false;
  showGasDiscounts = false;
  private readonly toast = inject(ToastService);

  private _errorMessage = '';
  get errorMessage(): string {
    return this._errorMessage;
  }
  set errorMessage(message: string) {
    this._errorMessage = message ?? '';

    if (this._errorMessage) {
      this.toast.error(this._errorMessage);
    }
  }

  private _successMessage = '';
  get successMessage(): string {
    return this._successMessage;
  }
  set successMessage(message: string) {
    this._successMessage = message ?? '';

    if (this._successMessage) {
      this.toast.success(this._successMessage);
    }
  }

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

    calculationEngine:
      this.fb.nonNullable.control<TariffCalculationEngine>('legacy'),

    calculationProfileId:
      this.fb.control<string | null>(null),

    segment: this.fb.control<Segment | null>(null),

    electricityPriceMode:
      this.fb.control<ElectricityPriceMode | null>(null),

    gasPriceMode:
      this.fb.control<GasPriceMode | null>(null),

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
      PEL: this.fb.control<number | null>(null),
      PELPlus: this.fb.control<number | null>(null),
      loyalty: this.fb.control<number | null>(null),
      gasBonus: this.fb.control<number | null>(null),
    }),

    gasDiscounts: this.fb.group({
      electronicInvoice: this.fb.control<number | null>(null),
      directDebit: this.fb.control<number | null>(null),
      welcomeBonus: this.fb.control<number | null>(null),
      sva: this.fb.control<number | null>(null),
      MGI: this.fb.control<number | null>(null),
      loyalty: this.fb.control<number | null>(null),
      gasBonus: this.fb.control<number | null>(null),
    }),

    salesCommission: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),

    crmCertoCommission: this.fb.control<number | null>(null, [
      Validators.min(0),
    ]),

    electricityDiscountAppliesToFixedTerm: this.fb.nonNullable.control(false),
    gasDiscountAppliesToFixedTerm: this.fb.nonNullable.control(false),
    isLoyalty: this.fb.nonNullable.control(false),

    observations:
      this.fb.nonNullable.control(''),

    startDate: this.fb.nonNullable.control(''),
    endDate: this.fb.nonNullable.control(''),

    active: this.fb.nonNullable.control(true),
  }, {
    validators: [
      (control) => this.validateDateRange(control),
    ],
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
        calculationEngine:
          tariff.calculationProfileId
            ? 'advanced'
            : 'legacy',
        calculationProfileId:
          tariff.calculationProfileId ?? null,
        segment: tariff.segment ?? null,

        electricityPriceMode:
          tariff.electricityPriceMode ?? null,
        gasPriceMode:
          tariff.gasPriceMode ?? null,

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
          this.toElectricityDiscountFormValue(
            tariff.electricityDiscounts,
          ),

        gasDiscounts:
          this.toGasDiscountFormValue(
            tariff.gasDiscounts,
          ),

        salesCommission:
          tariff.salesCommission ?? null,

        crmCertoCommission:
          tariff.crmCertoCommission ?? null,

        electricityDiscountAppliesToFixedTerm: tariff.electricityDiscountAppliesToFixedTerm ?? false,
        gasDiscountAppliesToFixedTerm: tariff.gasDiscountAppliesToFixedTerm ?? false,
        isLoyalty: tariff.isLoyalty ?? false,

        observations:
          tariff.observations ?? '',

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

    this.linkedCalculationProfile = null;

    if (tariff.calculationProfileId) {
      this.loadCalculationProfilesForSelection();
    }

    this.configureValidators();
    this.editForm.markAsPristine();
    this.editForm.markAsUntouched();

    this.scrollEditorToTop();
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

    // Evita transportar a validação de ciclo de um tarifário anterior
    // quando o utilizador seleciona outro produto/modo de preço.
    controls.cycleType.clearValidators();

    controls.salesCommission.setValidators([
      Validators.required,
      Validators.min(0),
    ]);

    controls.crmCertoCommission.setValidators([
      Validators.min(0),
    ]);

    controls.calculationProfileId.clearValidators();
    controls.electricityPriceMode.clearValidators();
    controls.gasPriceMode.clearValidators();

    if (this.isAdvancedMode()) {
      controls.calculationProfileId.setValidators(
        Validators.required,
      );
    }

    if (this.shouldEditShowElectricityFields()) {
      controls.powerKva.setValidators([
        Validators.required,
        Validators.min(0.01),
      ]);

      if (this.shouldEditShowCycleType()) {
        controls.cycleType.setValidators(
          Validators.required,
        );
      } else {
        controls.cycleType.clearValidators();
      }

      if (this.isLegacyMode()) {
        controls.electricityPriceMode.setValidators(
          Validators.required,
        );

        controls.powerPricePerDay.setValidators([
          Validators.required,
          Validators.min(0),
        ]);

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
      } else {
        controls.powerPricePerDay.setValidators(
          Validators.min(0),
        );

        if (this.shouldEditShowFixedElectricityPrices()) {
          this.configureOptionalElectricityEnergyValidators();
        }
      }
    }

    if (this.shouldEditShowGasFields()) {
      controls.gasTier.setValidators([
        Validators.required,
        Validators.min(1),
      ]);

      if (this.isLegacyMode()) {
        controls.gasPriceMode.setValidators(
          Validators.required,
        );

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
      } else {
        controls.fixedTermPerDay.setValidators(
          Validators.min(0),
        );

        if (this.shouldEditShowFixedGasPrice()) {
          controls.gasEnergyPrice.setValidators(
            Validators.min(0),
          );
        }
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

    controls.salesCommission.updateValueAndValidity({
      emitEvent: false,
    });

    controls.crmCertoCommission.updateValueAndValidity({
      emitEvent: false,
    });

    controls.calculationProfileId.updateValueAndValidity({
      emitEvent: false,
    });

    controls.electricityPriceMode.updateValueAndValidity({
      emitEvent: false,
    });

    controls.gasPriceMode.updateValueAndValidity({
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

  private configureOptionalElectricityEnergyValidators(): void {
    const controls = this.editForm.controls;
    const validators = [Validators.min(0)];

    switch (this.selectedTariff?.tariffType) {
      case 'simple':
        controls.singleEnergyPrice.setValidators(validators);
        break;
      case 'bi_hourly':
        controls.foraVazioEnergyPrice.setValidators(validators);
        controls.vazioEnergyPrice.setValidators(validators);
        break;
      case 'tri_hourly':
        controls.pontaEnergyPrice.setValidators(validators);
        controls.cheiasEnergyPrice.setValidators(validators);
        controls.vazioEnergyPrice.setValidators(validators);
        break;
      case 'tetra_hourly':
        controls.pontaEnergyPrice.setValidators(validators);
        controls.cheiasEnergyPrice.setValidators(validators);
        controls.vazioEnergyPrice.setValidators(validators);
        controls.superVazioEnergyPrice.setValidators(validators);
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

      if (this.shouldEditConfigureElectricityDiscounts()) {
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

      if (this.shouldEditConfigureGasDiscounts()) {
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

    if (
      this.isAdvancedMode() &&
      !this.isCalculationProfileSelectionValid()
    ) {
      this.showError(
        'Seleciona um perfil de cálculo válido para esta empresa e produto.',
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

    if (this.isAdvancedMode()) {
      this.addChangedValue(
        payload,
        'calculationProfileId',
        original.calculationProfileId ?? null,
        current.calculationProfileId,
      );
    } else if (original.calculationProfileId) {
      payload.calculationProfileId = null;
    }

    this.addChangedNumber(
      payload,
      'salesCommission',
      original.salesCommission,
      current.salesCommission,
    );

    this.addChangedNumber(
      payload,
      'crmCertoCommission',
      original.crmCertoCommission,
      current.crmCertoCommission,
    );

    this.addChangedValue(payload, 'isLoyalty', original.isLoyalty ?? false, Boolean(current.isLoyalty));

    this.addChangedStringAllowEmpty(
      payload,
      'observations',
      original.observations ?? '',
      current.observations.trim(),
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

      if (this.shouldEditShowCycleType()) {
        this.addChangedValue(
          payload,
          'cycleType',
          original.cycleType,
          current.cycleType ?? undefined,
        );
      }

      if (this.isLegacyMode()) {
        this.addChangedValue(
          payload,
          'electricityPriceMode',
          original.electricityPriceMode,
          current.electricityPriceMode ?? undefined,
        );

        this.addChangedNumber(
          payload,
          'powerPricePerDay',
          original.powerPricePerDay,
          current.powerPricePerDay,
        );

        if (this.isFixedElectricity()) {
          this.appendFixedElectricityChanges(
            payload,
            current,
          );

          const currentDiscounts =
            this.buildCompleteDiscounts(
              current.electricityDiscounts,
              'electricity',
            );

          const originalDiscounts =
            this.buildCompleteDiscounts(
              this.toElectricityDiscountFormValue(
                original.electricityDiscounts,
              ),
              'electricity',
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
      } else {
        this.addChangedNumber(
          payload,
          'powerPricePerDay',
          original.powerPricePerDay,
          current.powerPricePerDay,
        );

        if (this.shouldEditShowFixedElectricityPrices()) {
          this.appendFixedElectricityChanges(payload, current);
        }

        this.appendElectricityDiscountChanges(
          payload,
          original,
          current,
        );
      }

      this.addChangedValue(
        payload,
        'electricityDiscountAppliesToFixedTerm',
        original.electricityDiscountAppliesToFixedTerm ?? false,
        Boolean(current.electricityDiscountAppliesToFixedTerm),
      );
    }

    if (this.shouldEditShowGasFields()) {
      this.addChangedNumber(
        payload,
        'gasTier',
        original.gasTier,
        current.gasTier,
      );

      if (this.isLegacyMode()) {
        this.addChangedValue(
          payload,
          'gasPriceMode',
          original.gasPriceMode,
          current.gasPriceMode ?? undefined,
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
              'gas',
            );

          const originalDiscounts =
            this.buildCompleteDiscounts(
              this.toGasDiscountFormValue(
                original.gasDiscounts,
              ),
              'gas',
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
      } else {
        this.addChangedNumber(
          payload,
          'fixedTermPerDay',
          original.fixedTermPerDay,
          current.fixedTermPerDay,
        );

        if (this.shouldEditShowFixedGasPrice()) {
          this.addChangedNumber(
            payload,
            'gasEnergyPrice',
            original.gasEnergyPrice,
            current.gasEnergyPrice,
          );
        }

        this.appendGasDiscountChanges(
          payload,
          original,
          current,
        );
      }

      this.addChangedValue(
        payload,
        'gasDiscountAppliesToFixedTerm',
        original.gasDiscountAppliesToFixedTerm ?? false,
        Boolean(current.gasDiscountAppliesToFixedTerm),
      );
    }

    return payload;
  }

  private appendElectricityDiscountChanges(
    payload: UpdateSimulationTariffRequest,
    original: SimulationTariff,
    current: ReturnType<typeof this.editForm.getRawValue>,
  ): void {
    const currentDiscounts = this.buildCompleteDiscounts(
      current.electricityDiscounts,
      'electricity',
    );
    const originalDiscounts = this.buildCompleteDiscounts(
      this.toElectricityDiscountFormValue(
        original.electricityDiscounts,
      ),
      'electricity',
    );

    if (!this.areEqual(originalDiscounts, currentDiscounts)) {
      payload.electricityDiscounts = currentDiscounts;
    }
  }

  private appendGasDiscountChanges(
    payload: UpdateSimulationTariffRequest,
    original: SimulationTariff,
    current: ReturnType<typeof this.editForm.getRawValue>,
  ): void {
    const currentDiscounts = this.buildCompleteDiscounts(
      current.gasDiscounts,
      'gas',
    );
    const originalDiscounts = this.buildCompleteDiscounts(
      this.toGasDiscountFormValue(original.gasDiscounts),
      'gas',
    );

    if (!this.areEqual(originalDiscounts, currentDiscounts)) {
      payload.gasDiscounts = currentDiscounts;
    }
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

  private addChangedStringAllowEmpty<
    K extends keyof UpdateSimulationTariffRequest,
  >(
    payload: UpdateSimulationTariffRequest,
    key: K,
    originalValue: string | undefined,
    currentValue: string,
  ): void {
    const normalizedOriginal =
      originalValue?.trim() || '';

    if (currentValue !== normalizedOriginal) {
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

  hasInvalidDateRange(): boolean {
    return this.editForm.hasError('dateRange');
  }

  getTariffValidityLabel(
    tariff: SimulationTariff,
  ): string {
    const startDate = this.formatDateOnly(
      tariff.startDate,
    );
    const endDate = this.formatDateOnly(
      tariff.endDate,
    );

    if (startDate && endDate) {
      return `Vigência: ${startDate} — ${endDate}`;
    }

    if (startDate) {
      return `Vigência: desde ${startDate}`;
    }

    if (endDate) {
      return `Vigência: até ${endDate}`;
    }

    return 'Vigência: sem período definido';
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

  isAdvancedMode(): boolean {
    return (
      this.editForm.controls.calculationEngine.value ===
      'advanced'
    );
  }

  isLegacyMode(): boolean {
    return !this.isAdvancedMode();
  }

  onCalculationEngineChange(): void {
    this.clearMessages();

    if (this.isAdvancedMode()) {
      this.clearLegacyFormulaFields();
      this.loadCalculationProfilesForSelection();
      this.applyAdvancedProfileCompatibility();
    } else {
      this.editForm.controls.calculationProfileId.setValue(
        null,
        { emitEvent: false },
      );
      this.restoreLegacyPricingFieldsFromOriginal();
    }

    this.configureValidators();
  }

  onLegacyPriceModeChange(): void {
    this.clearMessages();
    this.configureValidators();
  }

  onCalculationProfileChange(): void {
    this.clearMessages();
    this.applyAdvancedProfileCompatibility();
    this.configureValidators();
  }

  get selectableCalculationProfiles():
    SimulationCalculationProfile[] {
    if (!this.selectedTariff) {
      return [];
    }

    const companyId = this.getSelectedCompanyId();
    const productType = this.selectedTariff.productType;
    const originalProfileId =
      this.originalTariff?.calculationProfileId ?? null;

    const profiles = this.calculationProfiles.filter(
      (profile) =>
        profile.commercializerId === companyId &&
        profile.productType === productType &&
        (profile.active ||
          profile.id === originalProfileId),
    );

    if (
      this.linkedCalculationProfile &&
      this.linkedCalculationProfile.commercializerId === companyId &&
      this.linkedCalculationProfile.productType === productType &&
      !profiles.some(
        (profile) =>
          profile.id === this.linkedCalculationProfile?.id,
      )
    ) {
      profiles.push(this.linkedCalculationProfile);
    }

    return profiles.sort((a, b) => {
      if (a.id === originalProfileId) {
        return -1;
      }
      if (b.id === originalProfileId) {
        return 1;
      }
      return b.version - a.version;
    });
  }

  getCalculationProfileLabel(
    profile: SimulationCalculationProfile,
  ): string {
    const state = profile.active
      ? 'Ativo'
      : 'Histórico / inativo';

    return `${profile.familyCode} · v${profile.version} · ${this.getCalculationProfileStrategyLabel(profile)} · ${state}`;
  }

  getCalculationProfileStrategyLabel(
    profile: SimulationCalculationProfile,
  ): string {
    const strategies = [
      profile.electricity?.strategy,
      profile.gas?.strategy,
    ].filter((strategy): strategy is NonNullable<typeof strategy> => Boolean(strategy));

    return strategies.length
      ? [...new Set(strategies)]
          .map((strategy) =>
            strategy
              .replaceAll('_', ' ')
              .replace(/\b\w/g, (letter) =>
                letter.toUpperCase(),
              ),
          )
          .join(' + ')
      : 'Estratégia configurada';
  }

  isOriginalHistoricalProfile(
    profile: SimulationCalculationProfile,
  ): boolean {
    return (
      !profile.active &&
      profile.id ===
        this.originalTariff?.calculationProfileId
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

  get selectedCalculationProfile():
    SimulationCalculationProfile | null {
    const selectedId =
      this.editForm.controls.calculationProfileId.value;

    return selectedId
      ? this.selectableCalculationProfiles.find(
          (profile) => profile.id === selectedId,
        ) ?? null
      : null;
  }

  isFixedElectricity(): boolean {
    return (
      this.isLegacyMode() &&
      this.shouldEditShowElectricityFields() &&
      this.editForm.controls.electricityPriceMode.value ===
        'fixed'
    );
  }

  isIndexedElectricity(): boolean {
    return (
      this.isLegacyMode() &&
      this.shouldEditShowElectricityFields() &&
      this.editForm.controls.electricityPriceMode.value ===
        'indexed'
    );
  }

  isFixedGas(): boolean {
    return (
      this.isLegacyMode() &&
      this.shouldEditShowGasFields() &&
      this.editForm.controls.gasPriceMode.value ===
        'fixed'
    );
  }

  isIndexedGas(): boolean {
    return (
      this.isLegacyMode() &&
      this.shouldEditShowGasFields() &&
      this.editForm.controls.gasPriceMode.value ===
        'indexed'
    );
  }

  shouldEditShowFixedElectricityPrices(): boolean {
    if (!this.shouldEditShowElectricityFields()) {
      return false;
    }

    return this.isAdvancedMode()
      ? profileAllowsElectricityEnergyPrices(
          this.selectedCalculationProfile,
        )
      : this.isFixedElectricity();
  }

  shouldEditShowFixedGasPrice(): boolean {
    if (!this.shouldEditShowGasFields()) {
      return false;
    }

    return this.isAdvancedMode()
      ? profileAllowsGasEnergyPrice(
          this.selectedCalculationProfile,
        )
      : this.isFixedGas();
  }

  shouldEditConfigureElectricityDiscounts(): boolean {
    return (
      this.shouldEditShowElectricityFields() &&
      (this.isLegacyMode()
        ? this.isFixedElectricity()
        : Boolean(this.selectedCalculationProfile))
    );
  }

  shouldEditConfigureGasDiscounts(): boolean {
    return (
      this.shouldEditShowGasFields() &&
      (this.isLegacyMode()
        ? this.isFixedGas()
        : Boolean(this.selectedCalculationProfile))
    );
  }

  shouldEditShowSimplePrices(): boolean {
    return (
      this.shouldEditShowFixedElectricityPrices() &&
      this.selectedTariff?.tariffType === 'simple'
    );
  }

  shouldEditShowBiHourlyPrices(): boolean {
    return (
      this.shouldEditShowFixedElectricityPrices() &&
      this.selectedTariff?.tariffType === 'bi_hourly'
    );
  }

  shouldEditShowTriHourlyPrices(): boolean {
    return (
      this.shouldEditShowFixedElectricityPrices() &&
      this.selectedTariff?.tariffType === 'tri_hourly'
    );
  }

  shouldEditShowTetraHourlyPrices(): boolean {
    return (
      this.shouldEditShowFixedElectricityPrices() &&
      this.selectedTariff?.tariffType === 'tetra_hourly'
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
    energy: 'electricity' | 'gas',
  ): TariffDiscounts {
    const result: TariffDiscounts = {};

    const addDiscount = (
      key: keyof TariffDiscounts,
      value: number | null | undefined,
    ): void => {
      if (
        value === null ||
        value === undefined ||
        Number(value) <= 0
      ) {
        return;
      }

      result[key] = Number(value);
    };

    addDiscount(
      'electronicInvoice',
      discounts.electronicInvoice,
    );
    addDiscount('directDebit', discounts.directDebit);
    addDiscount('welcomeBonus', discounts.welcomeBonus);
    addDiscount('loyalty', discounts.loyalty);
    addDiscount('gasBonus', discounts.gasBonus);

    if (this.isIberdrolaEnergyTariff()) {
      if (energy === 'electricity') {
        addDiscount('PEL', discounts.PEL);
        addDiscount('PELPlus', discounts.PELPlus);
      } else {
        addDiscount('MGI', discounts.MGI);
      }
    } else {
      addDiscount('sva', discounts.sva);
    }

    return result;
  }

  private toElectricityDiscountFormValue(
    discounts?: TariffDiscounts,
  ): DiscountFormValue {
    return {
      electronicInvoice:
        discounts?.electronicInvoice ?? null,

      directDebit:
        discounts?.directDebit ?? null,

      welcomeBonus:
        discounts?.welcomeBonus ?? null,

      sva: this.isIberdrolaEnergyTariff()
        ? null
        : discounts?.sva ?? null,

      PEL: this.isIberdrolaEnergyTariff()
        ? discounts?.PEL ?? null
        : null,

      PELPlus: this.isIberdrolaEnergyTariff()
        ? discounts?.PELPlus ?? null
        : null,

      loyalty:
        discounts?.loyalty ?? null,

      gasBonus:
        discounts?.gasBonus ?? null,
    };
  }

  private toGasDiscountFormValue(
    discounts?: TariffDiscounts,
  ): DiscountFormValue {
    return {
      electronicInvoice:
        discounts?.electronicInvoice ?? null,

      directDebit:
        discounts?.directDebit ?? null,

      welcomeBonus:
        discounts?.welcomeBonus ?? null,

      sva: this.isIberdrolaEnergyTariff()
        ? null
        : discounts?.sva ?? null,

      MGI: this.isIberdrolaEnergyTariff()
        ? discounts?.MGI ?? null
        : null,

      loyalty:
        discounts?.loyalty ?? null,

      gasBonus:
        discounts?.gasBonus ?? null,
    };
  }

  isIberdrolaEnergyTariff(
    tariff: SimulationTariff | null = this.selectedTariff,
  ): boolean {
    return Boolean(
      tariff &&
        (tariff.companyId === IBERDROLA_COMPANY_ID ||
          tariff.provider?.id === IBERDROLA_COMPANY_ID),
    );
  }

  private loadCalculationProfilesForSelection(): void {
    if (
      !this.selectedTariff ||
      !this.isAdvancedMode()
    ) {
      return;
    }

    if (this.calculationProfilesLoaded) {
      this.ensureLinkedCalculationProfileLoaded();
      return;
    }

    if (this.isLoadingCalculationProfiles) {
      return;
    }

    this.isLoadingCalculationProfiles = true;

    this.simulatorService
      .getCalculationProfiles()
      .pipe(
        finalize(() => {
          this.isLoadingCalculationProfiles = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (profiles) => {
          this.calculationProfiles = profiles;
          this.calculationProfilesLoaded = true;
          this.ensureLinkedCalculationProfileLoaded();
        },
        error: (error) => {
          this.showBackendError(
            error,
            'Não foi possível carregar os perfis de cálculo.',
          );
        },
      });
  }

  private ensureLinkedCalculationProfileLoaded(): void {
    const profileId =
      this.originalTariff?.calculationProfileId;

    if (!profileId) {
      return;
    }

    const existing = this.calculationProfiles.find(
      (profile) => profile.id === profileId,
    );

    if (existing) {
      this.linkedCalculationProfile = existing;
      this.applyAdvancedProfileCompatibility();
      this.configureValidators();
      return;
    }

    this.simulatorService
      .getCalculationProfileById(profileId)
      .subscribe({
        next: (profile) => {
          this.linkedCalculationProfile = profile;
          this.applyAdvancedProfileCompatibility();
          this.configureValidators();
          this.cdr.detectChanges();
        },
        error: () => {
          this.linkedCalculationProfile = null;
        },
      });
  }

  private getSelectedCompanyId(): string {
    return (
      this.selectedTariff?.companyId ||
      this.selectedTariff?.provider?.id ||
      ''
    );
  }

  private isCalculationProfileSelectionValid(): boolean {
    const selectedId =
      this.editForm.controls.calculationProfileId.value;

    if (!selectedId) {
      return false;
    }

    const profile =
      this.selectableCalculationProfiles.find(
        (candidate) => candidate.id === selectedId,
      );

    if (!profile) {
      return false;
    }

    return (
      profile.active ||
      profile.id ===
        this.originalTariff?.calculationProfileId
    );
  }

  private clearLegacyFormulaFields(): void {
    this.editForm.patchValue(
      {
        electricityPriceMode: null,
        gasPriceMode: null,
        electricityAdjustmentFactor: null,
        electricityAdditionalCostPerKwh: null,
        gasLossPercentage: null,
        gasAdditionalCostPerKwh: null,
      },
      { emitEvent: false },
    );
  }

  private applyAdvancedProfileCompatibility(): void {
    if (!this.isAdvancedMode()) {
      return;
    }

    const profile = this.selectedCalculationProfile;

    if (!profile) {
      return;
    }

    if (
      this.shouldEditShowElectricityFields() &&
      !profileAllowsElectricityEnergyPrices(profile)
    ) {
      this.editForm.patchValue(
        {
          singleEnergyPrice: null,
          foraVazioEnergyPrice: null,
          vazioEnergyPrice: null,
          pontaEnergyPrice: null,
          cheiasEnergyPrice: null,
          superVazioEnergyPrice: null,
        },
        { emitEvent: false },
      );
    }

    if (
      this.shouldEditShowGasFields() &&
      !profileAllowsGasEnergyPrice(profile)
    ) {
      this.editForm.controls.gasEnergyPrice.setValue(
        null,
        { emitEvent: false },
      );
    }
  }

  private restoreLegacyPricingFieldsFromOriginal(): void {
    const tariff = this.originalTariff;

    if (!tariff || tariff.calculationProfileId) {
      return;
    }

    this.editForm.patchValue(
      {
        electricityPriceMode:
          tariff.electricityPriceMode ?? null,
        gasPriceMode:
          tariff.gasPriceMode ?? null,
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
        electricityDiscountAppliesToFixedTerm:
          tariff.electricityDiscountAppliesToFixedTerm ?? false,
        gasDiscountAppliesToFixedTerm:
          tariff.gasDiscountAppliesToFixedTerm ?? false,
        electricityDiscounts:
          this.toElectricityDiscountFormValue(
            tariff.electricityDiscounts,
          ),
        gasDiscounts:
          this.toGasDiscountFormValue(
            tariff.gasDiscounts,
          ),
      },
      { emitEvent: false },
    );

    this.showElectricityDiscounts = Boolean(
      tariff.electricityDiscounts &&
        Object.keys(tariff.electricityDiscounts).length,
    );
    this.showGasDiscounts = Boolean(
      tariff.gasDiscounts &&
        Object.keys(tariff.gasDiscounts).length,
    );
  }

  private toDateInputValue(
    value?: string | null,
  ): string {
    return value
      ? value.substring(0, 10)
      : '';
  }

  private formatDateOnly(
    value?: string | null,
  ): string {
    const dateOnly = this.toDateInputValue(value);

    if (!dateOnly) {
      return '';
    }

    const [year, month, day] = dateOnly.split('-');

    if (!year || !month || !day) {
      return dateOnly;
    }

    return `${day}/${month}/${year}`;
  }

  private validateDateRange(
    control: AbstractControl,
  ): ValidationErrors | null {
    const startDate = control.get('startDate')?.value;
    const endDate = control.get('endDate')?.value;

    if (!startDate || !endDate) {
      return null;
    }

    return endDate >= startDate
      ? null
      : { dateRange: true };
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

  private scrollEditorToTop(): void {
    requestAnimationFrame(() => {
      const element =
        this.editCardBody?.nativeElement;

      if (!element) {
        return;
      }

      element.scrollTo({
        top: 0,
        behavior: 'smooth',
      });

      if (
        window.matchMedia(
          '(max-width: 1200px)',
        ).matches
      ) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    });
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