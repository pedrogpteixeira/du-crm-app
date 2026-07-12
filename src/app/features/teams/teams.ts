import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Team, TeamService } from '../../core/services/team';

interface TeamFilters {
  name: string;
  role: string;
}

@Component({
  selector: 'app-teams',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './teams.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './teams.scss',
})
export class Teams implements OnInit {
  private readonly teamService = inject(TeamService);

  teams: Team[] = [];
  filteredTeams: Team[] = [];

  availableRoles: string[] = [];

  filters: TeamFilters = {
    name: '',
    role: '',
  };

  isLoading = false;
  errorMessage = '';
  showFilters = false;

  ngOnInit(): void {
    this.loadTeams();
  }

  loadTeams(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.teamService.getTeams().subscribe({
      next: (teams) => {
        this.teams = teams;

        this.buildFilterOptions();
        this.applyFilters();
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar as equipas.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  applyFilters(): void {
    const searchedName = this.normalizeText(this.filters.name);
    const selectedRole = this.filters.role;

    this.filteredTeams = this.teams.filter((team) => {
      const matchesName =
        !searchedName ||
        this.normalizeText(team.name).includes(searchedName);

      const matchesRole =
        !selectedRole ||
        team.role === selectedRole;

      return matchesName && matchesRole;
    });
  }

  clearFilters(): void {
    this.filters = {
      name: '',
      role: '',
      // no Users mantém também:
      // team: '',
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

  private buildFilterOptions(): void {
    this.availableRoles = Array.from(
      new Set(
        this.teams
          .map((team) => team.role?.trim())
          .filter((role): role is string => Boolean(role)),
      ),
    ).sort((first, second) =>
      first.localeCompare(second, 'pt'),
    );
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