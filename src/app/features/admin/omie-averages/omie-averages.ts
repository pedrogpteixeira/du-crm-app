import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';

import {
  IndexedEnergyAverage,
  IndexedEnergyAverageCard,
  LatestIndexedEnergyAveragesResponse,
} from '../../../core/models/indexed-energy-average.model';

import { Auth } from '../../../core/services/auth';
import { IndexedEnergyAverageService } from '../../../core/services/indexed-energy-average';
import { MibgasPrices } from '../mibgas-prices/mibgas-prices';

@Component({
  selector: 'app-omie-averages',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MibgasPrices,
  ],
  templateUrl: './omie-averages.html',
  styleUrl: './omie-averages.scss',
})
export class OmieAverages implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly auth = inject(Auth);

  private readonly indexedEnergyAverageService = inject(
    IndexedEnergyAverageService,
  );

  @ViewChild(MibgasPrices)
  private mibgasPricesComponent?: MibgasPrices;

  isLoading = false;
  isSaving = false;

  successMessage = '';
  errorMessage = '';

  editingId: string | null = null;

  cards: IndexedEnergyAverageCard[] = [
    {
      periodType: 'daily',
      title: 'Média diária',
      average: null,
    },
    {
      periodType: 'weekly',
      title: 'Média semanal',
      average: null,
    },
    {
      periodType: 'monthly',
      title: 'Média mensal',
      average: null,
    },
  ];

  editForm = this.fb.group({
    averagePriceMwh: [
      null as number | null,
      [
        Validators.required,
        Validators.min(0),
      ],
    ],
  });

  get canEdit(): boolean {
    const role = this.auth.getCurrentUser()?.role ?? '';

    return role
      .toLowerCase()
      .includes('super admin');
  }

  get isRefreshing(): boolean {
    return (
      this.isLoading ||
      !!this.mibgasPricesComponent?.isLoading
    );
  }

  ngOnInit(): void {
    this.loadAverages();
  }

  refreshAll(): void {
    this.loadAverages();
    this.mibgasPricesComponent?.loadPrices();
  }

  loadAverages(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.indexedEnergyAverageService
      .getLatestAverages()
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.cards = this.buildCards(response);
        },
        error: () => {
          this.showError(
            'Não foi possível carregar as médias OMIE.',
          );
        },
      });
  }

  startEdit(average: IndexedEnergyAverage): void {
    if (!this.canEdit) {
      return;
    }

    this.editingId = average.id;

    this.editForm.reset({
      averagePriceMwh: average.averagePriceMwh,
    });

    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editForm.reset();
  }

  saveAverage(average: IndexedEnergyAverage): void {
    if (!this.canEdit) {
      this.showError(
        'Não tens permissão para editar médias OMIE.',
      );
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();

      this.showError(
        'Introduz um valor válido em €/MWh.',
      );

      return;
    }

    const value =
      this.editForm.controls.averagePriceMwh.value;

    if (
      value === null ||
      value === undefined ||
      !Number.isFinite(Number(value)) ||
      Number(value) < 0
    ) {
      this.showError(
        'O valor não pode ser vazio, negativo ou inválido.',
      );

      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.indexedEnergyAverageService
      .updateAverage(average.id, {
        averagePriceMwh: Number(value),
      })
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (updatedAverage) => {
          this.cards = this.cards.map((card) =>
            card.average?.id === updatedAverage.id
              ? {
                  ...card,
                  average: updatedAverage,
                }
              : card,
          );

          this.editingId = null;
          this.editForm.reset();

          this.showSuccess(
            'Média OMIE atualizada com sucesso.',
          );
        },
        error: (error) => {
          this.showError(
            error?.error?.message ||
              'Não foi possível atualizar a média OMIE.',
          );
        },
      });
  }

  private buildCards(
    response: LatestIndexedEnergyAveragesResponse,
  ): IndexedEnergyAverageCard[] {
    return [
      {
        periodType: 'daily',
        title: 'Média diária',
        average: response.daily,
      },
      {
        periodType: 'weekly',
        title: 'Média semanal',
        average: response.weekly,
      },
      {
        periodType: 'monthly',
        title: 'Média mensal',
        average: response.monthly,
      },
    ];
  }

  getReferenceLabel(
    average: IndexedEnergyAverage,
  ): string {
    if (average.periodType === 'daily') {
      return average.referenceDate
        ? this.formatDate(average.referenceDate)
        : '-';
    }

    if (average.periodType === 'weekly') {
      return `${average.week || '-'} · ${this.getWeeklyRangeLabel(average)}`;
    }

    if (average.periodType === 'monthly') {
      return `${this.formatMonth(average.month)} · ${average.year || '-'}`;
    }

    return '-';
  }

  formatMwh(value?: number): string {
    return new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value || 0);
  }

  formatKwh(value?: number): string {
    return new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 5,
      maximumFractionDigits: 6,
    }).format(value || 0);
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('pt-PT').format(
      new Date(value),
    );
  }

  formatDateTime(value?: string): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  getWeeklyRangeLabel(
    average: IndexedEnergyAverage,
  ): string {
    if (!average.year || !average.week) {
      return '-';
    }

    const startDate = this.getDateOfISOWeek(
      average.week,
      average.year,
    );

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const formatter = new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
    });

    return `${formatter.format(startDate)} a ${formatter.format(endDate)}`;
  }

  private getDateOfISOWeek(
    week: number,
    year: number,
  ): Date {
    const simple = new Date(
      year,
      0,
      1 + (week - 1) * 7,
    );

    const dayOfWeek = simple.getDay();
    const isoWeekStart = new Date(simple);

    if (dayOfWeek <= 4) {
      isoWeekStart.setDate(
        simple.getDate() - simple.getDay() + 1,
      );
    } else {
      isoWeekStart.setDate(
        simple.getDate() + 8 - simple.getDay(),
      );
    }

    isoWeekStart.setHours(0, 0, 0, 0);

    return isoWeekStart;
  }

  private formatMonth(
    month?: number | null,
  ): string {
    if (!month) {
      return '-';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      month: 'long',
    }).format(new Date(2026, month - 1, 1));
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