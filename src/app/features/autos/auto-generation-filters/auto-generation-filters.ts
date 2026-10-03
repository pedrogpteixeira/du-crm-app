import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ELECTRICITY_POWERS } from '../../../core/constants/energy';
import {
  AUTO_COLUMNS_BY_PROVIDER,
  AutoMovementType,
  AutoProvider,
} from '../../../core/services/auto';
import { CampaignService } from '../../../core/services/campaign';
import { GALP_POWER_GAS_STATUSES } from '../../../core/services/galp-power-gas-contract';
import { GALP_SOLAR_STATUSES } from '../../../core/services/galp-solar-contract';
import { IBERDROLA_CONTRACT_STATUSES } from '../../../core/services/iberdrola-contract';
import { IBERDROLA_SOLAR_CONTRACT_STATUSES } from '../../../core/services/iberdrola-solar-contract';
import { MEO_ENERGIAS_CONTRACT_STATUSES } from '../../../core/services/meo-energias-contract';
import { REPSOL_CONTRACT_STATUSES } from '../../../core/services/repsol-contract';
import { Team, TeamService } from '../../../core/services/team';
import { WALLBOX_CONTRACT_STATUSES } from '../../../core/services/wallbox-contract';
import { YES_ENERGY_CONTRACT_STATUSES } from '../../../core/services/yes-energy-contract';
import {
  AutoItemFilters,
  cloneAutoItemFilters,
  countActiveAutoItemFilters,
  createEmptyAutoItemFilters,
} from '../auto-items-selection';

interface FilterOption {
  value: string;
  label: string;
}

type MultiSelectFilterKey =
  | 'states'
  | 'registrationNames'
  | 'campaigns'
  | 'tipoSegmentos'
  | 'productTypes'
  | 'calculationStatuses'
  | 'powerValues';

const ENERGY_SEGMENTS = ['Residencial', 'Empresarial', 'Condomínios'] as const;
const ENERGY_SEGMENTS_WITHOUT_CONDOMINIUM = ['Residencial', 'Empresarial'] as const;
const ENERGY_PRODUCTS = ['Luz', 'Luz + Gás', 'Gás'] as const;
const SOLAR_PRODUCTS = ['Painéis Solares'] as const;

const PROVIDER_COMPANY_NAMES: Readonly<Record<AutoProvider, string>> = {
  repsol: 'Repsol',
  'galp-power-gas': 'Galp Power & Gás',
  'galp-solar': 'Galp Solar',
  wallbox: 'Wallbox',
  iberdrola: 'Iberdrola',
  'iberdrola-solar': 'Iberdrola Solar',
  'yes-energy': 'Yes Energy',
  'meo-energias': 'Meo Energias',
};

const PROVIDER_STATES: Readonly<Record<AutoProvider, readonly string[]>> = {
  repsol: REPSOL_CONTRACT_STATUSES,
  'galp-power-gas': GALP_POWER_GAS_STATUSES,
  'galp-solar': GALP_SOLAR_STATUSES,
  wallbox: WALLBOX_CONTRACT_STATUSES,
  iberdrola: IBERDROLA_CONTRACT_STATUSES,
  'iberdrola-solar': IBERDROLA_SOLAR_CONTRACT_STATUSES,
  'yes-energy': YES_ENERGY_CONTRACT_STATUSES,
  'meo-energias': MEO_ENERGIAS_CONTRACT_STATUSES,
};

const PROVIDER_SEGMENTS: Readonly<Record<AutoProvider, readonly string[]>> = {
  repsol: ENERGY_SEGMENTS,
  'galp-power-gas': ENERGY_SEGMENTS,
  'galp-solar': ENERGY_SEGMENTS,
  wallbox: ENERGY_SEGMENTS_WITHOUT_CONDOMINIUM,
  iberdrola: ENERGY_SEGMENTS,
  'iberdrola-solar': ENERGY_SEGMENTS_WITHOUT_CONDOMINIUM,
  'yes-energy': ENERGY_SEGMENTS,
  'meo-energias': ENERGY_SEGMENTS_WITHOUT_CONDOMINIUM,
};

