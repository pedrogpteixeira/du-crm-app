import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
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
import {
  AssignableUsersInvalidationEvent,
  SocketService,
  TeamChangedEvent,
  TeamMembershipChangedEvent,
  TeamsInvalidationEvent,
  UserChangedEvent,
} from './socket';
import { Team, TeamService } from './team';
import type { ContractLayout } from './preferences';

export interface UpdateProfilePictureResponse {
  profilePicture: string;
}

export interface UserTeam {
  id: string;
  name: string;
  registrationNumber?: string | number | null;
  positionIndex?: number;
  position?: string;
  active?: boolean;
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

export interface CreateUserRequest {
  username: string;
  name: string;
  email: string;
  password: string;
  contractLayout: ContractLayout;
  phone?: string;
  role?: string;
  defaultTeam?: string;
}

export interface UpdateUserRequest {
  username?: string;
  name?: string;
  email?: string;
  phone?: string;
  defaultTeam?: string;
}

export interface UpdateUserRoleRequest {
  role: string;
}

export interface SetUserActiveRequest {
  active: boolean;
}

export interface UsersState {
  users: ProfileUser[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  lastLoadedAt: string | null;
}

export interface AssignableUsersState {
  users: ProfileUser[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  lastLoadedAt: string | null;
}

const INITIAL_USERS_STATE: UsersState = {
  users: [],
  loading: false,
  loaded: false,
  error: null,
  lastLoadedAt: null,
};

const INITIAL_ASSIGNABLE_USERS_STATE: AssignableUsersState = {
  users: [],
  loading: false,
  loaded: false,
  error: null,
  lastLoadedAt: null,
};

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly socketService = inject(SocketService);
  private readonly teamService = inject(TeamService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = `${environment.apiUrl}/api/users`;

  private readonly usersStateSubject = new BehaviorSubject<UsersState>(INITIAL_USERS_STATE);

  readonly usersState$ = this.usersStateSubject.asObservable();

  private readonly assignableUsersStateSubject = new BehaviorSubject<AssignableUsersState>(
    INITIAL_ASSIGNABLE_USERS_STATE,
  );

  readonly assignableUsersState$ = this.assignableUsersStateSubject.asObservable();

  private usersRequest$: Observable<ProfileUser[]> | null = null;
  private readonly userByIdRequests = new Map<string, Observable<ProfileUser>>();
  private assignableUsersRequest$: Observable<ProfileUser[]> | null = null;
  private refreshUsersAfterCurrentRequest = false;
  private refreshAssignableUsersAfterCurrentRequest = false;
  private hasObservedAuthenticatedSocketConnection = false;
  private lastIncrementalUserEventAt = 0;
  private lastIncrementalTeamEventAt = 0;

  constructor() {
    this.observeAuthentication();
    this.observeUsersChanged();
    this.observeTeamMembershipChanged();
    this.observeTeamsChanged();
    this.observeAssignableUsersInvalidation();
    this.observeTeamsInvalidation();
    this.observeSocketReconnect();
  }

  getUserById(id: string): Observable<ProfileUser> {
    const userId = id.trim();
    const existingRequest = this.userByIdRequests.get(userId);
    if (existingRequest) {
      return existingRequest;
    }

    const request$ = this.http.get<ProfileUser>(`${this.apiUrl}/${userId}`).pipe(
      finalize(() => {
        this.userByIdRequests.delete(userId);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.userByIdRequests.set(userId, request$);
    return request$;
  }

  /**
   * Full user list cache. For Super Admin sessions it is warmed in the
   * background as soon as authentication completes, so screens that depend on
   * the complete list do not have to wait for the large GET /users request.
   */
  getUsers(): Observable<ProfileUser[]> {
    return this.ensureUsersLoaded();
  }

  ensureUsersLoaded(): Observable<ProfileUser[]> {
    const state = this.usersStateSubject.value;

    if (state.loaded) {
      return of(state.users);
    }

    return this.loadUsers(false);
  }

  refreshUsers(): Observable<ProfileUser[]> {
    if (this.usersRequest$) {
      this.refreshUsersAfterCurrentRequest = true;
      return this.usersRequest$;
    }

    return this.loadUsers(true);
  }

  getUsersSnapshot(): ProfileUser[] {
    return this.usersStateSubject.value.users;
  }

  isUsersCacheLoaded(): boolean {
    return this.usersStateSubject.value.loaded;
  }

  clearUsersCache(): void {
    this.refreshUsersAfterCurrentRequest = false;
    this.usersStateSubject.next({ ...INITIAL_USERS_STATE });
  }

  /**
   * Returns the session cache of assignable users when it is already loaded.
   * If the cache is still cold, starts (or joins) the single in-flight request.
   */
  getAssignableUsers(): Observable<ProfileUser[]> {
    return this.ensureAssignableUsersLoaded();
  }

  ensureAssignableUsersLoaded(): Observable<ProfileUser[]> {
    const state = this.assignableUsersStateSubject.value;

    if (state.loaded) {
      return of(state.users);
    }

    return this.loadAssignableUsers(false);
  }

  refreshAssignableUsers(): Observable<ProfileUser[]> {
    if (this.assignableUsersRequest$) {
      this.refreshAssignableUsersAfterCurrentRequest = true;
      return this.assignableUsersRequest$;
    }

    return this.loadAssignableUsers(true);
  }

  getAssignableUsersSnapshot(): ProfileUser[] {
    return this.assignableUsersStateSubject.value.users;
  }

  /**
   * Resolve as equipas válidas para persistência num contrato.
   * `user.teams` fornece a associação/posição do utilizador; o cache global
   * de equipas fornece o estado atual e o nome da equipa quando disponível.
   */
  getAssignableContractTeams(user: ProfileUser): UserTeam[] {
    const cachedTeamsById = new Map(
      this.teamService
        .getTeamsSnapshot()
        .filter((team) => Boolean(team?.id))
        .map((team) => [team.id, team] as const),
    );

    return (user.teams ?? [])
      .filter((membership) => {
        if (
          !membership?.id ||
          !Number.isInteger(membership.positionIndex) ||
          Number(membership.positionIndex) < 0
        ) {
          return false;
        }

        const cachedTeam = cachedTeamsById.get(membership.id);

        return cachedTeam ? cachedTeam.active !== false : membership.active !== false;
      })
      .map((membership) => {
        const cachedTeam = cachedTeamsById.get(membership.id);

        return {
          ...membership,
          name: cachedTeam?.name?.trim() || membership.name,
          active: cachedTeam?.active ?? membership.active,
        };
      });
  }

  applyTeamSnapshot(team: Team): void {
    if (!team?.id) {
      return;
    }

    this.applyTeamChangedEvent({
      action: 'upsert',
      teamId: team.id,
      team: {
        id: team.id,
        name: team.name,
        registrationNumber: team.registrationNumber,
        role: team.role,
        positionList: team.positionList,
        active: team.active,
        walletBalance: team.walletBalance,
      },
      timestamp: new Date().toISOString(),
    });
  }

  clearAssignableUsersCache(): void {
    this.refreshAssignableUsersAfterCurrentRequest = false;
    this.assignableUsersStateSubject.next({
      ...INITIAL_ASSIGNABLE_USERS_STATE,
    });
  }

  updateProfilePicture(userId: string, file: File): Observable<UpdateProfilePictureResponse> {
    const formData = new FormData();
    formData.append('profilePicture', file);

    return this.http
      .patch<UpdateProfilePictureResponse>(`${this.apiUrl}/${userId}/profile-picture`, formData)
      .pipe(
        tap((response) => {
          this.mergeUserIntoCaches(userId, {
            profilePicture: response.profilePicture,
          });
        }),
      );
  }

  createUser(data: CreateUserRequest): Observable<ProfileUser> {
    return this.http
      .post<ProfileUser>(this.apiUrl, data)
      .pipe(tap((user) => this.upsertUserInUsersCache(user)));
  }

  updateUser(id: string, data: UpdateUserRequest): Observable<ProfileUser> {
    return this.http
      .patch<ProfileUser>(`${this.apiUrl}/${id}`, data)
      .pipe(tap((user) => this.mergeUserIntoCaches(id, user)));
  }

  updateUserRole(id: string, role: string): Observable<ProfileUser> {
    const payload: UpdateUserRoleRequest = { role };

    return this.http
      .patch<ProfileUser>(`${this.apiUrl}/${id}/role`, payload)
      .pipe(tap((user) => this.mergeUserIntoCaches(id, user)));
  }

  setUserActive(id: string, active: boolean): Observable<ProfileUser> {
    const payload: SetUserActiveRequest = { active };

    return this.http.patch<ProfileUser>(`${this.apiUrl}/${id}/active`, payload).pipe(
      tap((user) => {
        const mergedUser = {
          ...user,
          active,
        };
        this.mergeUserIntoCaches(id, mergedUser);

        if (!active) {
          this.removeUserFromAssignableCache(id);
        } else if (user?.id) {
          this.upsertUserInAssignableCache(mergedUser as ProfileUser);
        }
      }),
    );
  }

  private loadUsers(forceRefresh: boolean): Observable<ProfileUser[]> {
    const state = this.usersStateSubject.value;

    if (!forceRefresh && state.loaded) {
      return of(state.users);
    }

    if (this.usersRequest$) {
      return this.usersRequest$;
    }

    this.usersStateSubject.next({
      ...state,
      loading: true,
      error: null,
    });

    const request$ = this.http.get<ProfileUser[]>(this.apiUrl).pipe(
      tap((users) => {
        this.usersStateSubject.next({
          users: Array.isArray(users) ? users : [],
          loading: true,
          loaded: true,
          error: null,
          lastLoadedAt: new Date().toISOString(),
        });
      }),
      catchError((error) => {
        const currentState = this.usersStateSubject.value;

        this.usersStateSubject.next({
          ...currentState,
          loading: true,
          error: 'Não foi possível atualizar a lista de utilizadores.',
        });

        return throwError(() => error);
      }),
      finalize(() => {
        this.usersRequest$ = null;

        const currentState = this.usersStateSubject.value;
        this.usersStateSubject.next({
          ...currentState,
          loading: false,
        });

        if (this.refreshUsersAfterCurrentRequest && this.auth.isAuthenticated()) {
          this.refreshUsersAfterCurrentRequest = false;

          queueMicrotask(() => {
            this.refreshUsers().subscribe({
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

    this.usersRequest$ = request$;
    return request$;
  }

  private loadAssignableUsers(forceRefresh: boolean): Observable<ProfileUser[]> {
    const state = this.assignableUsersStateSubject.value;

    if (!forceRefresh && state.loaded) {
      return of(state.users);
    }

    if (this.assignableUsersRequest$) {
      return this.assignableUsersRequest$;
    }

    this.assignableUsersStateSubject.next({
      ...state,
      loading: true,
      error: null,
    });

    const request$ = this.http.get<ProfileUser[]>(`${this.apiUrl}/assignable`).pipe(
      tap((users) => {
        this.assignableUsersStateSubject.next({
          users: Array.isArray(users) ? users : [],
          loading: true,
          loaded: true,
          error: null,
          lastLoadedAt: new Date().toISOString(),
        });
      }),
      catchError((error) => {
        const currentState = this.assignableUsersStateSubject.value;

        this.assignableUsersStateSubject.next({
          ...currentState,
          loading: true,
          error: 'Não foi possível atualizar os utilizadores disponíveis para atribuição.',
        });

        return throwError(() => error);
      }),
      finalize(() => {
        this.assignableUsersRequest$ = null;

        const currentState = this.assignableUsersStateSubject.value;
        this.assignableUsersStateSubject.next({
          ...currentState,
          loading: false,
        });

        if (this.refreshAssignableUsersAfterCurrentRequest && this.auth.isAuthenticated()) {
          this.refreshAssignableUsersAfterCurrentRequest = false;

          queueMicrotask(() => {
            this.refreshAssignableUsers().subscribe({
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

    this.assignableUsersRequest$ = request$;
    return request$;
  }

  private observeAuthentication(): void {
    this.auth.authenticationState$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state) => {
      if (state === 'authenticated') {
        this.hasObservedAuthenticatedSocketConnection = this.socketService.isConnected();

        // Assignable users are used by several create/edit flows, so keep
        // warming this lightweight cache for every authenticated session.
        this.ensureAssignableUsersLoaded().subscribe({
          error: () => undefined,
        });

        // The full users list is only available/needed by Super Admin flows.
        // Warm it immediately after login/session restoration so opening Users
        // or Team Details does not have to wait for the production GET /users.
        // Once loaded, users:assignable:invalidated keeps this cache fresh.
        if (this.auth.isSuperAdmin()) {
          this.ensureUsersLoaded().subscribe({
            error: () => undefined,
          });
        }

        return;
      }

      if (state === 'unauthenticated') {
        this.hasObservedAuthenticatedSocketConnection = false;
        this.clearAssignableUsersCache();
        this.clearUsersCache();
      }
    });
  }

  private observeUsersChanged(): void {
    this.socketService
      .listenUsersChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.applyUserChangedEvent(event));
  }

  private applyUserChangedEvent(event: UserChangedEvent): void {
    if (!this.auth.isAuthenticated() || !event?.userId) {
      return;
    }

    this.lastIncrementalUserEventAt = Date.now();

    if (event.action === 'delete') {
      this.removeUserFromCaches(event.userId);
      return;
    }

    const patch = event.changes ?? {};
    if (Object.keys(patch).length) {
      this.mergeUserIntoCaches(event.userId, patch);

      if (patch.active === false) {
        this.removeUserFromAssignableCache(event.userId);
      }
    }

    const changedFields = new Set(event.changedFields ?? []);
    const fieldsMissingFromPayload = Array.from(changedFields).some((field) => !(field in patch));
    const userMissingFromLoadedCaches =
      (this.usersStateSubject.value.loaded &&
        !this.usersStateSubject.value.users.some((user) => user.id === event.userId)) ||
      (this.assignableUsersStateSubject.value.loaded &&
        !this.assignableUsersStateSubject.value.users.some((user) => user.id === event.userId));

    if (
      event.action === 'refresh' ||
      fieldsMissingFromPayload ||
      userMissingFromLoadedCaches ||
      (patch.active === true && !this.hasAssignableUser(event.userId))
    ) {
      this.refreshSingleUser(event.userId);
    }
  }

  private observeTeamMembershipChanged(): void {
    this.socketService
      .listenTeamMembershipChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.applyMembershipChangedEvent(event));
  }

  private applyMembershipChangedEvent(event: TeamMembershipChangedEvent): void {
    if (!this.auth.isAuthenticated() || !event?.teamId || !event?.userId) {
      return;
    }

    this.lastIncrementalUserEventAt = Date.now();
    this.lastIncrementalTeamEventAt = Date.now();

    const team = this.teamService.getTeamsSnapshot().find((item) => item.id === event.teamId);

    const patchMembership = (user: ProfileUser): ProfileUser => {
      const memberships = [...(user.teams ?? [])];
      const index = memberships.findIndex((membership) => membership.id === event.teamId);

      if (event.action === 'removed') {
        if (index >= 0) {
          memberships.splice(index, 1);
        }

        const defaultTeam = user.defaultTeam?.id === event.teamId ? null : user.defaultTeam;

        return { ...user, teams: memberships, defaultTeam };
      }

      const positionIndex = Number.isInteger(event.positionIndex)
        ? Number(event.positionIndex)
        : index >= 0
          ? memberships[index].positionIndex
          : undefined;
      const membership: UserTeam = {
        ...(index >= 0 ? memberships[index] : {}),
        id: event.teamId,
        name: team?.name ?? (index >= 0 ? memberships[index].name : ''),
        active: team?.active ?? (index >= 0 ? memberships[index].active : true),
        positionIndex,
        position:
          positionIndex !== undefined && team?.positionList?.[positionIndex]
            ? team.positionList[positionIndex]
            : index >= 0
              ? memberships[index].position
              : undefined,
      };

      if (index >= 0) {
        memberships[index] = membership;
      } else {
        memberships.push(membership);
      }

      return { ...user, teams: memberships };
    };

    this.mapUserInCache(this.usersStateSubject, event.userId, patchMembership);
    this.mapUserInCache(this.assignableUsersStateSubject, event.userId, patchMembership);

    if (
      event.action === 'added' &&
      !this.usersStateSubject.value.users.some((user) => user.id === event.userId) &&
      !this.assignableUsersStateSubject.value.users.some((user) => user.id === event.userId)
    ) {
      this.refreshSingleUser(event.userId);
    }
  }

  private observeTeamsChanged(): void {
    this.socketService
      .listenTeamsChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.applyTeamChangedEvent(event));
  }

  private applyTeamChangedEvent(event: TeamChangedEvent): void {
    if (!this.auth.isAuthenticated() || !event?.teamId) {
      return;
    }

    this.lastIncrementalTeamEventAt = Date.now();

    if (event.action === 'refresh') {
      if (this.assignableUsersStateSubject.value.loaded) {
        this.refreshAssignableUsers().subscribe({ error: () => undefined });
      }
      if (this.usersStateSubject.value.loaded || this.usersRequest$) {
        this.refreshUsers().subscribe({ error: () => undefined });
      }
      return;
    }

    if (!event.team) {
      return;
    }

    const patchTeamReference = (user: ProfileUser): ProfileUser => {
      const hasTeamMembership = (user.teams ?? []).some(
        (membership) => membership.id === event.teamId,
      );
      const hasDefaultTeam = user.defaultTeam?.id === event.teamId;

      if (!hasTeamMembership && !hasDefaultTeam) {
        return user;
      }

      const updateMembership = (membership: UserTeam): UserTeam => {
        if (membership.id !== event.teamId) {
          return membership;
        }

        const positionIndex = membership.positionIndex;
        return {
          ...membership,
          name: event.team!.name,
          active: event.team!.active,
          position:
            positionIndex !== undefined && event.team!.positionList?.[positionIndex] !== undefined
              ? event.team!.positionList[positionIndex]
              : membership.position,
        };
      };

      return {
        ...user,
        teams: (user.teams ?? []).map(updateMembership),
        defaultTeam: user.defaultTeam ? updateMembership(user.defaultTeam) : null,
      };
    };

    this.mapAllUsersInCache(this.usersStateSubject, patchTeamReference);
    this.mapAllUsersInCache(this.assignableUsersStateSubject, patchTeamReference);
  }

  private observeAssignableUsersInvalidation(): void {
    this.socketService
      .listenAssignableUsersInvalidated()
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (!this.auth.isAuthenticated()) {
          return;
        }

        if (this.shouldIgnoreAssignableInvalidation(event)) {
          return;
        }

        this.refreshAssignableUsers().subscribe({
          error: () => undefined,
        });

        if (this.usersStateSubject.value.loaded || this.usersRequest$) {
          this.refreshUsers().subscribe({
            error: () => undefined,
          });
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

        if (this.shouldIgnoreTeamsInvalidation(event)) {
          return;
        }

        this.refreshAssignableUsers().subscribe({
          error: () => undefined,
        });

        if (this.usersStateSubject.value.loaded || this.usersRequest$) {
          this.refreshUsers().subscribe({
            error: () => undefined,
          });
        }
      });
  }

  private shouldIgnoreAssignableInvalidation(event: AssignableUsersInvalidationEvent): boolean {
    const reason = (event?.reason ?? '').toLowerCase();
    if (/(import|bulk|reconcile)/.test(reason)) {
      return false;
    }

    return (
      /(user|role|active|membership|member|team)/.test(reason) ||
      Date.now() - this.lastIncrementalUserEventAt < 1500
    );
  }

  private shouldIgnoreTeamsInvalidation(event: TeamsInvalidationEvent): boolean {
    const reason = (event?.reason ?? '').toLowerCase();
    if (/(import|bulk|wallet|balance|commission|reconcile)/.test(reason)) {
      return false;
    }

    return (
      /(team|position|active|membership|member)/.test(reason) ||
      Date.now() - this.lastIncrementalTeamEventAt < 1500
    );
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

        // A reconnect can mean an invalidation event was missed while offline.
        // Assignable users are always warmed; refresh the expensive full list
        // only when this session has already loaded (or is loading) it.
        this.refreshAssignableUsers().subscribe({
          error: () => undefined,
        });

        if (this.usersStateSubject.value.loaded || this.usersRequest$) {
          this.refreshUsers().subscribe({
            error: () => undefined,
          });
        }
      });
  }

  private upsertUserInUsersCache(user: ProfileUser): void {
    const state = this.usersStateSubject.value;

    if (!state.loaded) {
      return;
    }

    const existingIndex = state.users.findIndex((cachedUser) => cachedUser.id === user.id);

    const users = [...state.users];

    if (existingIndex >= 0) {
      users[existingIndex] = {
        ...users[existingIndex],
        ...user,
      };
    } else {
      users.unshift(user);
    }

    this.usersStateSubject.next({
      ...state,
      users,
    });
  }

  private mergeUserIntoCaches(userId: string, user: Partial<ProfileUser>): void {
    this.patchUserInUsersCache(userId, user);
    this.patchUserInAssignableCache(userId, user);
  }

  private patchUserInUsersCache(userId: string, patch: Partial<ProfileUser>): void {
    const state = this.usersStateSubject.value;

    if (!state.loaded) {
      return;
    }

    let changed = false;
    const users = state.users.map((user) => {
      if (user.id !== userId) {
        return user;
      }

      changed = true;
      return {
        ...user,
        ...patch,
      };
    });

    if (!changed) {
      return;
    }

    this.usersStateSubject.next({
      ...state,
      users,
    });
  }

  private patchUserInAssignableCache(userId: string, patch: Partial<ProfileUser>): void {
    const state = this.assignableUsersStateSubject.value;

    if (!state.loaded) {
      return;
    }

    let changed = false;
    const users = state.users.map((user) => {
      if (user.id !== userId) {
        return user;
      }

      changed = true;
      return {
        ...user,
        ...patch,
      };
    });

    if (!changed) {
      return;
    }

    this.assignableUsersStateSubject.next({
      ...state,
      users,
    });
  }
  private refreshSingleUser(userId: string): void {
    this.getUserById(userId).subscribe({
      next: (user) => {
        this.mergeUserIntoCaches(userId, user);

        if (user.active === false) {
          this.removeUserFromAssignableCache(userId);
          return;
        }

        this.upsertUserInAssignableCache(user);
      },
      error: () => undefined,
    });
  }

  private hasAssignableUser(userId: string): boolean {
    return this.assignableUsersStateSubject.value.users.some((user) => user.id === userId);
  }

  private removeUserFromCaches(userId: string): void {
    this.removeUserFromState(this.usersStateSubject, userId);
    this.removeUserFromState(this.assignableUsersStateSubject, userId);
  }

  private removeUserFromAssignableCache(userId: string): void {
    this.removeUserFromState(this.assignableUsersStateSubject, userId);
  }

  private upsertUserInAssignableCache(user: ProfileUser): void {
    const state = this.assignableUsersStateSubject.value;
    if (!state.loaded || user.active === false) {
      return;
    }

    const existingIndex = state.users.findIndex((cachedUser) => cachedUser.id === user.id);
    const users = [...state.users];
    if (existingIndex >= 0) {
      users[existingIndex] = { ...users[existingIndex], ...user };
    } else {
      users.unshift(user);
    }

    this.assignableUsersStateSubject.next({ ...state, users });
  }

  private removeUserFromState<T extends UsersState | AssignableUsersState>(
    subject: BehaviorSubject<T>,
    userId: string,
  ): void {
    const state = subject.value;
    if (!state.loaded) {
      return;
    }

    const users = state.users.filter((user) => user.id !== userId);
    if (users.length === state.users.length) {
      return;
    }

    subject.next({ ...state, users } as T);
  }

  private mapUserInCache<T extends UsersState | AssignableUsersState>(
    subject: BehaviorSubject<T>,
    userId: string,
    mapper: (user: ProfileUser) => ProfileUser,
  ): void {
    const state = subject.value;
    if (!state.loaded) {
      return;
    }

    let changed = false;
    const users = state.users.map((user) => {
      if (user.id !== userId) {
        return user;
      }
      changed = true;
      return mapper(user);
    });

    if (changed) {
      subject.next({ ...state, users } as T);
    }
  }

  private mapAllUsersInCache<T extends UsersState | AssignableUsersState>(
    subject: BehaviorSubject<T>,
    mapper: (user: ProfileUser) => ProfileUser,
  ): void {
    const state = subject.value;
    if (!state.loaded) {
      return;
    }

    let changed = false;
    const users = state.users.map((user) => {
      const mappedUser = mapper(user);
      if (mappedUser !== user) {
        changed = true;
      }
      return mappedUser;
    });

    if (changed) {
      subject.next({ ...state, users } as T);
    }
  }
}
