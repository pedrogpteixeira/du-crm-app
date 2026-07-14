import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Auth } from '../../core/services/auth';
import {
  CreateTeamRequest,
  Team,
  TeamService,
} from '../../core/services/team';

interface TeamFilters {
  name: string;
  role: string;
}

interface CreateTeamForm {
  name: string;
  role: string;
  positionList: string[];
}

@Component({
  selector: 'app-teams',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
  ],
  templateUrl: './teams.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './teams.scss',
})
export class Teams implements OnInit {
  private readonly teamService =
    inject(TeamService);

  private readonly auth =
    inject(Auth);

  private readonly cdr =
    inject(ChangeDetectorRef);

  teams: Team[] = [];
  filteredTeams: Team[] = [];

  availableRoles: string[] = [];

  filters: TeamFilters = {
    name: '',
    role: '',
  };

  createTeamForm: CreateTeamForm = {
    name: '',
    role: '',
    positionList: [''],
  };

  isLoading = false;
  isCreatingTeam = false;

  errorMessage = '';
  createTeamErrorMessage = '';

  showFilters = false;
  showCreateTeamModal = false;

  ngOnInit(): void {
    this.loadTeams();
  }

  get canCreateTeam(): boolean {
    return this.auth.roleIncludes(
      'Super Admin',
    );
  }

  loadTeams(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.teamService
      .getTeams()
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (teams) => {
          this.teams = teams;

          this.buildFilterOptions();
          this.applyFilters();
        },
        error: () => {
          this.errorMessage =
            'Não foi possível carregar as equipas.';
        },
      });
  }

  applyFilters(): void {
    const searchedName =
      this.normalizeText(this.filters.name);

    const selectedRole =
      this.filters.role;

    this.filteredTeams =
      this.teams.filter((team) => {
        const matchesName =
          !searchedName ||
          this.normalizeText(
            team.name,
          ).includes(searchedName);

        const matchesRole =
          !selectedRole ||
          team.role === selectedRole;

        return (
          matchesName &&
          matchesRole
        );
      });
  }

  clearFilters(): void {
    this.filters = {
      name: '',
      role: '',
    };

    this.applyFilters();
    this.showFilters = false;
  }

  hasActiveFilters(): boolean {
    return Boolean(
      this.filters.name ||
      this.filters.role,
    );
  }

  toggleFilters(): void {
    this.showFilters =
      !this.showFilters;
  }

  closeFilters(): void {
    this.showFilters = false;
  }

  openCreateTeamModal(): void {
    if (!this.canCreateTeam) {
      return;
    }

    this.resetCreateTeamForm();
    this.createTeamErrorMessage = '';
    this.showCreateTeamModal = true;
  }

  closeCreateTeamModal(): void {
    if (this.isCreatingTeam) {
      return;
    }

    this.showCreateTeamModal = false;
    this.createTeamErrorMessage = '';
    this.resetCreateTeamForm();
  }

  addPosition(): void {
    this.createTeamForm.positionList.push(
      '',
    );
  }

  removePosition(index: number): void {
    if (
      this.createTeamForm.positionList.length ===
      1
    ) {
      this.createTeamForm.positionList[0] =
        '';

      return;
    }

    this.createTeamForm.positionList =
      this.createTeamForm.positionList.filter(
        (_, positionIndex) =>
          positionIndex !== index,
      );
  }

  createTeam(): void {
    if (
      !this.canCreateTeam ||
      this.isCreatingTeam
    ) {
      return;
    }

    this.createTeamErrorMessage = '';

    const name =
      this.createTeamForm.name.trim();

    const role =
      this.createTeamForm.role.trim();

    const positionList =
      this.createTeamForm.positionList
        .map((position) =>
          position.trim(),
        )
        .filter(Boolean);

    const uniquePositions =
      Array.from(
        new Set(positionList),
      );

    if (!name) {
      this.createTeamErrorMessage =
        'O nome da equipa é obrigatório.';

      return;
    }

    if (!role) {
      this.createTeamErrorMessage =
        'A função da equipa é obrigatória.';

      return;
    }

    if (!uniquePositions.length) {
      this.createTeamErrorMessage =
        'Adiciona pelo menos um cargo.';

      return;
    }

    const payload: CreateTeamRequest = {
      name,
      role,
      positionList:
        uniquePositions,
    };

    this.isCreatingTeam = true;

    this.teamService
      .createTeam(payload)
      .pipe(
        finalize(() => {
          this.isCreatingTeam = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (createdTeam) => {
          this.teams = [
            createdTeam,
            ...this.teams,
          ];

          this.buildFilterOptions();
          this.applyFilters();

          this.showCreateTeamModal = false;
          this.resetCreateTeamForm();
        },
        error: (error) => {
          if (error?.status === 409) {
            this.createTeamErrorMessage =
              'Já existe uma equipa com este nome.';

            return;
          }

          this.createTeamErrorMessage =
            error?.error?.message ||
            'Não foi possível criar a equipa.';
        },
      });
  }

  trackPositionByIndex(
    index: number,
  ): number {
    return index;
  }

  private resetCreateTeamForm(): void {
    this.createTeamForm = {
      name: '',
      role: '',
      positionList: [''],
    };
  }

  private buildFilterOptions(): void {
    this.availableRoles = Array.from(
      new Set(
        this.teams
          .map((team) =>
            team.role?.trim(),
          )
          .filter(
            (role): role is string =>
              Boolean(role),
          ),
      ),
    ).sort((first, second) =>
      first.localeCompare(
        second,
        'pt',
      ),
    );
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