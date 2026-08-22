import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { SocketService } from '../../core/services/socket';
import {
  ProfileUser,
  UserService,
} from '../../core/services/user';

import { environment } from '../../../environments/environment';
import { Auth } from '../../core/services/auth';

interface UserFilters {
  name: string;
  role: string;
  team: string;
}

@Component({
  selector: 'app-users',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
  ],
  templateUrl: './users.html',
  styleUrl: './users.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class Users implements OnInit {
  private readonly userService = inject(UserService);
  private readonly socketService = inject(SocketService);
  private readonly auth = inject(Auth);

  users: ProfileUser[] = [];
  filteredUsers: ProfileUser[] = [];

  availableRoles: string[] = [];
  availableTeams: string[] = [];

  readonly pageSize = 20;
  currentPage = 1;

  private readonly teamNames =
    new Map<string, string>();

  readonly onlineUsers$ = this.socketService.onlineUsers$;

  filters: UserFilters = {
    name: '',
    role: '',
    team: '',
  };

  isLoading = false;
  errorMessage = '';
  showFilters = false;

  readonly currentUserId = this.auth.getCurrentUser()?.id ?? null;

  get totalPages(): number {
    return Math.max(
      1,
      Math.ceil(
        this.filteredUsers.length /
        this.pageSize,
      ),
    );
  }

  get visibleUsers(): ProfileUser[] {
    const start =
      (this.currentPage - 1) *
      this.pageSize;

    return this.filteredUsers.slice(
      start,
      start + this.pageSize,
    );
  }

  get visibleStart(): number {
    if (!this.filteredUsers.length) {
      return 0;
    }

    return (
      (this.currentPage - 1) *
        this.pageSize +
      1
    );
  }

  get visibleEnd(): number {
    return Math.min(
      this.currentPage *
        this.pageSize,
      this.filteredUsers.length,
    );
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.userService
      .getUsers()
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (users) => {
          this.users = users;

          this.buildFilterOptions();
          this.applyFilters();
        },
        error: (error) => {
          console.error('Erro ao carregar utilizadores:', error);

          this.errorMessage =
            error?.error?.message ||
            'Não foi possível carregar os utilizadores.';
        },
      });
  }

  applyFilters(): void {
    this.currentPage = 1;

    const searchedName = this.normalizeText(this.filters.name);
    const selectedRole = this.filters.role;
    const selectedTeam = this.filters.team;

    this.filteredUsers = this.users.filter((user) => {
      const matchesName =
        !searchedName ||
        this.normalizeText(user.name).includes(searchedName);

      const matchesRole =
        !selectedRole ||
        user.role === selectedRole;

      const matchesTeam =
        !selectedTeam ||
        user.teams?.some((team) => team.id === selectedTeam) ||
        user.defaultTeam?.id === selectedTeam;

      return matchesName && matchesRole && matchesTeam;
    });
  }

  clearFilters(): void {
    this.filters = {
      name: '',
      role: '',
      team: '',
    };

    this.applyFilters();
    this.showFilters = false;
  }

  hasActiveFilters(): boolean {
    return Boolean(
      this.filters.name ||
      this.filters.role ||
      this.filters.team,
    );
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

  private buildFilterOptions(): void {
    this.availableRoles = Array.from(
      new Set(
        this.users
          .map((user) => user.role?.trim())
          .filter(
            (role): role is string =>
              Boolean(role),
          ),
      ),
    ).sort((first, second) =>
      first.localeCompare(second, 'pt'),
    );

    this.teamNames.clear();

    this.users.forEach((user) => {
      user.teams?.forEach((team) => {
        this.teamNames.set(
          team.id,
          team.name,
        );
      });

      if (user.defaultTeam) {
        this.teamNames.set(
          user.defaultTeam.id,
          user.defaultTeam.name,
        );
      }
    });

    this.availableTeams =
      Array.from(
        this.teamNames.entries(),
      )
        .sort((first, second) =>
          first[1].localeCompare(
            second[1],
            'pt',
          ),
        )
        .map(([teamId]) => teamId);
  }

  getTeamName(teamId: string): string {
    return (
      this.teamNames.get(teamId) ??
      teamId
    );
  }

  previousPage(): void {
    if (this.currentPage <= 1) {
      return;
    }

    this.currentPage -= 1;
  }

  nextPage(): void {
    if (
      this.currentPage >=
      this.totalPages
    ) {
      return;
    }

    this.currentPage += 1;
  }

  trackUserById(
    _index: number,
    user: ProfileUser,
  ): string {
    return user.id;
  }

  private normalizeText(value: string | null | undefined): string {
    return (value || '')
      .trim()
      .toLocaleLowerCase('pt-PT')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  closeFilters(): void {
    this.showFilters = false;
  }
}