import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';

import { ToastService } from '../../../core/services/toast';

import { Company, CompanyService, UpdateCompanyRequest } from '../../../core/services/company';

const integerValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;

  if (value === null || value === undefined || value === '') {
    return null;
  }

  return Number.isInteger(Number(value)) ? null : { integer: true };
};

@Component({
  selector: 'app-companies',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './companies.html',
  styleUrl: './companies.scss',
})
export class Companies implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly cdr = inject(ChangeDetectorRef);

  companies: Company[] = [];

  isLoading = false;
  isSaving = false;
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

  editingCompany: Company | null = null;

  private backdropPointerId: number | null = null;

  readonly editForm = this.fb.group({
    active: this.fb.nonNullable.control(true),
    supplyPointReentryDays: this.fb.control<number | null>(null, [
      Validators.min(0),
      integerValidator,
    ]),
  });

  ngOnInit(): void {
    this.loadCompanies();
  }

  get hasEditChanges(): boolean {
    const company = this.editingCompany;

    if (!company) {
      return false;
    }

    const active = this.editForm.controls.active.value;
    const supplyPointReentryDays = this.editForm.controls.supplyPointReentryDays.value;

    return active !== company.active || supplyPointReentryDays !== company.supplyPointReentryDays;
  }

  loadCompanies(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.companyService
      .getCompaniesFromApi()
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (companies) => {
          this.companies = [...companies].sort((left, right) =>
            left.name.localeCompare(right.name, 'pt-PT'),
          );
        },
        error: (error) => {
          this.errorMessage = error?.error?.message || 'Não foi possível carregar as Companies.';
        },
      });
  }

  openEdit(company: Company): void {
    this.editingCompany = company;
    this.successMessage = '';

    this.editForm.reset({
      active: company.active,
      supplyPointReentryDays: company.supplyPointReentryDays,
    });
  }

  closeEdit(): void {
    if (this.isSaving) {
      return;
    }

    this.editingCompany = null;
    this.editForm.reset({
      active: true,
      supplyPointReentryDays: null,
    });
  }


  onBackdropPointerDown(event: PointerEvent): void {
    if (event.target !== event.currentTarget) {
      return;
    }

    this.backdropPointerId = event.pointerId;
  }

  onBackdropPointerUp(event: PointerEvent): void {
    const shouldClose =
      this.backdropPointerId === event.pointerId && event.target === event.currentTarget;

    this.backdropPointerId = null;

    if (shouldClose) {
      this.closeEdit();
    }
  }

  onModalPointerDown(event: PointerEvent): void {
    this.backdropPointerId = null;
    event.stopPropagation();
  }

  onModalPointerUp(event: PointerEvent): void {
    this.backdropPointerId = null;
    event.stopPropagation();
  }

  resetBackdropPointer(): void {
    this.backdropPointerId = null;
  }

  saveCompany(): void {
    const company = this.editingCompany;

    if (!company || this.isSaving) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const active = this.editForm.controls.active.value;
    const rawReentryDays = this.editForm.controls.supplyPointReentryDays.value;

    const supplyPointReentryDays =
      rawReentryDays === null || rawReentryDays === undefined ? null : Number(rawReentryDays);

    if (
      supplyPointReentryDays !== null &&
      (!Number.isInteger(supplyPointReentryDays) || supplyPointReentryDays < 0)
    ) {
      this.editForm.controls.supplyPointReentryDays.setErrors({
        integer: !Number.isInteger(supplyPointReentryDays),
        min: supplyPointReentryDays < 0,
      });
      this.editForm.controls.supplyPointReentryDays.markAsTouched();
      return;
    }

    const payload: UpdateCompanyRequest = {};

    if (active !== company.active) {
      payload.active = active;
    }

    if (supplyPointReentryDays !== company.supplyPointReentryDays) {
      payload.supplyPointReentryDays = supplyPointReentryDays;
    }

    if (Object.keys(payload).length === 0) {
      this.closeEdit();
      return;
    }

    this.isSaving = true;
    this.successMessage = '';

    this.companyService
      .updateCompany(company.domainId, payload)
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (updatedCompany) => {
          const nextCompany = this.mergeUpdatedCompany(company, payload, updatedCompany);

          this.companies = this.companies.map((item) =>
            item.domainId === company.domainId ? nextCompany : item,
          );

          this.editingCompany = null;
          this.editForm.reset({
            active: true,
            supplyPointReentryDays: null,
          });

          this.successMessage = 'Company atualizada com sucesso.';
        },
        error: (error) => {
          this.toast.error(
            error?.error?.message || 'Não foi possível atualizar a Company.',
          );
        },
      });
  }

  formatReentryDays(company: Company): string {
    if (company.supplyPointReentryDays === null) {
      return 'Sem limite configurado';
    }

    return `${company.supplyPointReentryDays} ${
      company.supplyPointReentryDays === 1 ? 'dia' : 'dias'
    }`;
  }

  private mergeUpdatedCompany(
    current: Company,
    payload: UpdateCompanyRequest,
    response: Partial<Company> | null,
  ): Company {
    const nextActive = response?.active ?? payload.active ?? current.active;

    let nextReentryDays = current.supplyPointReentryDays;

    if (payload.supplyPointReentryDays !== undefined) {
      nextReentryDays = payload.supplyPointReentryDays;
    }

    if (response && Object.prototype.hasOwnProperty.call(response, 'supplyPointReentryDays')) {
      nextReentryDays = response.supplyPointReentryDays ?? null;
    }

    return {
      id: response?.id ?? current.id,
      domainId: response?.domainId ?? current.domainId,
      name: response?.name ?? current.name,
      active: nextActive,
      supplyPointReentryDays: nextReentryDays,
    };
  }
}