const PROVIDER_PRODUCTS: Readonly<Record<AutoProvider, readonly string[]>> = {
  repsol: ENERGY_PRODUCTS,
  'galp-power-gas': ENERGY_PRODUCTS,
  'galp-solar': SOLAR_PRODUCTS,
  wallbox: ENERGY_PRODUCTS,
  iberdrola: ENERGY_PRODUCTS,
  'iberdrola-solar': SOLAR_PRODUCTS,
  'yes-energy': ENERGY_PRODUCTS,
  'meo-energias': ENERGY_PRODUCTS,
};

const CALCULATION_STATUS_LABELS: Readonly<Record<string, string>> = {
  'chargeback-window-expired': 'Chargeback expirado',
  calculated: 'Calculado',
  settled: 'Já liquidado',
  'already-settled': 'Já liquidado',
  'no-movement': 'Sem movimento',
  'missing-team': 'Equipa em falta',
  'missing-commission': 'Comissão em falta',
  'missing-registration-code': 'Código de registo em falta',
  'unsupported-segment': 'Segmento não suportado',
  'unsupported-product': 'Produto não suportado',
};

const KNOWN_CALCULATION_STATUSES = ['chargeback-window-expired'] as const;

@Component({
  selector: 'app-auto-generation-filters',
  imports: [CommonModule, FormsModule],
  templateUrl: './auto-generation-filters.html',
  styleUrl: './auto-generation-filters.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoGenerationFilters implements OnInit, OnChanges {
  private readonly teamService = inject(TeamService);
  private readonly campaignService = inject(CampaignService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) provider!: AutoProvider;
  @Input() appliedFilters: AutoItemFilters = createEmptyAutoItemFilters();
  @Input() disabled = false;

  @Output() filtersApplied = new EventEmitter<AutoItemFilters>();

  showPanel = false;
  draftFilters = createEmptyAutoItemFilters();

  registrationNameOptions: FilterOption[] = [];
  campaignOptions: FilterOption[] = [];
  stateOptions: FilterOption[] = [];
  segmentOptions: FilterOption[] = [];
  productTypeOptions: FilterOption[] = [];
  calculationStatusOptions: FilterOption[] = [];
  powerOptions: FilterOption[] = [];

  isLoadingTeams = false;
  isLoadingCampaigns = false;

  readonly movementOptions: ReadonlyArray<{
    value: AutoMovementType;
    label: string;
  }> = [
    { value: 'payment', label: 'Pagamento' },
    { value: 'refund', label: 'Reembolso' },
    { value: 'zero', label: 'Sem movimento' },
  ];

  ngOnInit(): void {
    this.observeTeamsCache();
    this.ensureTeamsLoaded();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appliedFilters'] || changes['provider']) {
      this.resetDraftFromApplied();
      this.rebuildStaticOptions();
      this.registrationNameOptions = this.buildTeamOptions(
        this.teamService.getTeamsSnapshot(),
        this.appliedFilters.registrationNames,
      );
    }

    if (changes['provider'] && this.provider) {
      this.loadCampaignOptions();
    }
  }

  get activeFilterCount(): number {
    return countActiveAutoItemFilters(this.appliedFilters);
  }

  get supportsRegistrationName(): boolean {
    return this.columns.has('registrationName');
  }

  get supportsCampaign(): boolean {
    return this.columns.has('campaign');
  }

  get supportsState(): boolean {
    return this.columns.has('state');
  }

  get supportsSegment(): boolean {
    return this.columns.has('tipoSegmento');
  }

  get supportsPower(): boolean {
    return this.columns.has('power');
  }

  get supportsDirectDebit(): boolean {
    return this.columns.has('directDebit');
  }

  get supportsElectronicInvoice(): boolean {
    return this.columns.has('electronicInvoice');
  }

  get supportsSva(): boolean {
    return this.columns.has('sva');
  }

  get supportsPel(): boolean {
    return this.columns.has('PEL');
  }

  get supportsPelPlus(): boolean {
    return this.columns.has('PELPlus');
  }

  get supportsMgi(): boolean {
    return this.columns.has('MGI');
  }

  togglePanel(): void {
    if (this.disabled) {
      return;
    }

    this.showPanel = !this.showPanel;
    if (this.showPanel) {
      this.resetDraftFromApplied();
    }
  }

  apply(): void {
    if (this.disabled) {
      return;
    }

    this.normalizeNumbers();
    const normalized = cloneAutoItemFilters(this.draftFilters);
    this.filtersApplied.emit(normalized);
    this.showPanel = false;
  }

  clear(): void {
    if (this.disabled) {
      return;
    }

    const empty = createEmptyAutoItemFilters();
    this.draftFilters = cloneAutoItemFilters(empty);
    this.filtersApplied.emit(empty);
    this.showPanel = false;
  }

  isMovementSelected(value: AutoMovementType): boolean {
    return this.draftFilters.movementTypes.includes(value);
  }

  toggleMovement(value: AutoMovementType, checked: boolean): void {
    const values = new Set(this.draftFilters.movementTypes);

    if (checked) {
      values.add(value);
    } else {
      values.delete(value);
    }

    this.draftFilters.movementTypes = Array.from(values);
  }

  trackOption(_: number, option: FilterOption): string {
    return option.value;
  }

  isMultiValueSelected(key: MultiSelectFilterKey, value: string): boolean {
    return (this.draftFilters[key] as readonly string[]).includes(value);
  }

  toggleMultiValue(key: MultiSelectFilterKey, value: string, checked: boolean): void {
    const values = new Set(this.draftFilters[key] as readonly string[]);

    if (checked) {
      values.add(value);
    } else {
      values.delete(value);
    }

    this.assignMultiValues(key, Array.from(values));
  }

  clearDraftMultiFilter(key: MultiSelectFilterKey): void {
    this.assignMultiValues(key, []);
  }

  getMultiSelectLabel(key: MultiSelectFilterKey): string {
    const values = this.draftFilters[key] as readonly string[];

    if (!values.length) {
      return 'Todos';
    }

    if (values.length === 1) {
      return this.getOptionLabel(key, values[0]);
    }

    return `${values.length} selecionados`;
  }

  private get columns(): Set<string> {
    return new Set(AUTO_COLUMNS_BY_PROVIDER[this.provider] ?? []);
  }

  private resetDraftFromApplied(): void {
    this.draftFilters = cloneAutoItemFilters(this.appliedFilters);
  }

  private rebuildStaticOptions(): void {
    if (!this.provider) {
      return;
    }

    this.stateOptions = this.buildOptions(
      PROVIDER_STATES[this.provider],
      this.appliedFilters.states,
    );
    this.segmentOptions = this.buildOptions(
      PROVIDER_SEGMENTS[this.provider],
      this.appliedFilters.tipoSegmentos,
    );
    this.productTypeOptions = this.buildOptions(
      PROVIDER_PRODUCTS[this.provider],
      this.appliedFilters.productTypes,
    );
    this.powerOptions = this.buildOptions(
      ELECTRICITY_POWERS.map((power) => power.toFixed(2)),
      this.appliedFilters.powerValues,
    );

    const calculationStatuses = Array.from(
      new Set([
        ...KNOWN_CALCULATION_STATUSES,
        ...this.appliedFilters.calculationStatuses,
      ]),
    );

    this.calculationStatusOptions = calculationStatuses.map((value) => ({
      value,
      label: this.getCalculationStatusLabel(value),
    }));
  }

  private observeTeamsCache(): void {
    this.teamService.teamsState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.isLoadingTeams = state.loading && !state.loaded;
        this.registrationNameOptions = this.buildTeamOptions(
          state.teams,
          this.appliedFilters.registrationNames,
        );
        this.cdr.markForCheck();
      });
  }

  private ensureTeamsLoaded(): void {
    this.teamService.ensureTeamsLoaded().subscribe({
      error: () => {
        this.isLoadingTeams = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadCampaignOptions(): void {
    if (!this.supportsCampaign) {
      this.campaignOptions = [];
      this.isLoadingCampaigns = false;
      return;
    }

    const companyName = PROVIDER_COMPANY_NAMES[this.provider];
    const companyId = environment.companies.find(
      (company) => company.name === companyName,
    )?.id;

    if (!companyId) {
      this.campaignOptions = this.buildOptions([], this.appliedFilters.campaigns);
      this.isLoadingCampaigns = false;
      return;
    }

    const requestedProvider = this.provider;
    this.isLoadingCampaigns = true;
    this.campaignService
      .getCampaignsByCompanyId(companyId)
      .pipe(
        finalize(() => {
          this.isLoadingCampaigns = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (campaigns) => {
          if (this.provider !== requestedProvider) {
            return;
          }

          this.campaignOptions = this.buildOptions(
            campaigns.map((campaign) => campaign.name),
            this.appliedFilters.campaigns,
          );
          this.cdr.markForCheck();
        },
        error: () => {
          if (this.provider === requestedProvider) {
            this.campaignOptions = this.buildOptions([], this.appliedFilters.campaigns);
          }
        },
      });
  }

  private buildTeamOptions(teams: readonly Team[], selected: readonly string[]): FilterOption[] {
    const byName = new Map<string, FilterOption>();

    for (const team of teams) {
      const name = team.name?.trim();
      if (!name) {
        continue;
      }

      byName.set(name, {
        value: name,
        label: team.active ? name : `${name} (inativa)`,
      });
    }

    for (const value of selected) {
      if (value && !byName.has(value)) {
        byName.set(value, { value, label: value });
      }
    }

    return Array.from(byName.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'pt-PT', { sensitivity: 'base' }),
    );
  }

  private buildOptions(values: readonly string[], selected: readonly string[]): FilterOption[] {
    return Array.from(new Set([...values, ...selected].map((value) => value.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-PT', { sensitivity: 'base' }))
      .map((value) => ({ value, label: value }));
  }

  private getOptionLabel(key: MultiSelectFilterKey, value: string): string {
    const option = this.getOptionsForKey(key).find((entry) => entry.value === value);
    return option?.label ?? (key === 'calculationStatuses' ? this.getCalculationStatusLabel(value) : value);
  }

  private getOptionsForKey(key: MultiSelectFilterKey): readonly FilterOption[] {
    switch (key) {
      case 'states':
        return this.stateOptions;
      case 'registrationNames':
        return this.registrationNameOptions;
      case 'campaigns':
        return this.campaignOptions;
      case 'tipoSegmentos':
        return this.segmentOptions;
      case 'productTypes':
        return this.productTypeOptions;
      case 'calculationStatuses':
        return this.calculationStatusOptions;
      case 'powerValues':
        return this.powerOptions;
    }
  }

  private assignMultiValues(key: MultiSelectFilterKey, values: string[]): void {
    switch (key) {
      case 'states':
        this.draftFilters.states = values;
        break;
      case 'registrationNames':
        this.draftFilters.registrationNames = values;
        break;
      case 'campaigns':
        this.draftFilters.campaigns = values;
        break;
      case 'tipoSegmentos':
        this.draftFilters.tipoSegmentos = values;
        break;
      case 'productTypes':
        this.draftFilters.productTypes = values;
        break;
      case 'calculationStatuses':
        this.draftFilters.calculationStatuses = values;
        break;
      case 'powerValues':
        this.draftFilters.powerValues = values;
        break;
    }
  }

  private getCalculationStatusLabel(value: string): string {
    return CALCULATION_STATUS_LABELS[value] ?? `Estado: ${value}`;
  }

  private normalizeNumbers(): void {
    this.draftFilters.commissionMin = this.normalizeNumber(this.draftFilters.commissionMin);
    this.draftFilters.commissionMax = this.normalizeNumber(this.draftFilters.commissionMax);
    this.draftFilters.previousSettledMin = this.normalizeNumber(this.draftFilters.previousSettledMin);
    this.draftFilters.previousSettledMax = this.normalizeNumber(this.draftFilters.previousSettledMax);
  }

  private normalizeNumber(value: number | null): number | null {
    if (value === null || value === undefined || value === ('' as unknown as number)) {
      return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
}
