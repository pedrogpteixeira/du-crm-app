import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject } from '@angular/core';
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
import { SocketService, TeamChangedEvent, TeamsInvalidationEvent } from './socket';

export interface Team {
  id: string;
  name: string;
  role: string;
  positionList: string[];
  active: boolean;
  registrationNumber?: number;
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

export interface SetTeamActiveRequest {
  active: boolean;
}

export interface UpdateTeamPositionsRequest {
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

  private readonly teamsStateSubject = new BehaviorSubject<TeamsState>(INITIAL_TEAMS_STATE);

  readonly teamsState$ = this.teamsStateSubject.asObservable();

  private teamsRequest$: Observable<Team[]> | null = null;
  private readonly teamUsersRequests = new Map<string, Observable<TeamDetailResponse>>();
  private refreshTeamsAfterCurrentRequest = false;
  private hasObservedAuthenticatedSocketConnection = false;
  private lastIncrementalTeamEventAt = 0;

  constructor() {
    this.hasObservedAuthenticatedSocketConnection =
      this.socketService.isConnected() && this.auth.isAuthenticated();

    this.observeAuthentication();
    this.observeTeamsChanged();
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

  getTeamUsers(teamId: string): Observable<TeamDetailResponse> {
    const normalizedTeamId = teamId.trim();
    const existingRequest = this.teamUsersRequests.get(normalizedTeamId);
    if (existingRequest) {
      return existingRequest;
    }

    const request$ = this.http
      .get<TeamDetailResponse>(
        `${this.apiUrl}/api/team-users/team/${encodeURIComponent(normalizedTeamId)}`,
      )
      .pipe(
        finalize(() => {
          this.teamUsersRequests.delete(normalizedTeamId);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.teamUsersRequests.set(normalizedTeamId, request$);
    return request$;
  }

  createTeam(payload: CreateTeamRequest): Observable<Team> {
    return this.http
      .post<Team>(`${this.apiUrl}/api/teams`, payload)
      .pipe(tap((team) => this.upsertTeamInCache(team)));
  }

  setTeamActive(teamId: string, active: boolean): Observable<Team> {
    const payload: SetTeamActiveRequest = { active };

    return this.http
      .patch<Team>(`${this.apiUrl}/api/teams/${encodeURIComponent(teamId)}/active`, payload)
      .pipe(
        tap((team) => {
          this.upsertTeamInCache({
            ...team,
            id: team?.id || teamId,
            active,
          });
        }),
      );
  }

  updateTeamPositions(teamId: string, positionList: string[]): Observable<Team> {
    const payload: UpdateTeamPositionsRequest = {
      positionList,
    };

    return this.http
      .patch<Team>(`${this.apiUrl}/api/teams/${encodeURIComponent(teamId)}/positions`, payload)
      .pipe(
        tap((team) => {
          this.upsertTeamInCache({
            ...team,
            id: team?.id || teamId,
            positionList: Array.isArray(team?.positionList) ? team.positionList : positionList,
          });
        }),
      );
  }

  addUserToTeam(payload: AddUserToTeamRequest): Observable<TeamUser> {
    return this.http.post<TeamUser>(`${this.apiUrl}/api/team-users`, payload);
  }

  removeUserFromTeam(teamId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/api/team-users/team/${encodeURIComponent(teamId)}/user/${encodeURIComponent(
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

    const request$ = this.http.get<Team[]>(`${this.apiUrl}/api/teams`).pipe(
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

        if (this.refreshTeamsAfterCurrentRequest && this.auth.isAuthenticated()) {
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
    this.auth.authenticationState$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state) => {
      if (state === 'authenticated') {
        this.hasObservedAuthenticatedSocketConnection = this.socketService.isConnected();

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

  private observeTeamsChanged(): void {
    this.socketService
      .listenTeamsChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (!this.auth.isAuthenticated() || !event?.teamId) {
          return;
        }

        this.lastIncrementalTeamEventAt = Date.now();

        if (event.action === 'upsert' && event.team) {
          this.upsertTeamInCache({
            ...event.team,
            id: event.team.id || event.teamId,
          });
          return;
        }

        // A refresh event explicitly means the incremental payload is not
        // sufficient. Reconcile the shared list once instead of doing it for
        // every normal team mutation.
        if (event.action === 'refresh') {
          this.refreshTeamsInBackground();
        }
      });
  }

  private observeTeamsInvalidation(): void {
    this.socketService
      .listenTeamsInvalidated()
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (!this.auth.isAuthenticated()) {
          return;
        }

        if (this.shouldIgnoreLegacyInvalidation(event)) {
          return;
        }

        this.invalidateTeamsCache();
        this.refreshTeamsInBackground();
      });
  }

  private shouldIgnoreLegacyInvalidation(event: TeamsInvalidationEvent): boolean {
    const reason = (event?.reason ?? '').toLowerCase();

    if (/(import|bulk|wallet|balance|commission|reconcile)/.test(reason)) {
      return false;
    }

    const coveredByIncrementalReason =
      /(team|position|active|membership|member|user[_ -]?team)/.test(reason);

    return coveredByIncrementalReason || Date.now() - this.lastIncrementalTeamEventAt < 1500;
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

    const existingIndex = state.teams.findIndex((cachedTeam) => cachedTeam.id === team.id);

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
