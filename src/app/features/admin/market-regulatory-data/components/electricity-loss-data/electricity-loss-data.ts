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
  ElectricityLossProfile,
  ElectricityLossProfileFilters,
  MarketRegulatoryPagination,
} from '../../../../../core/models/market-regulatory-data.model';
import { MarketRegulatoryDataService } from '../../../../../core/services/market-regulatory-data';
import { ToastService } from '../../../../../core/services/toast';

type ActiveFilter = '' | 'true' | 'false';

interface ElectricityLossDraftFilters {
  active: ActiveFilter;
  source: string;
  versionLabel: string;
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-electricity-loss-data',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './electricity-loss-data.html',
  styleUrl: '../regulatory-dataset.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ElectricityLossData implements OnInit {
  private readonly service = inject(MarketRegulatoryDataService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly pageSize = 50;

  draftFilters: ElectricityLossDraftFilters = this.createEmptyFilters();
  items: ElectricityLossProfile[] = [];
  pagination: MarketRegulatoryPagination | null = null;
  expandedId: string | null = null;
  isLoading = false;
  isLoadingMore = false;
  loadErrorMessage = '';

  private appliedFilters: ElectricityLossProfileFilters = {};
  private nextOffset = 0;

  ngOnInit(): void {
    this.loadFirstPage();
  }

  applyFilters(): void {
    if (
      this.draftFilters.startDate &&
      this.draftFilters.endDate &&
      this.draftFilters.endDate <= this.draftFilters.startDate
    ) {
      this.toast.error('A data final exclusiva tem de ser posterior à data inicial.');
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

  toggleDetails(item: ElectricityLossProfile): void {
    this.expandedId = this.expandedId === item.id ? null : item.id;
  }

  onDetailsButtonClick(event: MouseEvent, item: ElectricityLossProfile): void {
    event.stopPropagation();
    this.toggleDetails(item);
  }

  onRowKeydown(event: KeyboardEvent, item: ElectricityLossProfile): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.toggleDetails(item);
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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Lisbon',
    }).format(date);
  }

  formatPercentage(value?: number | null): string {
    if (value === undefined || value === null || !Number.isFinite(Number(value))) {
      return '—';
    }

    return new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 5,
      maximumFractionDigits: 5,
    }).format(Number(value));
  }

  get loadedCount(): number {
    return this.items.length;
  }

  trackById(_index: number, item: ElectricityLossProfile): string {
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
      .getElectricityLossProfiles(offset, this.pageSize, this.appliedFilters)
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
            error.error?.message || 'Não foi possível carregar os perfis de perdas E-REDES.';

          if (!append) {
            this.loadErrorMessage = message;
          }

          this.toast.error(message);
        },
      });
  }

  private toApiFilters(filters: ElectricityLossDraftFilters): ElectricityLossProfileFilters {
    return {
      active: filters.active === '' ? undefined : filters.active === 'true',
      source: filters.source.trim() || undefined,
      versionLabel: filters.versionLabel.trim() || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    };
  }

  private createEmptyFilters(): ElectricityLossDraftFilters {
    return {
      active: '',
      source: '',
      versionLabel: '',
      startDate: '',
      endDate: '',
    };
  }
}
