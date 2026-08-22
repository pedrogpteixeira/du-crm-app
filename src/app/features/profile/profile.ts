import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Auth } from '../../core/services/auth';
import { UserService } from '../../core/services/user';
import { SocketService } from '../../core/services/socket';
import { AuthUser, UserTeam } from '../../core/models/auth-user';

import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';

@Component({
  selector: 'app-profile',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ImageCropperComponent,
    RouterLink,
  ],
  templateUrl: './profile.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly socketService = inject(SocketService);

  private messageTimeout: ReturnType<typeof setTimeout> | null = null;

  isEditing = false;
  isUploadingPhoto = false;
  isLoadingProfile = false;
  isSaving = false;
  isChangingPassword = false;
  showPasswordModal = false;

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  currentPasswordError = '';
  newPasswordError = '';

  errorMessage = '';
  successMessage = '';

  user: AuthUser = this.getEmptyUser();
  editableUser: AuthUser = { ...this.user };

  private readonly passwordPattern =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{7,}$/;

  readonly passwordForm = this.fb.group(
    {
      currentPassword: this.fb.nonNullable.control('', [
        Validators.required,
      ]),
      newPassword: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.minLength(7),
        Validators.pattern(this.passwordPattern),
      ]),
      confirmPassword: this.fb.nonNullable.control('', [
        Validators.required,
      ]),
    },
    {
      validators: this.passwordsMatchValidator(),
    },
  );

  selectedImageEvent: Event | null = null;
  croppedImageBlob: Blob | null = null;
  showImageCropper = false;

  isCurrentUserOnline$!: Observable<boolean>;

  ngOnInit(): void {
    this.loadProfileFromAuth();
  }

  private loadProfileFromAuth(): void {
    const currentUser = this.auth.getCurrentUser();

    if (!currentUser?.id) {
      this.showTemporaryMessage('error', 'Não foi possível identificar o utilizador autenticado.');

      return;
    }

    this.user = {
      ...this.getEmptyUser(),
      ...currentUser,
    };

    this.editableUser = { ...this.user };
    this.isCurrentUserOnline$ = this.socketService.isOnline$(this.user.id);

    this.loadFreshUserProfile(this.user.id);
  }

  private loadFreshUserProfile(userId: string): void {
    this.isLoadingProfile = true;

    this.userService.getUserById(userId).subscribe({
      next: (user: AuthUser) => {
        this.user = user;
        this.editableUser = { ...user };

        this.auth.setCurrentUser(user);
        this.isCurrentUserOnline$ = this.socketService.isOnline$(this.user.id);
      },
      error: () => {
        this.showTemporaryMessage('error', 'Não foi possível carregar o perfil atualizado.');
      },
      complete: () => {
        this.isLoadingProfile = false;
      },
    });
  }

  private hasProfileChanges(): boolean {
    return (
      this.editableUser.name !== this.user.name ||
      this.editableUser.email !== this.user.email ||
      this.editableUser.phone !== this.user.phone ||
      this.editableUser.defaultTeam?.id !== this.user.defaultTeam?.id
    );
  }

  private showTemporaryMessage(type: 'success' | 'error', message: string): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    if (type === 'success') {
      this.successMessage = message;
    } else {
      this.errorMessage = message;
    }

    this.messageTimeout = setTimeout(() => {
      this.successMessage = '';
      this.errorMessage = '';
      this.messageTimeout = null;
    }, 3500);
  }

  get userInitial(): string {
    return this.user.name?.charAt(0).toUpperCase() || '?';
  }

  getTeamsLabel(teams: UserTeam[]): string {
    return teams.map((team) => team.name).join(', ');
  }

  get profilePictureUrl(): string | null {
    if (!this.user.profilePicture || !this.user.id) {
      return null;
    }

    return `${environment.apiUrl}/api/users/${this.user.id}/profile-picture`;
  }

  toggleEdit(): void {
    this.isEditing = true;
    this.editableUser = { ...this.user };
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.editableUser = { ...this.user };
  }

  save(): void {
    if (!this.user.id || !this.editableUser.defaultTeam?.id) {
      this.showTemporaryMessage('error', 'Não foi possível guardar o perfil.');
      return;
    }

    if (!this.hasProfileChanges()) {
      this.showTemporaryMessage('error', 'Não existem alterações para guardar.');
      return;
    }

    const payload = {
      name: this.editableUser.name,
      email: this.editableUser.email,
      phone: this.editableUser.phone,
      defaultTeam: this.editableUser.defaultTeam.id,
    };

    this.isSaving = true;

    this.userService.updateUser(this.user.id, payload).subscribe({
      next: (updatedUser: AuthUser) => {
        this.user = updatedUser;
        this.editableUser = { ...updatedUser };

        this.auth.setCurrentUser(updatedUser);

        this.isEditing = false;
        this.showTemporaryMessage('success', 'Perfil atualizado com sucesso.');
      },
      error: (error) => {
        this.showTemporaryMessage(
          'error',
          error.error?.message || 'Ocorreu um erro ao atualizar o perfil.',
        );
      },
      complete: () => {
        this.isSaving = false;
      },
    });
  }

  openPasswordModal(): void {
    this.resetPasswordForm();
    this.showPasswordModal = true;
  }

  closePasswordModal(): void {
    if (this.isChangingPassword) {
      return;
    }

    this.showPasswordModal = false;
    this.resetPasswordForm();
  }

  togglePasswordVisibility(
    field: 'current' | 'new' | 'confirm',
  ): void {
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

  changePassword(): void {
    if (this.isChangingPassword) {
      return;
    }

    this.currentPasswordError = '';
    this.newPasswordError = '';

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const {
      currentPassword,
      newPassword,
    } = this.passwordForm.getRawValue();

    this.isChangingPassword = true;

    this.auth
      .changePassword({
        currentPassword,
        newPassword,
      })
      .pipe(
        finalize(() => {
          this.isChangingPassword = false;
        }),
      )
      .subscribe({
        next: () => {
          this.passwordForm.reset();
          this.showPasswordModal = false;

          // O backend revoga todas as sessões neste momento.
          // Limpamos apenas o estado local; não fazemos novo request de logout.
          this.auth.clearSession();

          this.router.navigate(['/login'], {
            replaceUrl: true,
            queryParams: {
              passwordChanged: 'true',
            },
          });
        },
        error: (error) => {
          const backendMessage =
            error?.error?.message ?? '';

          if (
            backendMessage ===
            'Current password is incorrect.'
          ) {
            this.currentPasswordError =
              'A password atual está incorreta.';
            return;
          }

          if (
            backendMessage ===
            'New password must be different from the current password.'
          ) {
            this.newPasswordError =
              'A nova password tem de ser diferente da atual.';
            return;
          }

          if (error?.status === 401) {
            this.auth.clearSession();
            this.router.navigate(['/login'], {
              replaceUrl: true,
              queryParams: {
                sessionExpired: 'true',
              },
            });
            return;
          }

          this.showTemporaryMessage(
            'error',
            backendMessage ||
              'Não foi possível alterar a password. Tente novamente.',
          );
        },
      });
  }

  get newPasswordValue(): string {
    return this.passwordForm.controls.newPassword.value;
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
      this.passwordForm.hasError('passwordMismatch') &&
      this.passwordForm.controls.confirmPassword.touched,
    );
  }

  private passwordsMatchValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const newPassword =
        control.get('newPassword')?.value ?? '';
      const confirmPassword =
        control.get('confirmPassword')?.value ?? '';

      if (!newPassword || !confirmPassword) {
        return null;
      }

      return newPassword === confirmPassword
        ? null
        : { passwordMismatch: true };
    };
  }

  private resetPasswordForm(): void {
    this.passwordForm.reset({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });

    this.currentPasswordError = '';
    this.newPasswordError = '';
    this.showCurrentPassword = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
  }

  logout(): void {
    this.auth.logout();

    this.router.navigate(['/login'], {
      replaceUrl: true,
    });
  }

  onProfilePictureSelected(event: Event): void {
    this.selectedImageEvent = event;
    this.showImageCropper = true;
  }

  onImageCropped(event: ImageCroppedEvent): void {
    if (!event.blob) {
      return;
    }

    this.croppedImageBlob = event.blob;
  }

  uploadCroppedImage(): void {
    if (!this.croppedImageBlob || !this.user.id) {
      return;
    }

    const file = new File([this.croppedImageBlob], 'profile-picture.png', {
      type: 'image/png',
    });

    this.isUploadingPhoto = true;

    this.userService.updateProfilePicture(this.user.id, file).subscribe({
      next: (response) => {
        this.user = {
          ...this.user,
          profilePicture: response.profilePicture,
        };

        this.editableUser = { ...this.user };
        this.auth.setCurrentUser(this.user);

        this.showImageCropper = false;
      },
      error: () => {
        this.showTemporaryMessage('error', 'Não foi possível atualizar a fotografia de perfil.');
      },
      complete: () => {
        this.isUploadingPhoto = false;
      },
    });
  }

  private getEmptyUser(): AuthUser {
    return {
      id: '',
      username: '',
      name: '',
      role: '',
      email: '',
      phone: '',
      active: false,
      defaultTeam: null,
      teams: [],
    };
  }

  formatCreatedAt(date?: string): string {
    if (!date) {
      return 'Não disponível';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  formatLastAccess(date?: string): string {
    if (!date) {
      return 'Não disponível';
    }

    const accessDate = new Date(date);
    const now = new Date();

    const diffMs = now.getTime() - accessDate.getTime();

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const formattedTime = accessDate.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (diffDays === 0) {
      return `Hoje às ${formattedTime}`;
    }

    if (diffDays === 1) {
      return `Ontem às ${formattedTime}`;
    }

    if (diffDays < 7) {
      return `Há ${diffDays} dias`;
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(accessDate);
  }
}
