import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import {
  RenErc,
  RenErcComponentCode,
  RenErcReference,
} from '../../../core/models/ren-erc.model';
import { RenErcService } from '../../../core/services/ren-erc';
import { ToastService } from '../../../core/services/toast';

interface RenErcFilterForm {
  startDate: FormControl<string>;
  endDate: FormControl<string>;
}

@Component({
  selector: 'app-ren-erc-values',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ren-erc-values.html',
  styleUrl: './ren-erc-values.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenErcValues {
  private readonly renErcService = inject(RenErcService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly filterForm = new FormGroup<RenErcFilterForm>({
    startDate: new FormControl(this.getPortugalDate(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    endDate: new FormControl(this.getPortugalDate(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  records: RenErc[] = [];
  reference: RenErcReference | null = null;
  expandedId: string | null = null;

  isLoading = false;
  hasAppliedFilters = false;
  loadErrorMessage = '';

  private readonly componentLabels: Record<RenErcComponentCode, string> = {
    rt_pdbf: 'RT PDBF',
    rt_pdvd: 'RT PDVD',
    rt_phf: 'RT PHF',
    afrr: 'Banda aFRR',
    mfrr: 'Banda mFRR',
    other: 'Outros',
  };


  get latestRecord(): RenErc | null {
    return this.records.length ? this.records[this.records.length - 1] : null;
  }

  loadData(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      return;
    }

    const { startDate, endDate } = this.filterForm.getRawValue();

    if (endDate < startDate) {
      this.toast.error('A data final não pode ser anterior à data inicial.');
      return;
    }

    this.hasAppliedFilters = true;
    this.isLoading = true;
    this.loadErrorMessage = '';
    this.expandedId = null;

    forkJoin({
      records: this.renErcService.getRenErcRange(startDate, endDate),
      reference: this.renErcService.getRenErcReference(startDate, endDate).pipe(
        catchError(() => of(null)),
      ),
    })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: ({ records, reference }) => {
          this.records = [...records].sort(
            (first, second) =>
              new Date(first.periodStart).getTime() - new Date(second.periodStart).getTime(),
          );
          this.reference = reference;
        },
        error: (error) => {
          this.records = [];
          this.reference = null;
          this.loadErrorMessage =
            error?.error?.message || 'Não foi possível carregar os valores REN/ERC.';
          this.toast.error(this.loadErrorMessage);
        },
      });
  }

  onFiltersChanged(): void {
    if (!this.hasAppliedFilters && !this.records.length && !this.reference && !this.loadErrorMessage) {
      return;
    }

    this.hasAppliedFilters = false;
    this.records = [];
    this.reference = null;
    this.expandedId = null;
    this.loadErrorMessage = '';
  }

  toggleDetails(record: RenErc): void {
    this.expandedId = this.expandedId === record.id ? null : record.id;
  }

  onDetailsButtonClick(event: MouseEvent, record: RenErc): void {
    event.stopPropagation();
    this.toggleDetails(record);
  }

  onRowKeydown(event: KeyboardEvent, record: RenErc): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.toggleDetails(record);
  }

  getComponentLabel(code: RenErcComponentCode): string {
    return this.componentLabels[code];
  }

  getSourceLabel(record: RenErc): string {
    return record.source === 'manual' || record.manualOverride ? 'Manual' : 'REN';
  }

  formatEurMwh(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return '-';
    }

    return new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 6,
    }).format(Number(value));
  }

  formatDate(value?: string): string {
    return this.formatDateTimePart(value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatTime(value?: string): string {
    return this.formatDateTimePart(value, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  formatDateTime(value?: string): string {
    return this.formatDateTimePart(value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  trackByRecordId(_index: number, record: RenErc): string {
    return record.id;
  }

  private formatDateTimePart(value: string | undefined, options: Intl.DateTimeFormatOptions): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      ...options,
      timeZone: 'Europe/Lisbon',
    }).format(date);
  }

  private getPortugalDate(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Lisbon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${values['year']}-${values['month']}-${values['day']}`;
  }
}
