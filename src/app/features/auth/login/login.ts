import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  errorMessage = '';
  successMessage = '';
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
        this.router.navigate(['/home']);
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
