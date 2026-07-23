import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import {
  BehaviorSubject,
  distinctUntilChanged,
  catchError,
  finalize,
  map,
  Observable,
  of,
  ReplaySubject,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthUser } from '../models/auth-user';

export type AuthenticationState =
  | 'initializing'
  | 'authenticated'
  | 'unauthenticated';

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

interface RefreshResponse {
  accessToken: string;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private accessToken: string | null = null;

  private readonly accessTokenSubject =
    new BehaviorSubject<string | null>(null);

  readonly accessToken$ = this.accessTokenSubject
    .asObservable()
    .pipe(
      distinctUntilChanged(),
    );

  private refreshInProgress = false;

  private refreshSubject =
    new ReplaySubject<string>(1);

  private readonly currentUserSubject =
    new BehaviorSubject<AuthUser | null>(null);

  private readonly authenticationStateSubject =
    new BehaviorSubject<AuthenticationState>('initializing');

  readonly authenticationState$ =
    this.authenticationStateSubject
      .asObservable()
      .pipe(
        distinctUntilChanged(),
      );

  readonly currentUser$ = this.currentUserSubject.asObservable();

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  login(
    identifier: string,
    password: string,
  ): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        `${this.apiUrl}/api/auth/signin`,
        {
          identifier,
          password,
        },
        {
          withCredentials: true,
        },
      )
      .pipe(
        tap((response) => {
          this.setAccessToken(response.accessToken);
          this.setCurrentUser(response.user);
          this.setAuthenticationState('authenticated');

          this.saveUserPreferences(response.user);
        }),
      );
  }

  // ---------------------------------------------------------------------------
  // Session restoration
  // ---------------------------------------------------------------------------

  restoreSession(): Observable<boolean> {
    this.setAuthenticationState('initializing');

    return this.refresh().pipe(
      switchMap(() => this.loadCurrentUser()),

      map(() => true),

      catchError(() => {
        this.clearSession();

        return of(false);
      }),
    );
  }

  refresh(): Observable<string> {
    if (this.refreshInProgress) {
      return this.refreshSubject.asObservable();
    }

    this.refreshInProgress = true;
    this.refreshSubject = new ReplaySubject<string>(1);

    return this.http
      .post<RefreshResponse>(
        `${this.apiUrl}/api/auth/refresh`,
        {},
        {
          withCredentials: true,
        },
      )
      .pipe(
        tap((response) => {
          this.setAccessToken(response.accessToken);

          this.refreshSubject.next(response.accessToken);
          this.refreshSubject.complete();
        }),

        map((response) => response.accessToken),

        catchError((error) => {
          this.clearSession();

          this.refreshSubject.error(error);

          return throwError(() => error);
        }),

        finalize(() => {
          this.refreshInProgress = false;
        }),
      );
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  logout(): void {
    const accessToken = this.getAccessToken();

    this.clearSession();

    this.http
      .post<void>(
        `${this.apiUrl}/api/auth/logout`,
        {},
        {
          withCredentials: true,
          headers: accessToken
            ? {
                Authorization:
                  `Bearer ${accessToken}`,
              }
            : {},
        },
      )
      .pipe(
        catchError(() => of(undefined)),
      )
      .subscribe();
  }

  logoutAll(): void {
    this.clearSession();

    this.http
      .post<void>(
        `${this.apiUrl}/api/auth/logout-all`,
        {},
        {
          withCredentials: true,
        },
      )
      .pipe(
        catchError(() => of(undefined)),
      )
      .subscribe();
  }

  // ---------------------------------------------------------------------------
  // Access token
  // ---------------------------------------------------------------------------

  setAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
    this.accessTokenSubject.next(accessToken);
  }

  clearAccessToken(): void {
    this.accessToken = null;
    this.accessTokenSubject.next(null);
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  // ---------------------------------------------------------------------------
  // Current user
  // ---------------------------------------------------------------------------

  setCurrentUser(user: AuthUser | null): void {
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  loadCurrentUser(): Observable<AuthUser> {
    return this.http
      .get<AuthUser>(
        `${this.apiUrl}/api/users/me`,
        {
          withCredentials: true,
        },
      )
      .pipe(
        tap((user) => {
          this.setCurrentUser(user);
          this.setAuthenticationState('authenticated');

          this.saveUserPreferences(user);
        }),
      );
  }

  // ---------------------------------------------------------------------------
  // Authentication state
  // ---------------------------------------------------------------------------

  initializeAuthentication(): Observable<boolean> {
    if (
      this.getAuthenticationState() !== 'initializing'
    ) {
      return of(this.isAuthenticated());
    }

    return this.restoreSession();
  }

  getAuthenticationState(): AuthenticationState {
    return this.authenticationStateSubject.value;
  }

  setAuthenticationState(
    state: AuthenticationState,
  ): void {
    this.authenticationStateSubject.next(state);
  }

  isAuthenticated(): boolean {
    return (
      this.getAuthenticationState() === 'authenticated' &&
      this.getAccessToken() !== null
    );
  }

  // ---------------------------------------------------------------------------
  // Session cleanup
  // ---------------------------------------------------------------------------

  clearSession(): void {
    this.clearAccessToken();
    this.setCurrentUser(null);
    this.setAuthenticationState('unauthenticated');

    localStorage.removeItem('preferences');
    localStorage.removeItem('token');
  }

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  roleIncludes(requiredRoles: string | string[]): boolean {
    const user = this.getCurrentUser();
    const role = user?.role || '';

    const roles = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];

    return roles.some((requiredRole) =>
      role
        .toLowerCase()
        .includes(requiredRole.toLowerCase()),
    );
  }

  // ---------------------------------------------------------------------------
  // Preferences
  // ---------------------------------------------------------------------------

  private saveUserPreferences(user: AuthUser): void {
    if (!user.preferences) {
      localStorage.removeItem('preferences');

      return;
    }

    localStorage.setItem(
      'preferences',
      JSON.stringify(user.preferences),
    );
  }
}