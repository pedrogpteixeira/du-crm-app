import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Auth } from '../../../core/services/auth';
import { ToastService } from '../../../core/services/toast';

@Component({
  selector: 'app-change-password',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ChangePassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  isSubmitting = false;
  currentPasswordError = '';
  newPasswordError = '';

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(7),
          Validators.pattern(/[A-Z]/),
          Validators.pattern(/\d/),
          Validators.pattern(/[^A-Za-z0-9]/),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: [this.passwordsMatchValidator()],
    },
  );

  get isMandatory(): boolean {
    return this.auth.isPasswordExpired();
  }

  get policy() {
    return this.auth.getPasswordPolicy();
  }

  get newPasswordValue(): string {
    return this.form.controls.newPassword.value;
  }

  get hasMinimumPasswordLength(): boolean {
    return this.newPasswordValue.length >= 7;
  }

  get hasUppercasePasswordLetter(): boolean {
    return /[A-Z]/.test(this.newPasswordValue);
  }

  get hasPasswordNumber(): boolean {
    return /\d/.test(this.newPasswordValue);
  }

  get hasPasswordSpecialCharacter(): boolean {
    return /[^A-Za-z0-9]/.test(this.newPasswordValue);
  }

  get passwordsDoNotMatch(): boolean {
    return Boolean(
      this.form.hasError('passwordMismatch') &&
        this.form.controls.confirmPassword.touched,
    );
  }

  togglePasswordVisibility(field: 'current' | 'new' | 'confirm'): void {
    if (field === 'current') {
      this.showCurrentPassword = !this.showCurrentPassword;
      return;
    }

    if (field === 'new') {
      this.showNewPassword = !this.showNewPassword;
      return;
    }

    this.showConfirmPassword = !this.showConfirmPassword;
  }

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

    this.currentPasswordError = '';
    this.newPasswordError = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();

    this.isSubmitting = true;

    this.auth
      .changePassword({ currentPassword, newPassword })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.auth.clearSession();

          void this.router.navigate(['/login'], {
            replaceUrl: true,
            queryParams: {
              passwordChanged: 'true',
            },
          });
        },
        error: (error: HttpErrorResponse) => {
          const backendMessage = this.getBackendMessage(error);

          if (this.isCurrentPasswordIncorrectError(backendMessage)) {
            this.currentPasswordError =
              backendMessage || 'A palavra-passe atual está incorreta.';
            return;
          }

          if (this.isSamePasswordError(backendMessage)) {
            this.newPasswordError =
              backendMessage ||
              'A nova palavra-passe tem de ser diferente da atual.';
            return;
          }

          this.toast.error(
            backendMessage ||
              'Não foi possível alterar a palavra-passe. Tente novamente.',
          );
        },
      });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login'], { replaceUrl: true });
  }

  private passwordsMatchValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const newPassword = control.get('newPassword')?.value ?? '';
      const confirmPassword = control.get('confirmPassword')?.value ?? '';

      if (!newPassword || !confirmPassword) {
        return null;
      }

      return newPassword === confirmPassword
        ? null
        : { passwordMismatch: true };
    };
  }


  private isCurrentPasswordIncorrectError(message: string): boolean {
    return (
      message === 'A palavra-passe atual está incorreta.' ||
      message === 'A password atual está incorreta.' ||
      message === 'Current password is incorrect.'
    );
  }

  private isSamePasswordError(message: string): boolean {
    return (
      message ===
        'A nova palavra-passe tem de ser diferente da palavra-passe atual.' ||
      message === 'A nova palavra-passe tem de ser diferente da atual.' ||
      message === 'A nova password tem de ser diferente da atual.' ||
      message ===
        'New password must be different from the current password.'
    );
  }

  private getBackendMessage(error: HttpErrorResponse): string {
    if (!error.error || typeof error.error !== 'object') {
      return '';
    }

    const body = error.error as { message?: string };
    return body.message?.trim() ?? '';
  }
}
