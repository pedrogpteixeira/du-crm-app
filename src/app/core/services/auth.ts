import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment.development';
import { AuthUser } from '../models/auth-user';

interface LoginResponse {
  token: string;
  user: AuthUser;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private readonly currentUserSubject =
    new BehaviorSubject<AuthUser | null>(null);

  currentUser$ = this.currentUserSubject.asObservable();

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/api/auth/signin`, {
        username,
        password,
      })
      .pipe(
        tap((response) => {
          localStorage.setItem('token', response.token);
          localStorage.setItem(
            'preferences',
            JSON.stringify(response.user.preferences),
          );
          
          this.setCurrentUser(response.user);
        }),
      );
  }

  setCurrentUser(user: AuthUser | null): void {
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  loadCurrentUser(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.apiUrl}/api/users/me`).pipe(
      tap((user) => {
        this.setCurrentUser(user);

        if (user.preferences) {
          localStorage.setItem(
            'preferences',
            JSON.stringify(user.preferences),
          );
        }
      })
    );
  }

  hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('preferences');
    this.setCurrentUser(null);
  }
}