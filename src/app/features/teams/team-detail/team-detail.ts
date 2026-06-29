import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment.development';

import { Team, TeamService, TeamUser } from '../../../core/services/team';

@Component({
  selector: 'app-team-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './team-detail.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './team-detail.scss',
})
export class TeamDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly teamService = inject(TeamService);

  teamId: string | null = null;

  team: Team | null = null;
  users: TeamUser[] = [];

  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.teamId = params.get('id');

      if (this.teamId) {
        this.loadTeam(this.teamId);
      }
    });
  }

  loadTeam(teamId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.teamService.getTeamUsers(teamId).subscribe({
      next: (response) => {
        this.team = response.team;
        this.users = response.users;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar a equipa.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  getProfilePictureUrl(user: TeamUser): string | null {
    if (!user.profilePicture) {
      return null;
    }

    return `${environment.apiUrl}/api/users/${user.id}/profile-picture`;
  }

  getInitial(name: string): string {
    return name?.charAt(0).toUpperCase() || '?';
  }
}
