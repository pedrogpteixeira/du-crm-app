import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Team {
  id: string;
  name: string;
  role: string;
  positionList: string[];
  active: boolean;
}

export interface TeamUser {
  id: string;
  name: string;
  role: string;
  profilePicture?: string;
}

export interface TeamDetailResponse {
  team: Team;
  users: TeamUser[];
}

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getTeams(): Observable<Team[]> {
    return this.http.get<Team[]>(`${this.apiUrl}/api/teams`);
  }

  getTeamUsers(teamId: string): Observable<TeamDetailResponse> {
    return this.http.get<TeamDetailResponse>(
      `${this.apiUrl}/api/team-users/team/${teamId}`,
    );
  }
}