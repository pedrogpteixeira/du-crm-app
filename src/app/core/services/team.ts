import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment.development';

export interface Team {
  id: string;
  name: string;
  role: string;
  positionList: string[];
  active: boolean;
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
}