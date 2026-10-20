import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Auth } from '../../../core/services/auth';

interface ResetErrorBody {
  code?: string;
  message?: string;
}

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: '../password-recovery.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private resetToken: string | null = null;

  isSubmitting = false;
  invalidLink = false;
  invalidLinkMessage = '';
  resetSucceeded = false;
  verificationCodeError = '';
  newPasswordError = '';
  requestError = '';

  showNewPassword = false;
  showConfirmPassword = false;

  readonly form = this.fb.nonNullable.group(
    {
      verificationCode: [
        '',
        [Validators.required, Validators.pattern(/^\d{6}$/)],
      ],
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

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.invalidLink = true;
      this.invalidLinkMessage =
        'Este link de recuperação é inválido ou está incompleto.';
      return;
    }

    this.resetToken = token;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        token: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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

  onVerificationCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitizedValue = input.value.replace(/\D/g, '').slice(0, 6);

    if (input.value !== sanitizedValue) {
      input.value = sanitizedValue;
    }

    if (this.form.controls.verificationCode.value !== sanitizedValue) {
      this.form.controls.verificationCode.setValue(sanitizedValue);
    }

    this.verificationCodeError = '';
    this.requestError = '';
  }

  togglePasswordVisibility(field: 'new' | 'confirm'): void {
    if (field === 'new') {
      this.showNewPassword = !this.showNewPassword;
      return;
    }

    this.showConfirmPassword = !this.showConfirmPassword;
  }

  submit(): void {
    if (this.isSubmitting || this.resetSucceeded) {
      return;
    }

    this.verificationCodeError = '';
    this.newPasswordError = '';
    this.requestError = '';

    if (!this.resetToken) {
      this.invalidLink = true;
      this.invalidLinkMessage =
        'Este link de recuperação é inválido ou está incompleto.';
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { verificationCode, newPassword } = this.form.getRawValue();
    const token = this.resetToken;

    this.isSubmitting = true;

    this.auth
      .resetPassword(token, verificationCode, newPassword)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.resetToken = null;
          this.resetSucceeded = true;
          this.form.reset();
          this.auth.clearSession();
        },
        error: (error: HttpErrorResponse) => {
          const backendMessage = this.getBackendMessage(error);

          if (this.isInvalidRecoveryRequestError(error, backendMessage)) {
            this.resetToken = null;
            this.invalidLink = true;
            this.invalidLinkMessage =
              'O link ou código de recuperação é inválido ou expirou. Solicite um novo link para continuar.';
            return;
          }

          if (this.isVerificationCodeError(error, backendMessage)) {
            this.verificationCodeError =
              this.getSafeBackendMessage(backendMessage) ||
              'O link ou código de recuperação é inválido ou expirou.';
            return;
          }

          if (backendMessage) {
            this.newPasswordError = this.getSafeBackendMessage(backendMessage);
            return;
          }

          this.requestError =
            'Não foi possível alterar a palavra-passe. Tente novamente.';
        },
      });
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

  private getBackendMessage(error: HttpErrorResponse): string {
    if (!error.error || typeof error.error !== 'object') {
      return '';
    }

    const body = error.error as ResetErrorBody;
    return body.message?.trim() ?? '';
  }

  private isInvalidRecoveryRequestError(
    error: HttpErrorResponse,
    message: string,
  ): boolean {
    if (error.status === 404 || error.status === 410) {
      return true;
    }

    if (!error.error || typeof error.error !== 'object') {
      return false;
    }

    const body = error.error as ResetErrorBody;
    const code = body.code?.toUpperCase() ?? '';

    const tokenError =
      code.includes('TOKEN') &&
      (code.includes('EXPIRED') ||
        code.includes('INVALID') ||
        code.includes('USED'));

    const invalidatedRecovery =
      (code.includes('RESET') || code.includes('RECOVERY')) &&
      (code.includes('EXPIRED') ||
        code.includes('INVALIDATED') ||
        code.includes('ATTEMPT') ||
        code.includes('LIMIT') ||
        code.includes('LOCKED'));

    if (tokenError || invalidatedRecovery) {
      return true;
    }

    const normalizedMessage = message.toLocaleLowerCase('pt-PT');

    return (
      normalizedMessage.includes('token') &&
      (normalizedMessage.includes('expir') ||
        normalizedMessage.includes('inválid') ||
        normalizedMessage.includes('invalid') ||
        normalizedMessage.includes('utiliz') ||
        normalizedMessage.includes('used'))
    );
  }

  private isVerificationCodeError(
    error: HttpErrorResponse,
    message: string,
  ): boolean {
    if (!error.error || typeof error.error !== 'object') {
      return false;
    }

    const body = error.error as ResetErrorBody;
    const code = body.code?.toUpperCase() ?? '';
    const normalizedMessage = message.toLocaleLowerCase('pt-PT');

    return (
      code.includes('VERIFICATION') ||
      code.includes('CODE') ||
      normalizedMessage.includes('código') ||
      normalizedMessage.includes('codigo') ||
      normalizedMessage.includes('verification code')
    );
  }

  private getSafeBackendMessage(message: string): string {
    const normalizedMessage = message.toLocaleLowerCase('pt-PT');

    if (
      normalizedMessage.includes('tentativa') ||
      normalizedMessage.includes('attempt')
    ) {
      return 'O link ou código de recuperação é inválido ou expirou.';
    }

    return message;
  }
}
