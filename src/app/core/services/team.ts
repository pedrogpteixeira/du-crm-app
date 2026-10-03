import { HttpClient } from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  Observable,
  catchError,
  debounceTime,
  finalize,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';

import { environment } from '../../../environments/environment';
import { Auth } from './auth';
import { SocketService } from './socket';

export interface Team {
  id: string;
  name: string;
  role: string;
  positionList: string[];
  active: boolean;
  walletBalance?: number;
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

export interface TeamsState {
  teams: Team[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  lastLoadedAt: string | null;
}

const INITIAL_TEAMS_STATE: TeamsState = {
  teams: [],
  loading: false,
  loaded: false,
  error: null,
  lastLoadedAt: null,
};

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly socketService = inject(SocketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = environment.apiUrl;

  private readonly teamsStateSubject =
    new BehaviorSubject<TeamsState>(INITIAL_TEAMS_STATE);

  readonly teamsState$ = this.teamsStateSubject.asObservable();

  private teamsRequest$: Observable<Team[]> | null = null;
  private refreshTeamsAfterCurrentRequest = false;
  private hasObservedAuthenticatedSocketConnection = false;

  constructor() {
    this.hasObservedAuthenticatedSocketConnection =
      this.socketService.isConnected() && this.auth.isAuthenticated();

    this.observeAuthentication();
    this.observeTeamsInvalidation();
    this.observeSocketReconnect();
  }

  /**
   * Session cache for the complete Team list. It is warmed when authentication
   * completes and reused by every consumer. teams:invalidated forces a silent
   * background refresh so the cached list stays current across routes.
   */
  getTeams(): Observable<Team[]> {
    return this.ensureTeamsLoaded();
  }

  ensureTeamsLoaded(): Observable<Team[]> {
    const state = this.teamsStateSubject.value;

    if (state.loaded) {
      return of(state.teams);
    }

    return this.loadTeams(false);
  }

  refreshTeams(): Observable<Team[]> {
    if (this.teamsRequest$) {
      this.refreshTeamsAfterCurrentRequest = true;
      return this.teamsRequest$;
    }

    return this.loadTeams(true);
  }

  getTeamsSnapshot(): Team[] {
    return this.teamsStateSubject.value.teams;
  }

  isTeamsCacheLoaded(): boolean {
    return this.teamsStateSubject.value.loaded;
  }

  invalidateTeamsCache(): void {
    const state = this.teamsStateSubject.value;

    this.teamsStateSubject.next({
      ...state,
      loaded: false,
      error: null,
    });

    if (this.teamsRequest$) {
      this.refreshTeamsAfterCurrentRequest = true;
    }

  }

  clearTeamsCache(): void {
    this.refreshTeamsAfterCurrentRequest = false;
    this.teamsStateSubject.next({ ...INITIAL_TEAMS_STATE });
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
    return this.http
      .post<Team>(
        `${this.apiUrl}/api/teams`,
        payload,
      )
      .pipe(
        tap((team) => this.upsertTeamInCache(team)),
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

  private loadTeams(forceRefresh: boolean): Observable<Team[]> {
    const state = this.teamsStateSubject.value;

    if (!forceRefresh && state.loaded) {
      return of(state.teams);
    }

    if (this.teamsRequest$) {
      return this.teamsRequest$;
    }

    this.teamsStateSubject.next({
      ...state,
      loading: true,
      error: null,
    });

    const request$ = this.http
      .get<Team[]>(`${this.apiUrl}/api/teams`)
      .pipe(
        tap((teams) => {
          this.teamsStateSubject.next({
            teams: Array.isArray(teams) ? teams : [],
            loading: true,
            loaded: true,
            error: null,
            lastLoadedAt: new Date().toISOString(),
          });
        }),
        catchError((error) => {
          const currentState = this.teamsStateSubject.value;

          this.teamsStateSubject.next({
            ...currentState,
            loading: true,
            error: 'Não foi possível atualizar a lista de equipas.',
          });

          return throwError(() => error);
        }),
        finalize(() => {
          this.teamsRequest$ = null;

          const currentState = this.teamsStateSubject.value;
          this.teamsStateSubject.next({
            ...currentState,
            loading: false,
          });

          if (
            this.refreshTeamsAfterCurrentRequest &&
            this.auth.isAuthenticated()
          ) {
            this.refreshTeamsAfterCurrentRequest = false;

            queueMicrotask(() => {
              this.refreshTeams().subscribe({
                error: () => undefined,
              });
            });
          }
        }),
        shareReplay({
          bufferSize: 1,
          refCount: false,
        }),
      );

    this.teamsRequest$ = request$;
    return request$;
  }

  private observeAuthentication(): void {
    this.auth.authenticationState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state === 'authenticated') {
          this.hasObservedAuthenticatedSocketConnection =
            this.socketService.isConnected();

          // Teams are used throughout the authenticated CRM (contracts,
          // tickets, users, Autos, filters, etc.). Warm the shared cache as
          // soon as the session is ready so later consumers do not wait for
          // the first GET /teams.
          this.ensureTeamsLoaded().subscribe({
            error: () => undefined,
          });

          return;
        }

        if (state === 'unauthenticated') {
          this.hasObservedAuthenticatedSocketConnection = false;
          this.clearTeamsCache();
        }
      });
  }

  private observeTeamsInvalidation(): void {
    this.socketService
      .listenTeamsInvalidated()
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (!this.auth.isAuthenticated()) {
          return;
        }

        // teams:invalidated is global. Mark the shared cache as stale and
        // refresh it immediately in the background so every consumer sees the
        // updated Team data even when the Teams page is not mounted.
        this.invalidateTeamsCache();
        this.refreshTeamsInBackground();
      });
  }

  private observeSocketReconnect(): void {
    this.socketService
      .listenConnected()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.auth.isAuthenticated()) {
          return;
        }

        if (!this.hasObservedAuthenticatedSocketConnection) {
          this.hasObservedAuthenticatedSocketConnection = true;
          return;
        }

        // A reconnect may mean an invalidation event was missed while the
        // browser was offline or suspended. Force one silent refresh.
        this.invalidateTeamsCache();
        this.refreshTeamsInBackground();
      });
  }

  private refreshTeamsInBackground(): void {
    this.refreshTeams().subscribe({
      error: () => undefined,
    });
  }

  private upsertTeamInCache(team: Team): void {
    const state = this.teamsStateSubject.value;

    if (!state.loaded) {
      return;
    }

    const existingIndex = state.teams.findIndex(
      (cachedTeam) => cachedTeam.id === team.id,
    );

    const teams = [...state.teams];

    if (existingIndex >= 0) {
      teams[existingIndex] = {
        ...teams[existingIndex],
        ...team,
      };
    } else {
      teams.unshift(team);
    }

    this.teamsStateSubject.next({
      ...state,
      teams,
    });
  }
}
