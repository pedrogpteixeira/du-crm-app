import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  RouterLink,
} from '@angular/router';
import {
  catchError,
  finalize,
  forkJoin,
  map,
  of,
} from 'rxjs';

import { environment } from '../../../../environments/environment';

import { Auth } from '../../../core/services/auth';

import {
  AddUserToTeamRequest,
  Team,
  TeamService,
  TeamUser,
} from '../../../core/services/team';

import {
  ProfileUser,
  UserService,
} from '../../../core/services/user';

interface AddUserResult {
  userId: string;
  success: boolean;
  status?: number;
  message?: string;
}

@Component({
  selector: 'app-team-detail',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
  ],
  templateUrl: './team-detail.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './team-detail.scss',
})
export class TeamDetail implements OnInit {
  private readonly route =
    inject(ActivatedRoute);

  private readonly teamService =
    inject(TeamService);

  private readonly userService =
    inject(UserService);

  private readonly auth =
    inject(Auth);

  private readonly cdr =
    inject(ChangeDetectorRef);

  teamId: string | null = null;

  team: Team | null = null;
  users: TeamUser[] = [];

  availableUsers: ProfileUser[] = [];
  filteredAvailableUsers: ProfileUser[] = [];

  selectedUserIds: string[] = [];
  userSearch = '';

  isLoading = false;
  isLoadingUsers = false;
  isAddingUser = false;

  showAddUserModal = false;

