import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';

import { Company } from '../../../../core/services/company';
import {
  CreateSimulationCalculationProfileRequest,
  CreateSimulationCalculationProfileVersionRequest,
  ProductType,
  SimulationCalculationProfile,
  SimulationCalculationProfileEnergyConfig,
  SimulationCalculationProfileIncludedComponents,
  SimulationCalculationStrategy,
  SimulationCommissionMode,
  SimulationLossSource,
  SimulationMarginKind,
  SimulationMarginUnit,
  SimulationMarketReference,
  SimulationMarketSource,
  SimulationNetworkAccessMode,
  SimulationSystemCostSource,
  SimulationWeightedComponent,
  SimulatorService,
} from '../../../../core/services/simulator';
import { ToastService } from '../../../../core/services/toast';

type EnergyKind = 'electricity' | 'gas';

@Component({
  selector: 'app-calculation-profile-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './calculation-profile-create.html',
  styleUrl: './calculation-profile-create.scss',
})
export class CalculationProfileCreate implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly simulatorService = inject(SimulatorService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() companies: Company[] = [];
  @Input() versionSource: SimulationCalculationProfile | null = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() created = new EventEmitter<SimulationCalculationProfile>();

  isSubmitting = false;
  submitAttempted = false;

  readonly strategyOptions: SimulationCalculationStrategy[] = [
    'legacy_fixed',
    'legacy_indexed',
    'indexed_cost_plus',
    'adjusted_factor_plus',
    'fixed_hedge_plus_system_cost',
    'weighted_mix',
    'gas_adjusted',
  ];

  readonly commissionModes: SimulationCommissionMode[] = ['team_table', 'formula_margin', 'hybrid'];

  readonly marketReferences: SimulationMarketReference[] = [
    'isp',
    'hourly',
    'daily_average',
    'monthly_average',
  ];

  readonly systemCostSources: SimulationSystemCostSource[] = ['ren_erc', 'static', 'composite'];

  readonly lossSources: SimulationLossSource[] = ['erse', 'static', 'matrix'];

  readonly marginKinds: SimulationMarginKind[] = ['K', 'OPERATING_MARGIN', 'FEE'];

  readonly marginUnits: SimulationMarginUnit[] = ['EUR_MWH', 'CENT_KWH'];

  readonly networkAccessModes: SimulationNetworkAccessMode[] = ['included', 'excluded'];

  readonly form = this.fb.group(
    {
      familyCode: ['', [Validators.required, this.trimmedRequiredValidator]],
      commercializerId: ['', Validators.required],
      productType: ['electricity' as ProductType, Validators.required],
      commissionMode: ['team_table' as SimulationCommissionMode, Validators.required],
      active: [true],
      effectiveFrom: [''],
      effectiveTo: [''],
      includedComponents: this.fb.group({
        networkAccessPower: [false],
        networkAccessFixedTerm: [false],
        networkAccessEnergy: [false],
        losses: [false],
        renSystemCosts: [false],
        mfrr: [false],
        guaranteesOfOrigin: [false],
        socialTariffFinancing: [false],
      }),
      electricity: this.createEnergyGroup('indexed_cost_plus'),
      gas: this.createEnergyGroup('gas_adjusted'),
    },
    { validators: this.effectiveDateRangeValidator },
  );

  get isVersionMode(): boolean {
    return !!this.versionSource;
  }

  get sourceVersionLabel(): string {
    return this.versionSource ? `v${this.versionSource.version}` : '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['versionSource']) {
      this.prepareFormForMode();
      return;
    }

    if (changes['companies'] && this.versionSource) {
      this.form.controls.commercializerId.setValue(
        this.resolveCompanyFormId(this.versionSource.commercializerId),
        { emitEvent: false },
      );
    }
  }

  get usesElectricity(): boolean {
    const productType = this.form.controls.productType.value;
    return productType === 'electricity' || productType === 'dual';
  }

  get usesGas(): boolean {
    const productType = this.form.controls.productType.value;
    return productType === 'gas' || productType === 'dual';
  }

  get electricityGroup(): FormGroup {
    return this.form.controls.electricity;
  }

  get gasGroup(): FormGroup {
    return this.form.controls.gas;
  }

  get includedComponentsGroup(): FormGroup {
    return this.form.controls.includedComponents;
  }

  get areLossesIncluded(): boolean {
    return this.form.controls.includedComponents.controls.losses.value ?? false;
  }

  get areRenSystemCostsIncluded(): boolean {
    return this.form.controls.includedComponents.controls.renSystemCosts.value ?? false;
  }

  get electricityComponents(): FormArray {
    return this.electricityGroup.controls['components'] as FormArray;
  }

  get gasComponents(): FormArray {
    return this.gasGroup.controls['components'] as FormArray;
  }

  get selectableCompanies(): Company[] {
    return [...this.companies].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-PT', { sensitivity: 'base' }),
    );
  }

  getMarketSources(energy: EnergyKind): SimulationMarketSource[] {
    return energy === 'electricity' ? ['omie'] : ['mibgas'];
  }

  getSystemCostSources(energy: EnergyKind): SimulationSystemCostSource[] {
    return energy === 'electricity'
      ? this.systemCostSources
      : this.systemCostSources.filter((source) => source !== 'ren_erc');
  }

  getEnergyGroup(energy: EnergyKind): FormGroup {
    return energy === 'electricity' ? this.electricityGroup : this.gasGroup;
  }

  getComponents(energy: EnergyKind): FormArray {
    return energy === 'electricity' ? this.electricityComponents : this.gasComponents;
  }

  isWeightedMix(energy: EnergyKind): boolean {
    return this.getEnergyGroup(energy).controls['strategy'].value === 'weighted_mix';
  }

  onProductTypeChange(): void {
    this.submitAttempted = false;
    this.reconcileIncludedComponentSources();
  }

  onIncludedComponentsChange(): void {
    this.reconcileIncludedComponentSources();
  }

  addComponent(energy: EnergyKind): void {
    const defaultStrategy: SimulationCalculationStrategy =
      energy === 'electricity' ? 'indexed_cost_plus' : 'gas_adjusted';

    this.getComponents(energy).push(this.createWeightedComponentGroup(defaultStrategy));
    this.reconcileIncludedComponentSources();
  }

  removeComponent(energy: EnergyKind, index: number): void {
    this.getComponents(energy).removeAt(index);
  }

  close(): void {
    if (!this.isSubmitting) {
      this.cancel.emit();
    }
  }

  submit(): void {
    this.submitAttempted = true;
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.toast.error(
        this.isVersionMode
          ? 'Revê os campos obrigatórios antes de criar a nova versão.'
          : 'Revê os campos obrigatórios antes de criar o perfil.',
      );
      return;
    }

    if (
      !this.validateIncludedComponentSources() ||
      !this.validateOptionalMargins('electricity') ||
      !this.validateOptionalMargins('gas') ||
      !this.validateWeightedMix('electricity') ||
      !this.validateWeightedMix('gas')
    ) {
      return;
    }

    const request$ = this.versionSource
      ? this.simulatorService.createCalculationProfileVersion(
          this.versionSource.id,
          this.buildVersionPayload(),
        )
      : this.simulatorService.createCalculationProfile(this.buildPayload());

    this.isSubmitting = true;

    request$
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (profile) => {
          this.toast.success(
            this.isVersionMode
              ? `Versão ${profile.version} criada com sucesso.`
              : 'Perfil de cálculo criado com sucesso.',
          );
          this.created.emit(profile);
        },
        error: (error) => {
          this.toast.error(
            error?.error?.message ||
              (this.isVersionMode
                ? 'Não foi possível criar a nova versão do perfil.'
                : 'Não foi possível criar o perfil de cálculo.'),
          );
        },
      });
  }

  getStrategyLabel(strategy: SimulationCalculationStrategy): string {
    const labels: Record<SimulationCalculationStrategy, string> = {
      legacy_fixed: 'Legacy fixo',
      legacy_indexed: 'Legacy indexado',
      indexed_cost_plus: 'Custo indexado + margem',
      adjusted_factor_plus: 'Fator ajustado + margem',
      fixed_hedge_plus_system_cost: 'Hedge fixo + custo de sistema',
      weighted_mix: 'Mix ponderado',
      gas_adjusted: 'Gás ajustado',
    };

    return labels[strategy];
  }

  getCommissionModeLabel(mode: SimulationCommissionMode): string {
    const labels: Record<SimulationCommissionMode, string> = {
      team_table: 'Tabela de equipa',
      formula_margin: 'Margem da fórmula',
      hybrid: 'Híbrida',
    };

    return labels[mode];
  }

  getMarketReferenceLabel(reference: SimulationMarketReference): string {
    const labels: Record<SimulationMarketReference, string> = {
      isp: 'ISP',
      hourly: 'Horária',
      daily_average: 'Média diária',
      monthly_average: 'Média mensal',
    };

    return labels[reference];
  }

  getSystemCostSourceLabel(source: SimulationSystemCostSource): string {
    const labels: Record<SimulationSystemCostSource, string> = {
      ren_erc: 'REN / ERC',
      static: 'Estático',
      composite: 'Composto',
    };

    return labels[source];
  }

  getLossSourceLabel(source: SimulationLossSource): string {
    const labels: Record<SimulationLossSource, string> = {
      erse: 'ERSE',
      static: 'Estático',
      matrix: 'Matriz',
    };

    return labels[source];
  }

  getNetworkAccessModeLabel(mode: SimulationNetworkAccessMode): string {
    return mode === 'included' ? 'Incluída' : 'Excluída';
  }

  getMarginUnitLabel(unit: SimulationMarginUnit): string {
    return unit === 'EUR_MWH' ? '€/MWh' : 'cênt./kWh';
  }

  isInvalid(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.touched || this.submitAttempted);
  }

  private createEnergyGroup(strategy: SimulationCalculationStrategy): FormGroup {
    return this.fb.group({
      strategy: [strategy, Validators.required],
      marketSource: [''],
      marketReference: [''],
      systemCostSource: [''],
      lossSource: [''],
      networkAccessMode: [''],
      marginKind: [''],
      marginValue: [null as number | null],
      marginUnit: ['EUR_MWH' as SimulationMarginUnit],
      components: this.fb.array([]),
    });
  }

  private createWeightedComponentGroup(strategy: SimulationCalculationStrategy): FormGroup {
    return this.fb.group({
      code: ['', [Validators.required, this.trimmedRequiredValidator]],
      weight: [null as number | null, [Validators.required, Validators.min(0)]],
      strategy: [strategy, Validators.required],
      marketSource: [''],
      marketReference: [''],
      systemCostSource: [''],
      lossSource: [''],
      networkAccessMode: [''],
      marginKind: [''],
      marginValue: [null as number | null],
      marginUnit: ['EUR_MWH' as SimulationMarginUnit],
    });
  }

  private prepareFormForMode(): void {
    if (!this.versionSource) {
      this.enableIdentityControls();
      return;
    }

    const source = this.versionSource;
    this.submitAttempted = false;

    this.form.patchValue(
      {
        familyCode: source.familyCode,
        commercializerId: this.resolveCompanyFormId(source.commercializerId),
        productType: source.productType,
        commissionMode: source.commissionMode,
        active: source.active,
        effectiveFrom: this.toDateInputValue(source.effectiveFrom),
        effectiveTo: this.toDateInputValue(source.effectiveTo),
      },
      { emitEvent: false },
    );

    this.form.controls.includedComponents.patchValue(
      {
        networkAccessPower: source.includedComponents?.networkAccessPower ?? false,
        networkAccessFixedTerm: source.includedComponents?.networkAccessFixedTerm ?? false,
        networkAccessEnergy: source.includedComponents?.networkAccessEnergy ?? false,
        losses: source.includedComponents?.losses ?? false,
        renSystemCosts: source.includedComponents?.renSystemCosts ?? false,
        mfrr: source.includedComponents?.mfrr ?? false,
        guaranteesOfOrigin: source.includedComponents?.guaranteesOfOrigin ?? false,
        socialTariffFinancing: source.includedComponents?.socialTariffFinancing ?? false,
      },
      { emitEvent: false },
    );

    this.populateEnergyGroup('electricity', source.electricity);
    this.populateEnergyGroup('gas', source.gas);
    this.reconcileIncludedComponentSources();
    this.disableIdentityControls();
  }

  private populateEnergyGroup(
    energy: EnergyKind,
    config?: SimulationCalculationProfileEnergyConfig,
  ): void {
    const group = this.getEnergyGroup(energy);
    const fallbackStrategy: SimulationCalculationStrategy =
      energy === 'electricity' ? 'indexed_cost_plus' : 'gas_adjusted';

    group.patchValue(
      {
        strategy: config?.strategy ?? fallbackStrategy,
        marketSource: config?.marketSource ?? '',
        marketReference: config?.marketReference ?? '',
        systemCostSource: config?.systemCostSource ?? '',
        lossSource: config?.lossSource ?? '',
        networkAccessMode: config?.networkAccessMode ?? '',
        marginKind: config?.margin?.kind ?? '',
        marginValue: config?.margin?.value ?? null,
        marginUnit: config?.margin?.unit ?? 'EUR_MWH',
      },
      { emitEvent: false },
    );

    const components = this.getComponents(energy);
    components.clear();

    for (const component of config?.components ?? []) {
      const componentGroup = this.createWeightedComponentGroup(component.strategy);
      componentGroup.patchValue(
        {
          code: component.code,
          weight: component.weight,
          strategy: component.strategy,
          marketSource: component.marketSource ?? '',
          marketReference: component.marketReference ?? '',
          systemCostSource: component.systemCostSource ?? '',
          lossSource: component.lossSource ?? '',
          networkAccessMode: component.networkAccessMode ?? '',
          marginKind: component.margin?.kind ?? '',
          marginValue: component.margin?.value ?? null,
          marginUnit: component.margin?.unit ?? 'EUR_MWH',
        },
        { emitEvent: false },
      );
      components.push(componentGroup);
    }
  }

  private disableIdentityControls(): void {
    this.form.controls.familyCode.disable({ emitEvent: false });
    this.form.controls.commercializerId.disable({ emitEvent: false });
    this.form.controls.productType.disable({ emitEvent: false });
  }

  private enableIdentityControls(): void {
    this.form.controls.familyCode.enable({ emitEvent: false });
    this.form.controls.commercializerId.enable({ emitEvent: false });
    this.form.controls.productType.enable({ emitEvent: false });
  }

  private resolveCompanyFormId(commercializerId: string): string {
    const company = this.companies.find(
      (item) => item.id === commercializerId || item.domainId === commercializerId,
    );

    return company?.id ?? commercializerId;
  }

  private toDateInputValue(value?: string | null): string {
    if (!value) {
      return '';
    }

    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    return match?.[1] ?? '';
  }

  private buildVersionPayload(): CreateSimulationCalculationProfileVersionRequest {
    const raw = this.form.getRawValue();
    const payload: CreateSimulationCalculationProfileVersionRequest = {
      commissionMode: raw.commissionMode as SimulationCommissionMode,
      active: raw.active ?? true,
      effectiveFrom: this.normalizeOptionalString(raw.effectiveFrom) ?? null,
      effectiveTo: this.normalizeOptionalString(raw.effectiveTo) ?? null,
      includedComponents: this.buildIncludedComponents(),
    };

    if (this.usesElectricity) {
      payload.electricity = this.buildEnergyConfig('electricity');
    }

    if (this.usesGas) {
      payload.gas = this.buildEnergyConfig('gas');
    }

    return payload;
  }

  private buildPayload(): CreateSimulationCalculationProfileRequest {
    const raw = this.form.getRawValue();
    const payload: CreateSimulationCalculationProfileRequest = {
      familyCode: (raw.familyCode ?? '').trim(),
      commercializerId: raw.commercializerId ?? '',
      productType: raw.productType as ProductType,
      commissionMode: raw.commissionMode as SimulationCommissionMode,
      active: raw.active ?? true,
      includedComponents: this.buildIncludedComponents(),
    };

    const effectiveFrom = this.normalizeOptionalString(raw.effectiveFrom);
    const effectiveTo = this.normalizeOptionalString(raw.effectiveTo);

    if (effectiveFrom) {
      payload.effectiveFrom = effectiveFrom;
    }

    if (effectiveTo) {
      payload.effectiveTo = effectiveTo;
    }

    if (this.usesElectricity) {
      payload.electricity = this.buildEnergyConfig('electricity');
    }

    if (this.usesGas) {
      payload.gas = this.buildEnergyConfig('gas');
    }

    return payload;
  }

  private buildIncludedComponents(): SimulationCalculationProfileIncludedComponents {
    const raw = this.form.controls.includedComponents.getRawValue();
    const included: SimulationCalculationProfileIncludedComponents = {
      networkAccessEnergy: raw.networkAccessEnergy ?? false,
      losses: raw.losses ?? false,
      guaranteesOfOrigin: raw.guaranteesOfOrigin ?? false,
      socialTariffFinancing: raw.socialTariffFinancing ?? false,
    };

    if (this.usesElectricity) {
      included.networkAccessPower = raw.networkAccessPower ?? false;
      included.renSystemCosts = raw.renSystemCosts ?? false;
      included.mfrr = raw.mfrr ?? false;
    }

    if (this.usesGas) {
      included.networkAccessFixedTerm = raw.networkAccessFixedTerm ?? false;
    }

    return included;
  }

  private reconcileIncludedComponentSources(): void {
    const lossesIncluded = this.areLossesIncluded;

    for (const group of [this.electricityGroup, this.gasGroup]) {
      const lossControl = group.get('lossSource');
      if (lossesIncluded) {
        lossControl?.setValue('', { emitEvent: false });
        lossControl?.disable({ emitEvent: false });
      } else {
        lossControl?.enable({ emitEvent: false });
      }
    }

    for (const energy of ['electricity', 'gas'] as const) {
      for (const control of this.getComponents(energy).controls) {
        const lossControl = control.get('lossSource');
        if (lossesIncluded) {
          lossControl?.setValue('', { emitEvent: false });
          lossControl?.disable({ emitEvent: false });
        } else {
          lossControl?.enable({ emitEvent: false });
        }
      }
    }

    if (this.areRenSystemCostsIncluded) {
      const electricitySystemCost = this.electricityGroup.get('systemCostSource');
      if (electricitySystemCost?.value === 'ren_erc') {
        electricitySystemCost.setValue('', { emitEvent: false });
      }

      for (const control of this.electricityComponents.controls) {
        const systemCostControl = control.get('systemCostSource');
        if (systemCostControl?.value === 'ren_erc') {
          systemCostControl.setValue('', { emitEvent: false });
        }
      }
    }
  }

  private validateIncludedComponentSources(): boolean {
    if (this.areLossesIncluded && this.hasConfiguredLossSource()) {
      this.toast.error(
        'As perdas já estão incluídas no preço. Remove a fonte de perdas explícita antes de continuar.',
      );
      return false;
    }

    if (this.areRenSystemCostsIncluded && this.hasRenErcSystemCostSource()) {
      this.toast.error(
        'REN/ERC já está incluído no preço. Remove a fonte REN/ERC explícita antes de continuar.',
      );
      return false;
    }

    return true;
  }

  private hasConfiguredLossSource(): boolean {
    const groups = [this.electricityGroup, this.gasGroup];

    if (groups.some((group) => !!group.getRawValue().lossSource)) {
      return true;
    }

    return (['electricity', 'gas'] as const).some((energy) =>
      this.getComponents(energy).controls.some((control) => !!control.getRawValue().lossSource),
    );
  }

  private hasRenErcSystemCostSource(): boolean {
    if (this.electricityGroup.getRawValue().systemCostSource === 'ren_erc') {
      return true;
    }

    return this.electricityComponents.controls.some(
      (control) => control.getRawValue().systemCostSource === 'ren_erc',
    );
  }

  private buildEnergyConfig(energy: EnergyKind): SimulationCalculationProfileEnergyConfig {
    const group = this.getEnergyGroup(energy);
    const raw = group.getRawValue();
    const config: SimulationCalculationProfileEnergyConfig = {
      strategy: raw.strategy as SimulationCalculationStrategy,
    };

    this.assignOptional(config, 'marketSource', raw.marketSource);
    this.assignOptional(config, 'marketReference', raw.marketReference);
    if (!(this.areRenSystemCostsIncluded && raw.systemCostSource === 'ren_erc')) {
      this.assignOptional(config, 'systemCostSource', raw.systemCostSource);
    }

    if (!this.areLossesIncluded) {
      this.assignOptional(config, 'lossSource', raw.lossSource);
    }
    this.assignOptional(config, 'networkAccessMode', raw.networkAccessMode);

    const margin = this.buildMargin(raw.marginKind, raw.marginValue, raw.marginUnit);
    if (margin) {
      config.margin = margin;
    }

    if (raw.strategy === 'weighted_mix') {
      config.components = this.getComponents(energy).controls.map((control) =>
        this.buildWeightedComponent(control as FormGroup),
      );
    }

    return config;
  }

  private buildWeightedComponent(group: FormGroup): SimulationWeightedComponent {
    const raw = group.getRawValue();
    const component: SimulationWeightedComponent = {
      code: (raw.code ?? '').trim(),
      weight: Number(raw.weight),
      strategy: raw.strategy as SimulationCalculationStrategy,
    };

    this.assignOptional(component, 'marketSource', raw.marketSource);
    this.assignOptional(component, 'marketReference', raw.marketReference);
    if (!(this.areRenSystemCostsIncluded && raw.systemCostSource === 'ren_erc')) {
      this.assignOptional(component, 'systemCostSource', raw.systemCostSource);
    }

    if (!this.areLossesIncluded) {
      this.assignOptional(component, 'lossSource', raw.lossSource);
    }
    this.assignOptional(component, 'networkAccessMode', raw.networkAccessMode);

    const margin = this.buildMargin(raw.marginKind, raw.marginValue, raw.marginUnit);
    if (margin) {
      component.margin = margin;
    }

    return component;
  }

  private buildMargin(
    kind: unknown,
    value: unknown,
    unit: unknown,
  ): { kind: SimulationMarginKind; value: number; unit: SimulationMarginUnit } | null {
    if (!kind && (value === null || value === undefined || value === '')) {
      return null;
    }

    if (!kind || value === null || value === undefined || value === '' || !unit) {
      return null;
    }

    return {
      kind: kind as SimulationMarginKind,
      value: Number(value),
      unit: unit as SimulationMarginUnit,
    };
  }

  private validateOptionalMargins(energy: EnergyKind): boolean {
    const active = energy === 'electricity' ? this.usesElectricity : this.usesGas;

    if (!active) {
      return true;
    }

    const group = this.getEnergyGroup(energy);
    const kind = group.get('marginKind')?.value;
    const value = group.get('marginValue')?.value;

    if (
      (kind && (value === null || value === undefined || value === '')) ||
      (!kind && value !== null && value !== undefined && value !== '')
    ) {
      this.toast.error(
        `Preenche o tipo e o valor da margem de ${energy === 'electricity' ? 'eletricidade' : 'gás'}, ou deixa ambos vazios.`,
      );
      return false;
    }

    for (const control of this.getComponents(energy).controls) {
      const componentKind = control.get('marginKind')?.value;
      const componentValue = control.get('marginValue')?.value;

      if (
        (componentKind &&
          (componentValue === null || componentValue === undefined || componentValue === '')) ||
        (!componentKind &&
          componentValue !== null &&
          componentValue !== undefined &&
          componentValue !== '')
      ) {
        this.toast.error(
          'Nos componentes do mix, o tipo e o valor da margem devem ser preenchidos em conjunto.',
        );
        return false;
      }
    }

    return true;
  }

  private validateWeightedMix(energy: EnergyKind): boolean {
    const active = energy === 'electricity' ? this.usesElectricity : this.usesGas;

    if (!active || !this.isWeightedMix(energy)) {
      return true;
    }

    const components = this.getComponents(energy);

    if (components.length < 2) {
      this.toast.error(
        `O mix ponderado de ${energy === 'electricity' ? 'eletricidade' : 'gás'} exige pelo menos 2 componentes.`,
      );
      return false;
    }

    components.markAllAsTouched();
    if (components.invalid) {
      this.toast.error('Revê os componentes do mix ponderado.');
      return false;
    }

    const codes = components.controls.map((control) =>
      String(control.get('code')?.value ?? '')
        .trim()
        .toLocaleLowerCase('pt-PT'),
    );

    if (new Set(codes).size !== codes.length) {
      this.toast.error('Os códigos dos componentes do mix ponderado não podem repetir-se.');
      return false;
    }

    const totalWeight = components.controls.reduce(
      (sum, control) => sum + Number(control.get('weight')?.value ?? 0),
      0,
    );

    if (Math.abs(totalWeight - 1) > 0.000001) {
      this.toast.error('Os pesos do mix ponderado têm de somar 1.');
      return false;
    }

    return true;
  }

  private assignOptional<T extends object, K extends keyof T>(
    target: T,
    key: K,
    value: unknown,
  ): void {
    if (value !== null && value !== undefined && value !== '') {
      target[key] = value as T[K];
    }
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return normalized || undefined;
  }

  private trimmedRequiredValidator(control: AbstractControl): ValidationErrors | null {
    return typeof control.value === 'string' && control.value.trim().length > 0
      ? null
      : { required: true };
  }

  private effectiveDateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const start = control.get('effectiveFrom')?.value;
    const end = control.get('effectiveTo')?.value;

    if (!start || !end) {
      return null;
    }

    return String(end) >= String(start) ? null : { effectiveDateRange: true };
  }
}
