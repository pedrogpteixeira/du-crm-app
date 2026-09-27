import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import {
  Observable,
  finalize,
  forkJoin,
} from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Auth } from '../../../core/services/auth';
import {
  ContractLayout,
  ContractsDefaultView,
  PreferencesService,
  UserPreferences,
  UserPreferencesPatch,
} from '../../../core/services/preferences';
import { SocketService } from '../../../core/services/socket';
import {
  ProfileUser,
  UpdateUserRequest,
  UserService,
  UserTeam,
} from '../../../core/services/user';

interface EditUserForm {
  name: string;
  username: string;
  email: string;
  phone: string;
  defaultTeam: string;
  role: string;
  sidebarCollapsedByDefault: boolean;
  contractsDefaultView: ContractsDefaultView | '';
  contractDetailsCollapsedByDefault: boolean;
  contractLayout: ContractLayout | '';
}

type FeedbackType = 'success' | 'error';

@Component({
  selector: 'app-user-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: './user-detail.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-detail.scss',
})
export class UserDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly socketService = inject(SocketService);
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);

  private targetUserId = '';

  user: ProfileUser | null = null;
  isUserOnline$!: Observable<boolean>;

  editUserForm: EditUserForm = this.getEmptyEditUserForm();

  isLoading = false;
  isEditingUser = false;
  isChangingStatus = false;
  isLoadingUserPreferences = false;
  isSuperAdmin = false;

  errorMessage = '';
  editUserErrorMessage = '';
  userPreferencesErrorMessage = '';
  feedbackMessage = '';
  feedbackType: FeedbackType = 'success';

  showEditUserModal = false;
  showStatusConfirmModal = false;

  private originalUserPreferences: UserPreferences | null = null;

  get pendingStatusActionLabel(): string {
    return this.user?.active ? 'Desativar' : 'Ativar';
  }

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id');

    if (!userId) {
      void this.router.navigateByUrl('/error');
      return;
    }

    this.targetUserId = userId;
    this.isSuperAdmin = this.auth.isSuperAdmin();
    this.observeCachedUser(userId);
    this.validateUserAccess(userId);
  }

  openEditUserModal(): void {
    if (!this.isSuperAdmin || !this.user) {
      return;
    }

    this.editUserForm = {
      name: this.user.name ?? '',
      username: this.user.username ?? '',
      email: this.user.email ?? '',
      phone: this.user.phone ?? '',
      defaultTeam: this.user.defaultTeam?.id ?? '',
      role: this.user.role ?? '',
      sidebarCollapsedByDefault: false,
      contractsDefaultView: '',
      contractDetailsCollapsedByDefault: false,
      contractLayout: '',
    };
    this.originalUserPreferences = null;
    this.editUserErrorMessage = '';
    this.userPreferencesErrorMessage = '';
    this.showEditUserModal = true;
    this.loadEditableUserPreferences();
  }

  closeEditUserModal(): void {
    if (this.isEditingUser) {
      return;
    }

    this.showEditUserModal = false;
    this.editUserErrorMessage = '';
    this.userPreferencesErrorMessage = '';
    this.originalUserPreferences = null;
    this.editUserForm = this.getEmptyEditUserForm();
  }

  loadEditableUserPreferences(): void {
    if (!this.isSuperAdmin || !this.user || this.isLoadingUserPreferences) {
      return;
    }

    this.isLoadingUserPreferences = true;
    this.userPreferencesErrorMessage = '';

    this.preferencesService
      .getUserPreferences(this.user.id)
      .pipe(
        finalize(() => {
          this.isLoadingUserPreferences = false;
        }),
      )
      .subscribe({
        next: (preferences) => {
          this.originalUserPreferences = preferences;
          this.editUserForm = {
            ...this.editUserForm,
            sidebarCollapsedByDefault: preferences.sidebarCollapsedByDefault,
            contractsDefaultView: preferences.contractsDefaultView,
            contractDetailsCollapsedByDefault:
              preferences.contractDetailsCollapsedByDefault,
            contractLayout: preferences.contractLayout,
          };
        },
        error: (error: HttpErrorResponse) => {
          this.userPreferencesErrorMessage = this.getPreferencesError(
            error,
            'Não foi possível carregar o layout dos contratos deste utilizador.',
          );
        },
      });
  }

  saveUserChanges(): void {
    if (
      !this.isSuperAdmin ||
      this.isEditingUser ||
      this.isLoadingUserPreferences ||
      !this.user
    ) {
      return;
    }

    this.editUserErrorMessage = '';

    const validationMessage = this.validateEditUserForm();

    if (validationMessage) {
      this.editUserErrorMessage = validationMessage;
      return;
    }

    const originalUser = this.user;
    const updatePayload = this.buildUpdateUserPayload(originalUser);
    const normalizedRole = this.editUserForm.role.trim();
    const roleChanged = normalizedRole !== (originalUser.role ?? '');
    const hasProfileChanges = Object.keys(updatePayload).length > 0;
    const preferencesPayload = this.buildAdminPreferencesPayload();
    const hasPreferencesChanges = Object.keys(preferencesPayload).length > 0;

    if (!hasProfileChanges && !roleChanged && !hasPreferencesChanges) {
      this.closeEditUserModal();
      return;
    }

    this.isEditingUser = true;

    const saveAdministrativePreferences = (
      baseUser: ProfileUser,
      previousChangeSaved: boolean,
    ) => {
      if (!hasPreferencesChanges) {
        this.finishSuccessfulUserEdit(baseUser);
        return;
      }

      this.preferencesService
        .updateUserPreferences(originalUser.id, preferencesPayload)
        .subscribe({
          next: (updatedPreferences) => {
            this.originalUserPreferences = updatedPreferences;
            this.finishSuccessfulUserEdit(baseUser);
          },
          error: (error: HttpErrorResponse) => {
            this.isEditingUser = false;
            this.setUser(baseUser);
            this.editUserErrorMessage = this.getPreferencesError(
              error,
              previousChangeSaved
                ? 'Os restantes dados foram guardados, mas não foi possível atualizar as preferências administrativas.'
                : 'Não foi possível atualizar as preferências administrativas.',
              preferencesPayload,
            );
            this.refreshEditablePreferencesAfterFailure();
          },
        });
    };

    const saveRole = (baseUser: ProfileUser, profileSaved: boolean) => {
      if (!roleChanged) {
        saveAdministrativePreferences(baseUser, profileSaved);
        return;
      }

      this.userService
        .updateUserRole(originalUser.id, normalizedRole)
        .subscribe({
          next: (updatedUser) => {
            const mergedUser: ProfileUser = {
              ...baseUser,
              ...updatedUser,
              role: normalizedRole,
            };

            saveAdministrativePreferences(mergedUser, true);
          },
          error: (error: HttpErrorResponse) => {
            this.isEditingUser = false;
            this.setUser(baseUser);
            this.editUserErrorMessage = this.getOperationError(
              error,
              profileSaved
                ? 'Os dados do utilizador foram guardados, mas não foi possível atualizar a role.'
                : 'Não foi possível atualizar a role do utilizador.',
            );
          },
        });
    };

    if (!hasProfileChanges) {
      saveRole(originalUser, false);
      return;
    }

    this.userService.updateUser(originalUser.id, updatePayload).subscribe({
      next: (updatedUser) => {
        const mergedUser: ProfileUser = {
          ...originalUser,
          ...updatedUser,
        };

        saveRole(mergedUser, true);
      },
      error: (error: HttpErrorResponse) => {
        this.isEditingUser = false;
        this.editUserErrorMessage = this.getOperationError(
          error,
          'Não foi possível guardar as alterações do utilizador.',
        );
      },
    });
  }

  private refreshEditablePreferencesAfterFailure(): void {
    if (!this.user) {
      return;
    }

    this.preferencesService.getUserPreferences(this.user.id).subscribe({
      next: (preferences) => {
        this.originalUserPreferences = preferences;
        this.editUserForm = {
          ...this.editUserForm,
          sidebarCollapsedByDefault: preferences.sidebarCollapsedByDefault,
          contractsDefaultView: preferences.contractsDefaultView,
          contractDetailsCollapsedByDefault:
            preferences.contractDetailsCollapsedByDefault,
          contractLayout: preferences.contractLayout,
        };
      },
      error: () => undefined,
    });
  }

  openStatusConfirmation(): void {
    if (!this.isSuperAdmin || !this.user) {
      return;
    }

    this.showStatusConfirmModal = true;
  }

  closeStatusConfirmation(): void {
    if (this.isChangingStatus) {
      return;
    }

    this.showStatusConfirmModal = false;
  }

  confirmStatusChange(): void {
    if (
      !this.isSuperAdmin ||
      this.isChangingStatus ||
      !this.user
    ) {
      return;
    }

    const currentUser = this.user;
    const newActiveStatus = !currentUser.active;

    this.isChangingStatus = true;

    this.userService
      .setUserActive(currentUser.id, newActiveStatus)
      .pipe(
        finalize(() => {
          this.isChangingStatus = false;
        }),
      )
      .subscribe({
        next: (updatedUser) => {
          this.setUser({
            ...currentUser,
            ...updatedUser,
            active: newActiveStatus,
          });
          this.showStatusConfirmModal = false;
          this.showFeedback(
            newActiveStatus
              ? 'Utilizador ativado com sucesso.'
              : 'Utilizador desativado com sucesso.',
            'success',
          );
        },
        error: (error: HttpErrorResponse) => {
          this.showStatusConfirmModal = false;
          this.showFeedback(
            this.getOperationError(
              error,
              newActiveStatus
                ? 'Não foi possível ativar o utilizador.'
                : 'Não foi possível desativar o utilizador.',
            ),
            'error',
          );
        },
      });
  }

  getEditableUserTeams(user: ProfileUser): UserTeam[] {
    const teamsById = new Map<string, UserTeam>();

    user.teams?.forEach((team) => {
      if (team?.id) {
        teamsById.set(team.id, team);
      }
    });

    if (user.defaultTeam?.id) {
      teamsById.set(user.defaultTeam.id, user.defaultTeam);
    }

    return Array.from(teamsById.values()).sort((first, second) =>
      first.name.localeCompare(second.name, 'pt'),
    );
  }

  trackUserTeamById(_index: number, team: UserTeam): string {
    return team.id;
  }

  dismissFeedback(): void {
    this.feedbackMessage = '';
  }

  private validateUserAccess(targetUserId: string): void {
    const authenticatedUser = this.auth.getCurrentUser();

    if (!authenticatedUser?.id) {
      void this.router.navigateByUrl('/error');
      return;
    }

    if (this.auth.roleIncludes('Super Admin')) {
      this.loadUserFromCacheOrApi(targetUserId);
      return;
    }

    if (authenticatedUser.id === targetUserId) {
      this.loadUserFromCacheOrApi(targetUserId);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      currentUser: this.userService.getUserById(authenticatedUser.id),
      targetUser: this.userService.getUserById(targetUserId),
    })
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: ({ currentUser, targetUser }) => {
          if (!this.usersShareTeam(currentUser, targetUser)) {
            void this.router.navigateByUrl('/error');
            return;
          }

          this.setUser(targetUser);
        },
        error: () => {
          void this.router.navigateByUrl('/error');
        },
      });
  }

  private loadUserFromCacheOrApi(userId: string): void {
    const cachedUser = this.userService
      .getUsersSnapshot()
      .find((user) => user.id === userId);

    if (cachedUser) {
      this.setUser(cachedUser);
      return;
    }

    this.loadUser(userId);
  }

  private observeCachedUser(userId: string): void {
    this.userService.usersState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (!state.loaded) {
          return;
        }

        const cachedUser = state.users.find(
          (user) => user.id === userId,
        );

        if (cachedUser) {
          this.setUser(cachedUser);
        }
      });
  }

  private usersShareTeam(
    currentUser: ProfileUser,
    targetUser: ProfileUser,
  ): boolean {
    const currentUserTeamIds = this.getUserTeamIds(currentUser);
    const targetUserTeamIds = this.getUserTeamIds(targetUser);

    if (!currentUserTeamIds.size || !targetUserTeamIds.size) {
      return false;
    }

    return Array.from(currentUserTeamIds).some((teamId) =>
      targetUserTeamIds.has(teamId),
    );
  }

  private getUserTeamIds(user: ProfileUser): Set<string> {
    const teamIds = new Set<string>();

    user.teams?.forEach((team) => {
      if (team?.id) {
        teamIds.add(team.id);
      }
    });

    if (user.defaultTeam?.id) {
      teamIds.add(user.defaultTeam.id);
    }

    return teamIds;
  }

  loadUser(userId = this.targetUserId): void {
    if (!userId) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.userService
      .getUserById(userId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (user) => {
          this.setUser(user);
        },
        error: () => {
          void this.router.navigateByUrl('/error');
        },
      });
  }

  private setUser(user: ProfileUser): void {
    this.user = user;
    this.isUserOnline$ = this.socketService.isOnline$(user.id);
  }

  get profilePictureUrl(): string | null {
    if (!this.user?.profilePicture) {
      return null;
    }

    return (
      `${environment.apiUrl}` +
      `/api/users/` +
      `${this.user.id}` +
      `/profile-picture`
    );
  }

  get userInitial(): string {
    return this.user?.name?.charAt(0).toUpperCase() || '?';
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

  private validateEditUserForm(): string {
    const name = this.editUserForm.name.trim();
    const username = this.editUserForm.username.trim();
    const email = this.editUserForm.email.trim();
    const phone = this.editUserForm.phone.trim();

    if (name.length < 2 || name.length > 100) {
      return 'O nome deve ter entre 2 e 100 caracteres.';
    }

    if (username.length < 3 || username.length > 50) {
      return 'O username deve ter entre 3 e 50 caracteres.';
    }

    if (!this.isValidEmail(email)) {
      return 'Introduz um email válido.';
    }

    if (phone && !/^\d{9}$/.test(phone)) {
      return 'O telefone deve ter exatamente 9 dígitos.';
    }

    return '';
  }

  private buildUpdateUserPayload(user: ProfileUser): UpdateUserRequest {
    const payload: UpdateUserRequest = {};
    const name = this.editUserForm.name.trim();
    const username = this.editUserForm.username.trim();
    const email = this.editUserForm.email.trim();
    const phone = this.editUserForm.phone.trim();
    const defaultTeam = this.editUserForm.defaultTeam;

    if (name !== user.name) {
      payload.name = name;
    }

    if (username !== user.username) {
      payload.username = username;
    }

    if (email !== user.email) {
      payload.email = email;
    }

    if (phone !== (user.phone ?? '')) {
      payload.phone = phone;
    }

    if (defaultTeam !== (user.defaultTeam?.id ?? '')) {
      payload.defaultTeam = defaultTeam;
    }

    return payload;
  }

  private buildAdminPreferencesPayload(): UserPreferencesPatch {
    const original = this.originalUserPreferences;
    const payload: UserPreferencesPatch = {};

    if (!original) {
      return payload;
    }

    if (
      this.editUserForm.sidebarCollapsedByDefault !==
      original.sidebarCollapsedByDefault
    ) {
      payload.sidebarCollapsedByDefault =
        this.editUserForm.sidebarCollapsedByDefault;
    }

    if (
      this.editUserForm.contractsDefaultView &&
      this.editUserForm.contractsDefaultView !== original.contractsDefaultView
    ) {
      payload.contractsDefaultView = this.editUserForm.contractsDefaultView;
    }

    if (
      this.editUserForm.contractDetailsCollapsedByDefault !==
      original.contractDetailsCollapsedByDefault
    ) {
      payload.contractDetailsCollapsedByDefault =
        this.editUserForm.contractDetailsCollapsedByDefault;
    }

    if (
      this.editUserForm.contractLayout &&
      this.editUserForm.contractLayout !== original.contractLayout
    ) {
      payload.contractLayout = this.editUserForm.contractLayout;
    }

    // theme is deliberately excluded: another user's theme can only be changed
    // by that user, even when the editor is a Super Admin.
    return payload;
  }

  private finishSuccessfulUserEdit(user: ProfileUser): void {
    this.setUser(user);
    this.isEditingUser = false;
    this.showEditUserModal = false;
    this.editUserErrorMessage = '';
    this.userPreferencesErrorMessage = '';
    this.originalUserPreferences = null;
    this.editUserForm = this.getEmptyEditUserForm();
    this.showFeedback('Utilizador atualizado com sucesso.', 'success');
  }

  private getOperationError(
    error: HttpErrorResponse,
    fallback: string,
  ): string {
    if (error.status === 403) {
      return 'Não tem permissão para executar esta operação.';
    }

    return this.extractApiMessage(error) || fallback;
  }

  private getPreferencesError(
    error: HttpErrorResponse,
    fallback: string,
    payload?: UserPreferencesPatch,
  ): string {
    if (error.status === 403 && payload?.contractLayout) {
      return 'Não tem permissão para alterar o layout dos contratos.';
    }

    if (error.status === 403) {
      return 'Não tem permissão para alterar as preferências deste utilizador.';
    }

    return this.extractApiMessage(error) || fallback;
  }

  private extractApiMessage(error: HttpErrorResponse): string {
    const errorBody = error.error as
      | { message?: unknown }
      | string
      | null
      | undefined;

    if (typeof errorBody === 'string') {
      return errorBody;
    }

    if (
      errorBody &&
      typeof errorBody === 'object' &&
      typeof errorBody.message === 'string'
    ) {
      return errorBody.message;
    }

    return '';
  }

  private showFeedback(
    message: string,
    type: FeedbackType,
  ): void {
    this.feedbackMessage = message;
    this.feedbackType = type;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private getEmptyEditUserForm(): EditUserForm {
    return {
      name: '',
      username: '',
      email: '',
      phone: '',
      defaultTeam: '',
      role: '',
      sidebarCollapsedByDefault: false,
      contractsDefaultView: '',
      contractDetailsCollapsedByDefault: false,
      contractLayout: '',
    };
  }
}
