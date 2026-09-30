import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastService } from '../../../core/services/toast';

import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isLoading = false;
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

  infoMessage = '';

  constructor() {
    const params = this.route.snapshot.queryParamMap;

    if (params.get('passwordChanged') === 'true') {
      this.successMessage =
        'Password alterada com sucesso. Inicie sessão novamente.';
    }

    if (params.get('sessionExpired') === 'true') {
      this.infoMessage =
        'A sua sessão expirou. Inicie sessão novamente.';
    }
  }

  form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { username, password } = this.form.getRawValue();

    this.auth.login(username, password).subscribe({
      next: () => {
        const target = this.auth.roleIncludes(['Super Admin', 'DU'])
          ? ['/home/dashboard']
          : ['/home/tickets'];

        this.router.navigate(target);
      },

      error: (error) => {
        this.errorMessage = error.error?.message || 'Invalid credentials.';

        this.isLoading = false;
      },

      complete: () => {
        this.isLoading = false;
      },
    });
  }
}
