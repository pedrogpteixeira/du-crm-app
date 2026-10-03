import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  AUTO_COLUMNS_BY_PROVIDER,
  AutoItem,
  AutoMovementType,
  AutoProvider,
} from '../../../core/services/auto';
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

type FilterKey = keyof AutoItemFilters;
type MultiSelectFilterKey =
  | 'states'
  | 'registrationNames'
  | 'campaigns'
  | 'tipoSegmentos'
  | 'movementTypes'
  | 'powerValues';

@Component({
  selector: 'app-auto-items-filters',
  imports: [CommonModule, FormsModule],
  templateUrl: './auto-items-filters.html',
  styleUrl: './auto-items-filters.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoItemsFilters implements OnChanges {
  @Input({ required: true }) provider!: AutoProvider;
  @Input() items: readonly AutoItem[] = [];
  @Input() totalItems = 0;
  @Input() allItemsLoaded = false;
  @Input() loadingAll = false;
  @Input() disabled = false;
  @Input() appliedFilters: AutoItemFilters = createEmptyAutoItemFilters();

  @Output() filtersApplied = new EventEmitter<AutoItemFilters>();
  @Output() loadAllRequested = new EventEmitter<void>();

  showPanel = false;
  draftFilters = createEmptyAutoItemFilters();

  registrationNameOptions: FilterOption[] = [];
  campaignOptions: FilterOption[] = [];
  stateOptions: FilterOption[] = [];
  segmentOptions: FilterOption[] = [];
  powerOptions: FilterOption[] = [];

  hasRegistrationName = false;
  hasCampaign = false;
  hasState = false;
  hasSegment = false;
  hasDirectDebit = false;
  hasElectronicInvoice = false;
  hasSva = false;
  hasPel = false;
  hasPelPlus = false;
  hasMgi = false;
  hasPower = false;
  hasPreviousSettled = false;
  hasDiagnostic = false;
  hasSignatureDate = false;

  readonly movementOptions: ReadonlyArray<{
    value: AutoMovementType;
    label: string;
  }> = [
    { value: 'payment', label: 'Pagamento' },
    { value: 'refund', label: 'Reembolso' },
    { value: 'zero', label: 'Sem movimento' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appliedFilters']) {
      this.draftFilters = cloneAutoItemFilters(this.appliedFilters);
    }

    if (changes['items'] || changes['provider']) {
      this.rebuildOptions();
    }
  }

  get activeFilterCount(): number {
    return countActiveAutoItemFilters(this.appliedFilters);
  }

  togglePanel(): void {
    if (this.disabled) {
      return;
    }

    this.showPanel = !this.showPanel;
    if (this.showPanel) {
      this.draftFilters = cloneAutoItemFilters(this.appliedFilters);
    }
  }

  closePanel(): void {
    this.showPanel = false;
    this.draftFilters = cloneAutoItemFilters(this.appliedFilters);
  }

  apply(): void {
    if (this.disabled) {
      return;
    }

    const normalized = this.normalizeDraftFilters();
    this.draftFilters = cloneAutoItemFilters(normalized);
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

  removeFilter(key: FilterKey): void {
    if (this.disabled) {
      return;
    }

    const next = cloneAutoItemFilters(this.appliedFilters);
    this.clearFilterKey(next, key);
    this.draftFilters = cloneAutoItemFilters(next);
    this.filtersApplied.emit(next);
  }

  removeFilters(keys: FilterKey[]): void {
    if (this.disabled) {
      return;
    }

    const next = cloneAutoItemFilters(this.appliedFilters);
    for (const key of keys) {
      this.clearFilterKey(next, key);
    }

    this.draftFilters = cloneAutoItemFilters(next);
    this.filtersApplied.emit(next);
  }

  requestLoadAll(): void {
    if (!this.disabled && !this.loadingAll && !this.allItemsLoaded) {
      this.loadAllRequested.emit();
    }
  }

  trackOption(_: number, option: FilterOption): string {
    return option.value;
  }

  isMultiValueSelected(key: MultiSelectFilterKey, value: string): boolean {
    return (this.draftFilters[key] as readonly string[]).includes(value);
  }

  toggleMultiValue(key: MultiSelectFilterKey, value: string, checked: boolean): void {
    const nextValues = new Set(this.draftFilters[key] as readonly string[]);

    if (checked) {
      nextValues.add(value);
    } else {
      nextValues.delete(value);
    }

    this.assignMultiValues(key, Array.from(nextValues));
  }

  clearDraftMultiFilter(key: MultiSelectFilterKey): void {
    this.assignMultiValues(key, []);
  }

  getMultiSelectLabel(key: MultiSelectFilterKey): string {
    const values = this.draftFilters[key] as readonly string[];

    if (values.length === 0) {
      return 'Todos';
    }

    if (values.length === 1) {
      return values[0];
    }

    return `${values.length} selecionados`;
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
      case 'movementTypes':
        this.draftFilters.movementTypes = values as AutoMovementType[];
        break;
      case 'powerValues':
        this.draftFilters.powerValues = values;
        break;
    }
  }

  private clearFilterKey(filters: AutoItemFilters, key: FilterKey): void {
    switch (key) {
      case 'search':
      case 'signatureDateFrom':
      case 'signatureDateTo':
        filters[key] = '';
        break;
      case 'commissionMin':
      case 'commissionMax':
      case 'previousSettledMin':
      case 'previousSettledMax':
        filters[key] = null;
        break;
      case 'directDebit':
      case 'electronicInvoice':
      case 'sva':
      case 'pel':
      case 'pelPlus':
      case 'mgi':
        filters[key] = 'all';
        break;
      case 'diagnostic':
        filters.diagnostic = 'all';
        break;
      default:
        (filters[key] as unknown[]) = [];
    }
  }

  private rebuildOptions(): void {
    const columns = new Set(AUTO_COLUMNS_BY_PROVIDER[this.provider] ?? []);
    this.registrationNameOptions = this.buildStringOptions(
      this.items.map((item) => item.registrationName),
    );
    this.campaignOptions = this.buildStringOptions(
      this.items.map((item) => item.campaign),
    );
    this.stateOptions = this.buildStringOptions(
      this.items.map((item) => item.state),
    );
    this.segmentOptions = this.buildStringOptions(
      this.items.map((item) => item.tipoSegmento),
    );
    this.powerOptions = this.buildStringOptions(
      this.items.map((item) => String(item.power ?? '').trim()),
    );

    this.hasRegistrationName = columns.has('registrationName') && this.registrationNameOptions.length > 0;
    this.hasCampaign = columns.has('campaign') && this.campaignOptions.length > 0;
    this.hasState = columns.has('state') && this.stateOptions.length > 0;
    this.hasSegment = columns.has('tipoSegmento') && this.segmentOptions.length > 0;
    this.hasDirectDebit = columns.has('directDebit') && this.items.some((item) => item.directDebit !== undefined);
    this.hasElectronicInvoice = columns.has('electronicInvoice') && this.items.some((item) => item.electronicInvoice !== undefined);
    this.hasSva = columns.has('sva') && this.items.some((item) => item.sva !== undefined && item.sva !== null);
    this.hasPel = columns.has('PEL') && this.items.some((item) => item.PEL !== undefined);
    this.hasPelPlus = columns.has('PELPlus') && this.items.some((item) => item.PELPlus !== undefined);
    this.hasMgi = columns.has('MGI') && this.items.some((item) => item.MGI !== undefined);
    this.hasPower = columns.has('power') && this.powerOptions.length > 0;
    this.hasPreviousSettled = this.items.some((item) => item.previousSettledAmount !== undefined);
    this.hasDiagnostic = this.items.some((item) => item.diagnostic !== undefined);
    this.hasSignatureDate = columns.has('signatureDate') && this.items.some((item) => Boolean(item.signatureDate));
  }

  private buildStringOptions(values: readonly (string | null | undefined)[]): FilterOption[] {
    return Array.from(
      new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)),
    )
      .sort((a, b) => a.localeCompare(b, 'pt-PT', { numeric: true }))
      .map((value) => ({ value, label: value }));
  }

  private normalizeDraftFilters(): AutoItemFilters {
    const next = cloneAutoItemFilters(this.draftFilters);
    next.search = next.search.trim();
    next.commissionMin = this.normalizeNumber(next.commissionMin);
    next.commissionMax = this.normalizeNumber(next.commissionMax);
    next.previousSettledMin = this.normalizeNumber(next.previousSettledMin);
    next.previousSettledMax = this.normalizeNumber(next.previousSettledMax);
    return next;
  }

  private normalizeNumber(value: number | null): number | null {
    if (value === null || value === undefined || value === ('' as unknown as number)) {
      return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
}
