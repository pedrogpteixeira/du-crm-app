import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Auth } from '../../../core/services/auth';

const GENERIC_CONFIRMATION_MESSAGE =
  'Se existir uma conta associada a este email, receberá instruções para recuperar a palavra-passe.';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: '../password-recovery.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);

  isSubmitting = false;
  requestSent = false;
  confirmationMessage = '';
  errorMessage = '';

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.isSubmitting || this.requestSent) {
      return;
    }

    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email = this.form.controls.email.value.trim();

    if (!email) {
      this.form.controls.email.setErrors({ required: true });
      this.form.controls.email.markAsTouched();
      return;
    }

    this.isSubmitting = true;

    this.auth
      .forgotPassword(email)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.confirmationMessage = GENERIC_CONFIRMATION_MESSAGE;
          this.requestSent = true;
        },
        error: (_error: HttpErrorResponse) => {
          this.errorMessage =
            'Não foi possível enviar as instruções neste momento. Tente novamente mais tarde.';
        },
      });
  }
}
