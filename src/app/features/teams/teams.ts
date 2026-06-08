import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  Team,
  TeamService,
} from '../../core/services/team';

@Component({
  selector: 'app-teams',
  imports: [CommonModule, RouterLink],
  templateUrl: './teams.html',
  styleUrl: './teams.scss',
})
export class Teams implements OnInit {
  private readonly teamService = inject(TeamService);

  teams: Team[] = [];

  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadTeams();
  }

  loadTeams(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.teamService.getTeams().subscribe({
      next: (teams) => {
        this.teams = teams;
      },
      error: () => {
        this.errorMessage =
          'Não foi possível carregar as equipas.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }
}