  errorMessage = '';
  addUserErrorMessage = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe(
      (params) => {
        this.teamId = params.get('id');

        if (this.teamId) {
          this.loadTeam(this.teamId);
        }
      },
    );
  }

  get canManageTeamUsers(): boolean {
    return this.auth.roleIncludes(
      'Super Admin',
    );
  }

  get selectedUsersCount(): number {
    return this.selectedUserIds.length;
  }

  loadTeam(teamId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.teamService
      .getTeamUsers(teamId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.team = response.team;
          this.users = response.users || [];
        },
        error: () => {
          this.errorMessage =
            'Não foi possível carregar a equipa.';
        },
      });
  }

  openAddUserModal(): void {
    if (
      !this.canManageTeamUsers ||
      !this.teamId ||
      this.isLoadingUsers
    ) {
      return;
    }

    this.selectedUserIds = [];
    this.userSearch = '';
    this.addUserErrorMessage = '';

    this.availableUsers = [];
    this.filteredAvailableUsers = [];

    this.showAddUserModal = true;

    this.loadAvailableUsers();
  }

  closeAddUserModal(): void {
    if (this.isAddingUser) {
      return;
    }

    this.showAddUserModal = false;

    this.selectedUserIds = [];
    this.userSearch = '';

    this.availableUsers = [];
    this.filteredAvailableUsers = [];

    this.addUserErrorMessage = '';
  }

  loadAvailableUsers(): void {
    if (!this.canManageTeamUsers) {
      return;
    }

    this.isLoadingUsers = true;
    this.addUserErrorMessage = '';

    this.userService
      .getUsers()
      .pipe(
        finalize(() => {
          this.isLoadingUsers = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (users) => {
          const existingUserIds = new Set(
            this.users.map(
              (user) => user.id,
            ),
          );

          this.availableUsers = users.filter(
            (user) =>
              user.active &&
              !existingUserIds.has(user.id),
          );

          this.applyUserSearch();
        },
        error: () => {
          this.addUserErrorMessage =
            'Não foi possível carregar os utilizadores disponíveis.';
        },
      });
  }

  applyUserSearch(): void {
    const searchedValue =
      this.normalizeText(
        this.userSearch,
      );

    this.filteredAvailableUsers =
      this.availableUsers.filter(
        (user) => {
          if (!searchedValue) {
            return true;
          }

          const searchableText =
            this.normalizeText(
              [
                user.name,
                user.email,
                user.role,
              ]
                .filter(Boolean)
                .join(' '),
            );

          return searchableText.includes(
            searchedValue,
          );
        },
      );
  }

  toggleUserSelection(
    userId: string,
  ): void {
    if (
      !this.canManageTeamUsers ||
      this.isAddingUser
    ) {
      return;
    }

    if (
      this.selectedUserIds.includes(
        userId,
      )
    ) {
      this.selectedUserIds =
        this.selectedUserIds.filter(
          (selectedId) =>
            selectedId !== userId,
        );

      return;
    }

    this.selectedUserIds = [
      ...this.selectedUserIds,
      userId,
    ];

    this.addUserErrorMessage = '';
  }

  isUserSelected(
    userId: string,
  ): boolean {
    return this.selectedUserIds.includes(
      userId,
    );
  }

  clearSelectedUsers(): void {
    if (this.isAddingUser) {
      return;
    }

    this.selectedUserIds = [];
  }

  selectAllVisibleUsers(): void {
    if (
      this.isAddingUser ||
      !this.filteredAvailableUsers.length
    ) {
      return;
    }

    const visibleUserIds =
      this.filteredAvailableUsers.map(
        (user) => user.id,
      );

    this.selectedUserIds = Array.from(
      new Set([
        ...this.selectedUserIds,
        ...visibleUserIds,
      ]),
    );

    this.addUserErrorMessage = '';
  }

  areAllVisibleUsersSelected(): boolean {
    return (
      this.filteredAvailableUsers.length >
        0 &&
      this.filteredAvailableUsers.every(
        (user) =>
          this.selectedUserIds.includes(
            user.id,
          ),
      )
    );
  }

  toggleAllVisibleUsers(): void {
    if (
      this.isAddingUser ||
      !this.filteredAvailableUsers.length
    ) {
      return;
    }

    if (
      this.areAllVisibleUsersSelected()
    ) {
      const visibleUserIds = new Set(
        this.filteredAvailableUsers.map(
          (user) => user.id,
        ),
      );

      this.selectedUserIds =
        this.selectedUserIds.filter(
          (userId) =>
            !visibleUserIds.has(userId),
        );

      return;
    }

    this.selectAllVisibleUsers();
  }

  addSelectedUsers(): void {
    if (
      !this.canManageTeamUsers ||
      !this.teamId ||
      !this.selectedUserIds.length ||
      this.isAddingUser
    ) {
      if (
        this.canManageTeamUsers &&
        !this.selectedUserIds.length
      ) {
        this.addUserErrorMessage =
          'Seleciona pelo menos um utilizador.';
      }

      return;
    }

    const teamId = this.teamId;

    const uniqueUserIds =
      Array.from(
        new Set(
          this.selectedUserIds,
        ),
      );

    this.isAddingUser = true;
    this.addUserErrorMessage = '';

    const requests = uniqueUserIds.map((userId) => {
      const payload: AddUserToTeamRequest = {
        teamId,
        userId,
      };

      return this.teamService
        .addUserToTeam(payload)
        .pipe(
          map(
            (): AddUserResult => ({
              userId,
              success: true,
            }),
          ),
          catchError((error) => {
            const result: AddUserResult = {
              userId,
              success: false,
              status: error?.status,
              message:
                typeof error?.error?.message === 'string'
                  ? error.error.message
                  : undefined,
            };

            return of(result);
          }),
        );
    });

    forkJoin(requests)
      .pipe(
        finalize(() => {
          this.isAddingUser = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (results) => {
          const successfulResults =
            results.filter(
              (result) =>
                result.success,
            );

          const failedResults =
            results.filter(
              (result) =>
                !result.success,
            );

          if (
            successfulResults.length
          ) {
            this.loadTeam(teamId);
          }

          if (
            !failedResults.length
          ) {
            this.closeModalAfterSuccess();

            return;
          }

          const duplicatedUsers =
            failedResults.filter(
              (result) =>
                result.status === 409,
            );

          const otherFailures =
            failedResults.filter(
              (result) =>
                result.status !== 409,
            );

          const failedUserIds = new Set(
            failedResults.map(
              (result) =>
                result.userId,
            ),
          );

          this.selectedUserIds =
            this.selectedUserIds.filter(
              (userId) =>
                failedUserIds.has(userId),
            );

          if (
            duplicatedUsers.length &&
            !otherFailures.length
          ) {
            this.addUserErrorMessage =
              duplicatedUsers.length === 1
                ? 'Um dos utilizadores selecionados já pertence à equipa.'
                : `${duplicatedUsers.length} dos utilizadores selecionados já pertencem à equipa.`;

            return;
          }

          if (
            successfulResults.length
          ) {
            this.addUserErrorMessage =
              `${successfulResults.length} utilizador${
                successfulResults.length ===
                1
                  ? ''
                  : 'es'
              } adicionado${
                successfulResults.length ===
                1
                  ? ''
                  : 's'
              }, mas não foi possível adicionar ${failedResults.length}.`;

            return;
          }

          this.addUserErrorMessage =
            failedResults[0]?.message ||
            'Não foi possível adicionar os utilizadores à equipa.';
        },
      });
  }

  getAddUsersButtonText(): string {
    if (this.isAddingUser) {
      return 'A adicionar...';
    }

    if (
      this.selectedUsersCount === 1
    ) {
      return 'Adicionar 1 utilizador';
    }

    if (
      this.selectedUsersCount > 1
    ) {
      return `Adicionar ${this.selectedUsersCount} utilizadores`;
    }

    return 'Adicionar à equipa';
  }

  getProfilePictureUrl(
    user: TeamUser | ProfileUser,
  ): string | null {
    if (!user.profilePicture) {
      return null;
    }

    return `${environment.apiUrl}/api/users/${user.id}/profile-picture`;
  }

  getInitial(name: string): string {
    return (
      name?.charAt(0).toUpperCase() ||
      '?'
    );
  }

  trackUserById(
    _index: number,
    user: ProfileUser,
  ): string {
    return user.id;
  }

  trackTeamUserById(
    _index: number,
    user: TeamUser,
  ): string {
    return user.id;
  }

  private closeModalAfterSuccess(): void {
    this.showAddUserModal = false;

    this.selectedUserIds = [];
    this.userSearch = '';

    this.availableUsers = [];
    this.filteredAvailableUsers = [];

    this.addUserErrorMessage = '';
  }

  private normalizeText(
    value: string | null | undefined,
  ): string {
    return (value || '')
      .trim()
      .toLocaleLowerCase('pt-PT')
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      );
  }
}