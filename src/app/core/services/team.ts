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
  profilePicture?: string;
  positionIndex: number;
  position: string;
  role?: string;
}

export interface TeamDetailResponse {
  team: Team;
  users: TeamUser[];
}

export interface CreateTeamRequest {
  name: string;
  role: string;
  positionList: string[];
}

export interface AddUserToTeamRequest {
  teamId: string;
  userId: string;
  positionIndex: number;
}

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getTeams(): Observable<Team[]> {
    return this.http.get<Team[]>(
      `${this.apiUrl}/api/teams`,
    );
  }

  getTeamUsers(
    teamId: string,
  ): Observable<TeamDetailResponse> {
    return this.http.get<TeamDetailResponse>(
      `${this.apiUrl}/api/team-users/team/${teamId}`,
    );
  }

  createTeam(
    payload: CreateTeamRequest,
  ): Observable<Team> {
    return this.http.post<Team>(
      `${this.apiUrl}/api/teams`,
      payload,
    );
  }

  addUserToTeam(
    payload: AddUserToTeamRequest,
  ): Observable<TeamUser> {
    return this.http.post<TeamUser>(
      `${this.apiUrl}/api/team-users`,
      payload,
    );
  }

  removeUserFromTeam(
    teamId: string,
    userId: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/api/team-users/team/${encodeURIComponent(
        teamId,
      )}/user/${encodeURIComponent(
        userId,
      )}`,
    );
  }
}