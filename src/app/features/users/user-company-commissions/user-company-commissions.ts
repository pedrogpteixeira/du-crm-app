import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';

import {
  UserCompanyCommission,
} from '../../../core/models/user-company-commission.model';

import {
  Company,
  CompanyService,
} from '../../../core/services/company';

import {
  UserCompanyCommissionService,
} from '../../../core/services/user-company-commission';

@Component({
  selector: 'app-user-company-commissions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './user-company-commissions.html',
  styleUrl: './user-company-commissions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserCompanyCommissions implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly commissionService = inject(
    UserCompanyCommissionService,
  );
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true })
  userId!: string;

  companies: Company[] = [];
  commissions: UserCompanyCommission[] = [];

  selectedCompany: Company | null = null;
  selectedCommission: UserCompanyCommission | null = null;

  isLoading = false;
  isSaving = false;

  successMessage = '';
  errorMessage = '';

  readonly form = this.fb.group({
    companyId: this.fb.control<string | null>(
      null,
      Validators.required,
    ),

    commissionPercentage: this.fb.control<number | null>(
      null,
      [
        Validators.required,
        Validators.min(0),
        Validators.max(100),
      ],
    ),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['userId'] &&
      this.userId
    ) {
      this.loadData();
    }
  }

  loadData(): void {
    if (!this.userId) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    forkJoin({
      companies: this.companyService.getCompanies(),
      commissions:
        this.commissionService.getByUserId(this.userId),
    })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: ({ companies, commissions }) => {
          this.companies = companies
            .filter((company) => company.active)
            .sort((first, second) =>
              first.name.localeCompare(
                second.name,
                'pt',
                {
                  sensitivity: 'base',
                },
              ),
            );

          this.commissions = commissions;

          this.form.reset({
            companyId: null,
            commissionPercentage: null,
          });

          this.selectedCompany = null;
          this.selectedCommission = null;
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.message ||
            'Não foi possível carregar as comissões.';
        },
      });
  }

  onCompanyChange(): void {
    const companyId =
      this.form.controls.companyId.value;

    this.successMessage = '';
    this.errorMessage = '';

    this.selectedCompany =
      this.companies.find(
        (company) => company.id === companyId,
      ) ?? null;

    this.selectedCommission =
      this.commissions.find(
        (commission) =>
          commission.companyId === companyId,
      ) ?? null;

    this.form.controls.commissionPercentage.setValue(
      this.selectedCommission?.commissionPercentage ?? null,
      {
        emitEvent: false,
      },
    );

    this.form.controls.commissionPercentage.markAsPristine();
    this.form.controls.commissionPercentage.markAsUntouched();
  }

  saveCommission(): void {
    if (
      this.isSaving ||
      !this.selectedCompany
    ) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      this.errorMessage =
        'Introduz uma comissão válida entre 0 e 100%.';

      return;
    }

    const commissionPercentage =
      this.form.controls.commissionPercentage.value;

    if (
      commissionPercentage === null ||
      !Number.isFinite(Number(commissionPercentage)) ||
      Number(commissionPercentage) < 0 ||
      Number(commissionPercentage) > 100
    ) {
      this.errorMessage =
        'A comissão deve estar entre 0 e 100%.';

      return;
    }

    if (!this.hasChanges) {
      return;
    }

    this.isSaving = true;
    this.successMessage = '';
    this.errorMessage = '';

    const request$ = this.selectedCommission
      ? this.commissionService.update(
          this.selectedCommission.id,
          {
            commissionPercentage:
              Number(commissionPercentage),
          },
        )
      : this.commissionService.create({
          userId: this.userId,
          companyId: this.selectedCompany.id,
          commissionPercentage:
            Number(commissionPercentage),
        });

    request$
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (commission) => {
          this.selectedCommission = commission;

          const index = this.commissions.findIndex(
            (item) => item.id === commission.id,
          );

          if (index >= 0) {
            this.commissions = this.commissions.map(
              (item) =>
                item.id === commission.id
                  ? commission
                  : item,
            );
          } else {
            this.commissions = [
              ...this.commissions,
              commission,
            ];
          }

          this.form.controls.commissionPercentage.setValue(
            commission.commissionPercentage,
            {
              emitEvent: false,
            },
          );

          this.form.controls.commissionPercentage.markAsPristine();

          this.successMessage =
            'Comissão guardada com sucesso.';

          this.clearMessageLater('success');
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.details?.join(' ') ||
            error?.error?.message ||
            'Não foi possível guardar a comissão.';

          this.clearMessageLater('error');
        },
      });
  }

  resetCommission(): void {
    this.form.controls.commissionPercentage.setValue(
      this.selectedCommission?.commissionPercentage ?? null,
      {
        emitEvent: false,
      },
    );

    this.form.controls.commissionPercentage.markAsPristine();
    this.form.controls.commissionPercentage.markAsUntouched();

    this.successMessage = '';
    this.errorMessage = '';
  }

  get hasChanges(): boolean {
    const current =
      this.form.controls.commissionPercentage.value;

    const original =
      this.selectedCommission?.commissionPercentage ?? null;

    if (
      current === null &&
      original === null
    ) {
      return false;
    }

    return Number(current) !== Number(original);
  }

  formatUpdatedAt(value?: string): string {
    if (!value) {
      return 'Ainda sem comissão configurada';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private clearMessageLater(
    type: 'success' | 'error',
  ): void {
    setTimeout(() => {
      if (type === 'success') {
        this.successMessage = '';
      } else {
        this.errorMessage = '';
      }

      this.cdr.markForCheck();
    }, type === 'success' ? 4000 : 5000);
  }
}