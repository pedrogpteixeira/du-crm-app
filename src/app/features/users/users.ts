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
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Auth } from '../../core/services/auth';
import { SocketService } from '../../core/services/socket';
import { Team, TeamService } from '../../core/services/team';
import {
  CreateUserRequest,
  ProfileUser,
  UserService,
} from '../../core/services/user';

interface UserFilters {
  search: string;
  role: string;
  team: string;
  status: '' | 'active' | 'inactive';
}

interface CreateUserForm {
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  teamId: string;
  positionIndex: number | null;
}

type FeedbackType = 'success' | 'warning' | 'error';

@Component({
  selector: 'app-users',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class Users implements OnInit {
  private readonly userService = inject(UserService);
  private readonly teamService = inject(TeamService);
  private readonly socketService = inject(SocketService);
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);

  users: ProfileUser[] = [];
  filteredUsers: ProfileUser[] = [];
  teams: Team[] = [];

  availableRoles: string[] = [];
  availableTeams: string[] = [];

  readonly pageSize = 20;
  currentPage = 1;

  private readonly teamNames = new Map<string, string>();

  readonly onlineUsers$ = this.socketService.onlineUsers$;

  filters: UserFilters = {
    search: '',
    role: '',
    team: '',
    status: '',
  };

  createUserForm: CreateUserForm = this.getEmptyCreateUserForm();

  teamSearch = '';

  isLoading = false;
  isRefreshing = false;
  isLoadingTeams = false;
  isCreatingUser = false;

  isSuperAdmin = false;

  errorMessage = '';
  createUserErrorMessage = '';
  teamsErrorMessage = '';
  feedbackMessage = '';
  feedbackType: FeedbackType = 'success';

  showFilters = false;
  showCreateUserModal = false;

  get totalPages(): number {
    return Math.max(
      1,
      Math.ceil(this.filteredUsers.length / this.pageSize),
    );
  }

  get visibleUsers(): ProfileUser[] {
    const start = (this.currentPage - 1) * this.pageSize;

    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  get visibleStart(): number {
    if (!this.filteredUsers.length) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get visibleEnd(): number {
    return Math.min(
      this.currentPage * this.pageSize,
      this.filteredUsers.length,
    );
  }

  get filteredCreateTeams(): Team[] {
    const searchedTeam = this.normalizeText(this.teamSearch);

    return this.teams
      .filter((team) => team.active)
      .filter(
        (team) =>
          !searchedTeam ||
          this.normalizeText(team.name).includes(searchedTeam),
      )
      .sort((first, second) =>
        first.name.localeCompare(second.name, 'pt'),
      );
  }

  get selectedCreateTeam(): Team | null {
    return (
      this.teams.find(
        (team) => team.id === this.createUserForm.teamId,
      ) ?? null
    );
  }

  get selectedTeamPositions(): string[] {
    return this.selectedCreateTeam?.positionList ?? [];
  }

  ngOnInit(): void {
    this.isSuperAdmin = this.auth.isSuperAdmin();
    this.observeUsersCache();
    this.loadUsers();

  }

  loadUsers(forceRefresh = false): void {
    const request$ = forceRefresh
      ? this.userService.refreshUsers()
      : this.userService.ensureUsersLoaded();

    request$.subscribe({
      error: () => undefined,
    });
  }

  loadTeams(): void {
    if (!this.isSuperAdmin || this.isLoadingTeams) {
      return;
    }

    this.isLoadingTeams = true;
    this.teamsErrorMessage = '';

    this.teamService
      .getTeams()
      .pipe(
        finalize(() => {
          this.isLoadingTeams = false;
        }),
      )
      .subscribe({
        next: (teams) => {
          this.teams = Array.isArray(teams) ? teams : [];
        },
        error: (error: HttpErrorResponse) => {
          this.teamsErrorMessage = this.getOperationError(
            error,
            'Não foi possível carregar as equipas.',
          );
        },
      });
  }

  applyFilters(resetPage = true): void {
    if (resetPage) {
      this.currentPage = 1;
    }

    const search = this.normalizeText(this.filters.search);
    const selectedRole = this.filters.role;
    const selectedTeam = this.filters.team;
    const selectedStatus = this.filters.status;

    this.filteredUsers = this.users.filter((user) => {
      const searchableValues = [
        user.name,
        user.username,
        user.email,
        user.role,
        user.defaultTeam?.name,
        ...(user.teams?.map((team) => team.name) ?? []),
      ];

      const matchesSearch =
        !search ||
        searchableValues.some((value) =>
          this.normalizeText(value).includes(search),
        );

      const matchesRole =
        !selectedRole || user.role === selectedRole;

      const matchesTeam =
        !selectedTeam ||
        user.teams?.some((team) => team.id === selectedTeam) ||
        user.defaultTeam?.id === selectedTeam;

      const matchesStatus =
        !selectedStatus ||
        (selectedStatus === 'active' && user.active) ||
        (selectedStatus === 'inactive' && !user.active);

      return (
        matchesSearch &&
        matchesRole &&
        matchesTeam &&
        matchesStatus
      );
    });

    if (!resetPage && this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
  }

  clearFilters(): void {
    this.filters = {
      search: '',
      role: '',
      team: '',
      status: '',
    };

    this.applyFilters();
    this.showFilters = false;
  }

  hasActiveFilters(): boolean {
    return Boolean(
      this.filters.search ||
        this.filters.role ||
        this.filters.team ||
        this.filters.status,
    );
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  getProfilePictureUrl(user: ProfileUser): string | null {
    if (!user.profilePicture) {
      return null;
    }

    return `${environment.apiUrl}/api/users/${user.id}/profile-picture`;
  }

  getInitial(name: string): string {
    return name?.charAt(0).toUpperCase() || '?';
  }

  isOnline(
    userId: string,
    onlineUsers: string[] | null,
  ): boolean {
    return Boolean(onlineUsers?.includes(userId));
  }

  getPrimaryTeamName(user: ProfileUser): string {
    return (
      user.defaultTeam?.name ||
      user.teams?.[0]?.name ||
      'Sem equipa'
    );
  }

  openCreateUserModal(): void {
    if (!this.isSuperAdmin) {
      return;
    }

    if (!this.teams.length && !this.isLoadingTeams) {
      this.loadTeams();
    }

    this.createUserForm = this.getEmptyCreateUserForm();
    this.teamSearch = '';
    this.createUserErrorMessage = '';
    this.showCreateUserModal = true;
  }

  closeCreateUserModal(): void {
    if (this.isCreatingUser) {
      return;
    }

    this.showCreateUserModal = false;
    this.createUserErrorMessage = '';
    this.teamSearch = '';
    this.createUserForm = this.getEmptyCreateUserForm();
  }

  onCreateTeamChange(): void {
    this.createUserForm.positionIndex = null;
  }

  createUser(): void {
    if (!this.isSuperAdmin || this.isCreatingUser) {
      return;
    }

    this.createUserErrorMessage = '';

    const validationMessage = this.validateCreateUserForm();

    if (validationMessage) {
      this.createUserErrorMessage = validationMessage;
      return;
    }

    const teamId = this.createUserForm.teamId.trim();
    const positionIndex = this.createUserForm.positionIndex;

    if (teamId && positionIndex === null) {
      this.createUserErrorMessage = 'Seleciona um cargo para a equipa escolhida.';
      return;
    }

    const teamAssignment =
      teamId && positionIndex !== null
        ? { teamId, positionIndex }
        : null;

    const phone = this.createUserForm.phone.trim();

    const payload: CreateUserRequest = {
      username: this.createUserForm.username.trim(),
      name: this.createUserForm.name.trim(),
      email: this.createUserForm.email.trim(),
      password: this.createUserForm.password,
      role: '',
      ...(phone ? { phone } : {}),
    };

    this.isCreatingUser = true;

    this.userService.createUser(payload).subscribe({
      next: (createdUser) => {
        if (!teamAssignment) {
          this.finishSuccessfulUserCreation();
          return;
        }

        this.teamService
          .addUserToTeam({
            teamId: teamAssignment.teamId,
            userId: createdUser.id,
            positionIndex: teamAssignment.positionIndex,
          })
          .subscribe({
            next: () => {
              this.userService
                .updateUser(createdUser.id, {
                  defaultTeam: teamAssignment.teamId,
                })
                .pipe(
                  finalize(() => {
                    this.isCreatingUser = false;
                  }),
                )
                .subscribe({
                  next: () => {
                    this.finishSuccessfulUserCreation();
                  },
                  error: (error: HttpErrorResponse) => {
                    this.finishPartialUserCreation(
                      error,
                      'O utilizador foi criado e associado à equipa, mas não foi possível definir a equipa principal.',
                    );
                  },
                });
            },
            error: (error: HttpErrorResponse) => {
              this.isCreatingUser = false;
              this.finishPartialUserCreation(
                error,
                'O utilizador foi criado como inativo, mas não foi possível associá-lo à equipa selecionada.',
              );
            },
          });
      },
      error: (error: HttpErrorResponse) => {
        this.isCreatingUser = false;
        this.createUserErrorMessage = this.getCreateUserError(error);
      },
    });
  }

  previousPage(): void {
    if (this.currentPage <= 1) {
      return;
    }

    this.currentPage -= 1;
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) {
      return;
    }

    this.currentPage += 1;
  }

  trackUserById(_index: number, user: ProfileUser): string {
    return user.id;
  }

  trackTeamById(_index: number, team: Team): string {
    return team.id;
  }

  dismissFeedback(): void {
    this.feedbackMessage = '';
  }

  private observeUsersCache(): void {
    this.userService.usersState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.isLoading = state.loading && !state.loaded;
        this.isRefreshing = state.loading && state.loaded;

        if (state.loaded) {
          this.users = state.users;
          this.buildFilterOptions();
          this.applyFilters(false);
        }

        this.errorMessage = state.error ?? '';
      });
  }

  private finishSuccessfulUserCreation(): void {
    this.isCreatingUser = false;
    this.showCreateUserModal = false;
    this.createUserForm = this.getEmptyCreateUserForm();
    this.teamSearch = '';

    this.showFeedback(
      'Utilizador criado com sucesso. O utilizador encontra-se inativo e deverá ser ativado depois da validação.',
      'success',
    );
  }

  private finishPartialUserCreation(
    error: HttpErrorResponse,
    fallbackMessage: string,
  ): void {
    this.showCreateUserModal = false;
    this.createUserForm = this.getEmptyCreateUserForm();
    this.teamSearch = '';

    const suffix =
      error.status === 403
        ? ' Não tem permissão para concluir esta operação.'
        : '';

    this.showFeedback(
      `${fallbackMessage}${suffix} O utilizador permanece inativo e pode ser encontrado através do filtro de inativos.`,
      'warning',
    );
  }

  private validateCreateUserForm(): string {
    const name = this.createUserForm.name.trim();
    const username = this.createUserForm.username.trim();
    const email = this.createUserForm.email.trim();
    const phone = this.createUserForm.phone.trim();
    const password = this.createUserForm.password;

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

    if (password.length < 7 || password.length > 100) {
      return 'A password deve ter entre 7 e 100 caracteres.';
    }

    if (!/[A-Z]/.test(password)) {
      return 'A password deve incluir pelo menos uma letra maiúscula.';
    }

    if (!/\d/.test(password)) {
      return 'A password deve incluir pelo menos um número.';
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'A password deve incluir pelo menos um carácter especial.';
    }

    if (password !== this.createUserForm.confirmPassword) {
      return 'As passwords não coincidem.';
    }

    if (
      this.createUserForm.teamId &&
      this.createUserForm.positionIndex === null
    ) {
      return 'Seleciona um cargo para a equipa escolhida.';
    }

    return '';
  }

  private buildFilterOptions(): void {
    this.availableRoles = Array.from(
      new Set(
        this.users
          .map((user) => user.role?.trim())
          .filter((role): role is string => Boolean(role)),
      ),
    ).sort((first, second) =>
      first.localeCompare(second, 'pt'),
    );

    this.teamNames.clear();

    this.users.forEach((user) => {
      user.teams?.forEach((team) => {
        this.teamNames.set(team.id, team.name);
      });

      if (user.defaultTeam) {
        this.teamNames.set(
          user.defaultTeam.id,
          user.defaultTeam.name,
        );
      }
    });

    this.availableTeams = Array.from(this.teamNames.entries())
      .sort((first, second) =>
        first[1].localeCompare(second[1], 'pt'),
      )
      .map(([teamId]) => teamId);
  }

  getTeamName(teamId: string): string {
    return this.teamNames.get(teamId) ?? teamId;
  }

  private getCreateUserError(error: HttpErrorResponse): string {
    if (error.status === 403) {
      return 'Não tem permissão para executar esta operação.';
    }

    if (error.status === 409) {
      return (
        this.extractApiMessage(error) ||
        'Já existe um utilizador com este username ou email.'
      );
    }

    return (
      this.extractApiMessage(error) ||
      'Não foi possível criar o utilizador.'
    );
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

  private normalizeText(value: string | null | undefined): string {
    return (value || '')
      .trim()
      .toLocaleLowerCase('pt-PT')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private getEmptyCreateUserForm(): CreateUserForm {
    return {
      name: '',
      username: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      teamId: '',
      positionIndex: null,
    };
  }
}
