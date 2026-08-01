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

  selectedUserPositions: Record<
    string,
    number | null
  > = {};

  userSearch = '';

  isLoading = false;
  isLoadingUsers = false;
  isAddingUser = false;
  removingUserId = '';

  showAddUserModal = false;

  errorMessage = '';
  successMessage = '';
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

  get canSubmitSelectedUsers(): boolean {
    return (
      this.selectedUserIds.length > 0 &&
      this.selectedUserIds.every(
        (userId) =>
          this.hasValidSelectedPosition(
            userId,
          ),
      )
    );
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
          this.users = [
            ...(response.users || []),
          ].sort(
            (firstUser, secondUser) =>
              firstUser.positionIndex -
              secondUser.positionIndex,
          );
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

    this.resetUserSelection();

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

    this.resetUserSelection();

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

      this.removeSelectedUserPosition(
        userId,
      );

      return;
    }

    this.selectedUserIds = [
      ...this.selectedUserIds,
      userId,
    ];

    this.selectedUserPositions = {
      ...this.selectedUserPositions,
      [userId]: null,
    };

    this.addUserErrorMessage = '';
  }

  isUserSelected(
    userId: string,
  ): boolean {
    return this.selectedUserIds.includes(
      userId,
    );
  }

  setSelectedUserPosition(
    userId: string,
    positionIndex: number | null,
  ): void {
    if (
      !this.isUserSelected(userId) ||
      this.isAddingUser
    ) {
      return;
    }

    this.selectedUserPositions = {
      ...this.selectedUserPositions,
      [userId]: positionIndex,
    };

    this.addUserErrorMessage = '';
  }

  getSelectedUserPosition(
    userId: string,
  ): number | null {
    return (
      this.selectedUserPositions[userId] ??
      null
    );
  }

  hasValidSelectedPosition(
    userId: string,
  ): boolean {
    const positionIndex =
      this.getSelectedUserPosition(userId);

    return Boolean(
      this.team &&
      Number.isInteger(positionIndex) &&
      positionIndex !== null &&
      positionIndex >= 0 &&
      positionIndex <
        this.team.positionList.length,
    );
  }

  clearSelectedUsers(): void {
    if (this.isAddingUser) {
      return;
    }

    this.resetUserSelection();
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

    const nextPositions = {
      ...this.selectedUserPositions,
    };

    visibleUserIds.forEach(
      (userId) => {
        if (
          nextPositions[userId] ===
          undefined
        ) {
          nextPositions[userId] = null;
        }
      },
    );

    this.selectedUserPositions =
      nextPositions;

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

      const nextPositions = {
        ...this.selectedUserPositions,
      };

      visibleUserIds.forEach(
        (userId) => {
          delete nextPositions[userId];
        },
      );

      this.selectedUserPositions =
        nextPositions;

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

    if (!this.canSubmitSelectedUsers) {
      this.addUserErrorMessage =
        'Seleciona uma posição para todos os utilizadores escolhidos.';

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
        positionIndex:
          this.selectedUserPositions[
            userId
          ] as number,
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

          this.selectedUserPositions =
            Object.fromEntries(
              Object.entries(
                this.selectedUserPositions,
              ).filter(([userId]) =>
                failedUserIds.has(userId),
              ),
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

  removeUserFromTeam(
    user: TeamUser,
  ): void {
    if (
      !this.canManageTeamUsers ||
      !this.teamId ||
      this.removingUserId
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Tens a certeza que pretendes remover ${user.name} desta equipa?`,
    );

    if (!confirmed) {
      return;
    }

    const previousUsers = [...this.users];

    this.removingUserId = user.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.users = this.users.filter(
      (teamUser) =>
        teamUser.id !== user.id,
    );

    this.teamService
      .removeUserFromTeam(
        this.teamId,
        user.id,
      )
      .pipe(
        finalize(() => {
          this.removingUserId = '';
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.successMessage =
            `${user.name} foi removido da equipa com sucesso.`;

          window.setTimeout(() => {
            this.successMessage = '';
            this.cdr.detectChanges();
          }, 5000);
        },
        error: (error) => {
          this.users = previousUsers;

          this.errorMessage =
            error?.error?.message ||
            'Não foi possível remover o utilizador da equipa.';
        },
      });
  }

  isRemovingUser(
    userId: string,
  ): boolean {
    return this.removingUserId === userId;
  }

  getTeamUserPositionLabel(
    user: TeamUser,
  ): string {
    const position =
      user.position?.trim() ||
      this.team?.positionList[
        user.positionIndex
      ]?.trim() ||
      'Sem posição selecionada';

    const teamRole =
      this.team?.role?.trim();

    return teamRole
      ? `${teamRole} - ${position}`
      : position;
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

  private resetUserSelection(): void {
    this.selectedUserIds = [];
    this.selectedUserPositions = {};
  }

  private removeSelectedUserPosition(
    userId: string,
  ): void {
    const nextPositions = {
      ...this.selectedUserPositions,
    };

    delete nextPositions[userId];

    this.selectedUserPositions =
      nextPositions;
  }

  private closeModalAfterSuccess(): void {
    this.showAddUserModal = false;

    this.resetUserSelection();

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

  isFirstUserOfPosition(
    index: number,
    user: TeamUser,
  ): boolean {
    if (index === 0) {
      return true;
    }

    return (
      this.users[index - 1]
        ?.positionIndex !==
      user.positionIndex
    );
  }

  getPositionGroupLabel(
    user: TeamUser,
  ): string {
    return (
      user.position?.trim() ||
      this.team?.positionList[
        user.positionIndex
      ]?.trim() ||
      'Sem posição definida'
    );
  }
}