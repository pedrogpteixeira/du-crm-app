import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  ElectricityNetworkAccessFilters,
  ElectricityNetworkAccessRate,
  MarketRegulatoryPagination,
} from '../../../../../core/models/market-regulatory-data.model';
import { MarketRegulatoryDataService } from '../../../../../core/services/market-regulatory-data';
import { ToastService } from '../../../../../core/services/toast';

type ActiveFilter = '' | 'true' | 'false';

interface ElectricityTarDraftFilters {
  active: ActiveFilter;
  voltageLevel: string;
  customerClass: string;
  tariffType: string;
  chargeType: string;
  tariffPeriod: string;
  source: string;
  versionLabel: string;
  effectiveFromGte: string;
  effectiveFromLte: string;
}

const CUSTOMER_CLASS_LABELS: Readonly<Record<string, string>> = {
  standard: 'Padrão',
  public_lighting: 'Iluminação pública',
};

const TARIFF_TYPE_LABELS: Readonly<Record<string, string>> = {
  simple: 'Simples',
  bi_hourly: 'Bi-horária',
  tri_hourly: 'Tri-horária',
  tetra_hourly: 'Tetra-horária',
};

const CHARGE_TYPE_LABELS: Readonly<Record<string, string>> = {
  active_energy: 'Energia ativa',
  contracted_power: 'Potência contratada',
  peak_power: 'Potência em horas de ponta',
  reactive_inductive: 'Energia reativa indutiva',
  reactive_capacitive: 'Energia reativa capacitiva',
};

const TARIFF_PERIOD_LABELS: Readonly<Record<string, string>> = {
  simple: 'Simples',
  foraVazio: 'Fora de vazio',
  ponta: 'Ponta',
  cheias: 'Cheias',
  vazio: 'Vazio',
  superVazio: 'Super vazio',
};

const UNIT_LABELS: Readonly<Record<string, string>> = {
  EUR_DAY: '€/dia',
  EUR_KWH: '€/kWh',
  EUR_KW_DAY: '€/kW/dia',
  EUR_KVARH: '€/kVArh',
};

