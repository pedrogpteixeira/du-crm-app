import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment.development';

interface LoginRequest {
  username: string;
  password: string;
}

interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  active: boolean;
  defaultTeam: string;
}

interface AuthResponse {
  user: AuthUser;
  token: string;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);

  private readonly tokenKey = 'token';

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(environment.apiUrl + '/api/auth/signin', data).pipe(
      tap((response) => {
        localStorage.setItem(this.tokenKey, response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
      }),
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('user');
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();

    if (!token) {
      return false;
    }

    if (this.isTokenExpired(token)) {
      this.logout();
      return false;
    }

    return true;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      if (!payload.exp) {
        return false;
      }

      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }
}