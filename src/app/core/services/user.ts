import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface UpdateProfilePictureResponse {
  profilePicture: string;
}

export interface UserTeam {
  id: string;
  name: string;
}

export interface ProfileUser {
  id: string;
  username: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  active: boolean;
  defaultTeam: UserTeam | null;
  teams: UserTeam[];
  profilePicture?: string;
  createdAt?: string;
  lastAccess?: string;
}

export interface UpdateUserRequest {
  name: string;
  email: string;
  phone: string;
  defaultTeam: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/users`;

  getUserById(id: string): Observable<ProfileUser> {
    return this.http.get<ProfileUser>(
      `${this.apiUrl}/${id}`,
    );
  }

  getUsers(): Observable<ProfileUser[]> {
    return this.http.get<ProfileUser[]>(this.apiUrl);
  }

  updateProfilePicture(userId: string, file: File): Observable<UpdateProfilePictureResponse> {
    const formData = new FormData();
    formData.append('profilePicture', file);

    return this.http.patch<UpdateProfilePictureResponse>(
      `${this.apiUrl}/${userId}/profile-picture`,
      formData,
    );
  }

  updateUser(id: string, data: UpdateUserRequest): Observable<ProfileUser> {
    return this.http.patch<ProfileUser>(`${this.apiUrl}/${id}`, data);
  }
}