@Component({
  selector: 'app-electricity-tar-data',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './electricity-tar-data.html',
  styleUrl: '../regulatory-dataset.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ElectricityTarData implements OnInit {
  private readonly service = inject(MarketRegulatoryDataService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly pageSize = 50;

  readonly customerClassOptions = Object.entries(CUSTOMER_CLASS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  readonly tariffTypeOptions = Object.entries(TARIFF_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  readonly chargeTypeOptions = Object.entries(CHARGE_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  readonly tariffPeriodOptions = Object.entries(TARIFF_PERIOD_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  draftFilters: ElectricityTarDraftFilters = this.createEmptyFilters();
  items: ElectricityNetworkAccessRate[] = [];
  pagination: MarketRegulatoryPagination | null = null;
  expandedId: string | null = null;
  isLoading = false;
  isLoadingMore = false;
  loadErrorMessage = '';

  private appliedFilters: ElectricityNetworkAccessFilters = {};
  private nextOffset = 0;

  ngOnInit(): void {
    this.loadFirstPage();
  }

  applyFilters(): void {
    if (
      this.draftFilters.effectiveFromGte &&
      this.draftFilters.effectiveFromLte &&
      this.draftFilters.effectiveFromLte < this.draftFilters.effectiveFromGte
    ) {
      this.toast.error('A data final de vigência não pode ser anterior à data inicial.');
      return;
    }

    this.appliedFilters = this.toApiFilters(this.draftFilters);
    this.loadFirstPage();
  }

  clearFilters(): void {
    this.draftFilters = this.createEmptyFilters();
  }

  refresh(): void {
    this.loadFirstPage();
  }

  loadMore(): void {
    if (!this.pagination?.hasMore || this.isLoading || this.isLoadingMore) {
      return;
    }

    this.fetchPage(this.nextOffset, true);
  }

  toggleDetails(item: ElectricityNetworkAccessRate): void {
    this.expandedId = this.expandedId === item.id ? null : item.id;
  }

  onDetailsButtonClick(event: MouseEvent, item: ElectricityNetworkAccessRate): void {
    event.stopPropagation();
    this.toggleDetails(item);
  }

  onRowKeydown(event: KeyboardEvent, item: ElectricityNetworkAccessRate): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.toggleDetails(item);
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return '—';
    }

    const civilDate = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (civilDate) {
      return `${civilDate[3]}/${civilDate[2]}/${civilDate[1]}`;
    }

    return this.formatDateTime(value);
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Lisbon',
    }).format(date);
  }

  formatNumber(value?: number | null, maximumFractionDigits = 6): string {
    if (value === undefined || value === null || !Number.isFinite(Number(value))) {
      return '—';
    }

    return new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }).format(Number(value));
  }

  getCustomerClassLabel(value?: string | null): string {
    return this.getTranslatedLabel(value, CUSTOMER_CLASS_LABELS);
  }

  getTariffTypeLabel(value?: string | null): string {
    return this.getTranslatedLabel(value, TARIFF_TYPE_LABELS);
  }

  getChargeTypeLabel(value?: string | null): string {
    return this.getTranslatedLabel(value, CHARGE_TYPE_LABELS);
  }

  getTariffPeriodLabel(value?: string | null): string {
    return this.getTranslatedLabel(value, TARIFF_PERIOD_LABELS);
  }

  getUnitLabel(value?: string | null): string {
    return this.getTranslatedLabel(value, UNIT_LABELS);
  }

  get loadedCount(): number {
    return this.items.length;
  }

  trackById(_index: number, item: ElectricityNetworkAccessRate): string {
    return item.id;
  }

  private loadFirstPage(): void {
    this.items = [];
    this.pagination = null;
    this.nextOffset = 0;
    this.expandedId = null;
    this.fetchPage(0, false);
  }

  private fetchPage(offset: number, append: boolean): void {
    if (append) {
      this.isLoadingMore = true;
    } else {
      this.isLoading = true;
    }

    this.loadErrorMessage = '';

    this.service
      .getElectricityNetworkAccess(offset, this.pageSize, this.appliedFilters)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.isLoadingMore = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.items = append ? [...this.items, ...response.items] : response.items;
          this.pagination = response.pagination;
          this.nextOffset = response.pagination.offset + response.items.length;
        },
        error: (error: HttpErrorResponse) => {
          const message =
            error.error?.message || 'Não foi possível carregar a TAR de eletricidade.';

          if (!append) {
            this.loadErrorMessage = message;
          }

          this.toast.error(message);
        },
      });
  }

  private toApiFilters(filters: ElectricityTarDraftFilters): ElectricityNetworkAccessFilters {
    return {
      active: filters.active === '' ? undefined : filters.active === 'true',
      voltageLevel: filters.voltageLevel.trim() || undefined,
      customerClass: filters.customerClass.trim() || undefined,
      tariffType: filters.tariffType.trim() || undefined,
      chargeType: filters.chargeType.trim() || undefined,
      tariffPeriod: filters.tariffPeriod.trim() || undefined,
      source: filters.source.trim() || undefined,
      versionLabel: filters.versionLabel.trim() || undefined,
      effectiveFromGte: filters.effectiveFromGte || undefined,
      effectiveFromLte: filters.effectiveFromLte || undefined,
    };
  }

  private createEmptyFilters(): ElectricityTarDraftFilters {
    return {
      active: '',
      voltageLevel: '',
      customerClass: '',
      tariffType: '',
      chargeType: '',
      tariffPeriod: '',
      source: '',
      versionLabel: '',
      effectiveFromGte: '',
      effectiveFromLte: '',
    };
  }

  private getTranslatedLabel(
    value: string | null | undefined,
    labels: Readonly<Record<string, string>>,
  ): string {
    if (!value) {
      return '—';
    }

    return labels[value] ?? value;
  }
}
