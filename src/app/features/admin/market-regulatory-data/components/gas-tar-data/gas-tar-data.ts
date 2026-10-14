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
  GasNetworkAccessFilters,
  GasNetworkAccessRate,
  MarketRegulatoryPagination,
} from '../../../../../core/models/market-regulatory-data.model';
import { MarketRegulatoryDataService } from '../../../../../core/services/market-regulatory-data';
import { ToastService } from '../../../../../core/services/toast';

type ActiveFilter = '' | 'true' | 'false';

interface GasTarDraftFilters {
  active: ActiveFilter;
  gasTier: string;
  source: string;
  versionLabel: string;
  effectiveFromGte: string;
  effectiveFromLte: string;
}

@Component({
  selector: 'app-gas-tar-data',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gas-tar-data.html',
  styleUrl: '../regulatory-dataset.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GasTarData implements OnInit {
  private readonly service = inject(MarketRegulatoryDataService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly pageSize = 50;

  draftFilters: GasTarDraftFilters = this.createEmptyFilters();
  items: GasNetworkAccessRate[] = [];
  pagination: MarketRegulatoryPagination | null = null;
  expandedId: string | null = null;
  isLoading = false;
  isLoadingMore = false;
  loadErrorMessage = '';

  private appliedFilters: GasNetworkAccessFilters = {};
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

    const gasTier = this.draftFilters.gasTier.trim();

    if (gasTier && (!Number.isInteger(Number(gasTier)) || Number(gasTier) < 1)) {
      this.toast.error('O escalão de gás tem de ser um número inteiro válido.');
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

  toggleDetails(item: GasNetworkAccessRate): void {
    this.expandedId = this.expandedId === item.id ? null : item.id;
  }

  onDetailsButtonClick(event: MouseEvent, item: GasNetworkAccessRate): void {
    event.stopPropagation();
    this.toggleDetails(item);
  }

  onRowKeydown(event: KeyboardEvent, item: GasNetworkAccessRate): void {
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

  get loadedCount(): number {
    return this.items.length;
  }

  trackById(_index: number, item: GasNetworkAccessRate): string {
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
      .getGasNetworkAccess(offset, this.pageSize, this.appliedFilters)
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
          const message = error.error?.message || 'Não foi possível carregar a TAR de gás.';

          if (!append) {
            this.loadErrorMessage = message;
          }

          this.toast.error(message);
        },
      });
  }

  private toApiFilters(filters: GasTarDraftFilters): GasNetworkAccessFilters {
    const gasTier = filters.gasTier.trim();

    return {
      active: filters.active === '' ? undefined : filters.active === 'true',
      gasTier: gasTier ? Number(gasTier) : undefined,
      source: filters.source.trim() || undefined,
      versionLabel: filters.versionLabel.trim() || undefined,
      effectiveFromGte: filters.effectiveFromGte || undefined,
      effectiveFromLte: filters.effectiveFromLte || undefined,
    };
  }

  private createEmptyFilters(): GasTarDraftFilters {
    return {
      active: '',
      gasTier: '',
      source: '',
      versionLabel: '',
      effectiveFromGte: '',
      effectiveFromLte: '',
    };
  }
}
