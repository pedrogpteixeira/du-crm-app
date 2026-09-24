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
import { SocketService } from './socket';

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
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = `${environment.apiUrl}/api/users`;

  private readonly usersStateSubject =
    new BehaviorSubject<UsersState>(INITIAL_USERS_STATE);

  readonly usersState$ = this.usersStateSubject.asObservable();

  private readonly assignableUsersStateSubject =
    new BehaviorSubject<AssignableUsersState>(INITIAL_ASSIGNABLE_USERS_STATE);

  readonly assignableUsersState$ =
    this.assignableUsersStateSubject.asObservable();

  private usersRequest$: Observable<ProfileUser[]> | null = null;
  private assignableUsersRequest$: Observable<ProfileUser[]> | null = null;
  private refreshUsersAfterCurrentRequest = false;
  private refreshAssignableUsersAfterCurrentRequest = false;

  constructor() {
    this.observeAuthentication();
    this.observeAssignableUsersInvalidation();
  }

  getUserById(id: string): Observable<ProfileUser> {
    return this.http.get<ProfileUser>(`${this.apiUrl}/${id}`);
  }

  /**
   * Full user list cache. The large GET /users request is lazy: it only runs
   * when a screen actually needs the complete list and is then reused for the
   * remainder of the authenticated session.
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

  clearAssignableUsersCache(): void {
    this.refreshAssignableUsersAfterCurrentRequest = false;
    this.assignableUsersStateSubject.next({
      ...INITIAL_ASSIGNABLE_USERS_STATE,
    });
  }

  updateProfilePicture(
    userId: string,
    file: File,
  ): Observable<UpdateProfilePictureResponse> {
    const formData = new FormData();
    formData.append('profilePicture', file);

    return this.http
      .patch<UpdateProfilePictureResponse>(
        `${this.apiUrl}/${userId}/profile-picture`,
        formData,
      )
      .pipe(
        tap((response) => {
          this.patchUserInUsersCache(userId, {
            profilePicture: response.profilePicture,
          });
        }),
      );
  }

  createUser(data: CreateUserRequest): Observable<ProfileUser> {
    return this.http.post<ProfileUser>(this.apiUrl, data).pipe(
      tap((user) => this.upsertUserInUsersCache(user)),
    );
  }

  updateUser(id: string, data: UpdateUserRequest): Observable<ProfileUser> {
    return this.http.patch<ProfileUser>(`${this.apiUrl}/${id}`, data).pipe(
      tap((user) => this.mergeUserIntoCaches(id, user)),
    );
  }

  updateUserRole(id: string, role: string): Observable<ProfileUser> {
    const payload: UpdateUserRoleRequest = { role };

    return this.http
      .patch<ProfileUser>(`${this.apiUrl}/${id}/role`, payload)
      .pipe(
        tap((user) => this.mergeUserIntoCaches(id, user)),
      );
  }

  setUserActive(id: string, active: boolean): Observable<ProfileUser> {
    const payload: SetUserActiveRequest = { active };

    return this.http
      .patch<ProfileUser>(`${this.apiUrl}/${id}/active`, payload)
      .pipe(
        tap((user) => {
          this.mergeUserIntoCaches(id, {
            ...user,
            active,
          });
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

        if (
          this.refreshUsersAfterCurrentRequest &&
          this.auth.isAuthenticated()
        ) {
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

  private loadAssignableUsers(
    forceRefresh: boolean,
  ): Observable<ProfileUser[]> {
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

    const request$ = this.http
      .get<ProfileUser[]>(`${this.apiUrl}/assignable`)
      .pipe(
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
            error:
              'Não foi possível atualizar os utilizadores disponíveis para atribuição.',
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

          if (
            this.refreshAssignableUsersAfterCurrentRequest &&
            this.auth.isAuthenticated()
          ) {
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
    this.auth.authenticationState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state === 'authenticated') {
          // Assignable users are intentionally warmed in the background because
          // several create/edit flows need them. The large /users list stays lazy.
          this.ensureAssignableUsersLoaded().subscribe({
            error: () => undefined,
          });
          return;
        }

        if (state === 'unauthenticated') {
          this.clearAssignableUsersCache();
          this.clearUsersCache();
        }
      });
  }

  private observeAssignableUsersInvalidation(): void {
    this.socketService
      .listenAssignableUsersInvalidated()
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (!this.auth.isAuthenticated()) {
          return;
        }

        this.refreshAssignableUsers().subscribe({
          error: () => undefined,
        });

        // The same backend invalidation event is emitted when user/team/role
        // assignment data changes. Only refresh the expensive full list if it
        // has already been requested in this session.
        if (
          this.usersStateSubject.value.loaded ||
          this.usersRequest$
        ) {
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

    const existingIndex = state.users.findIndex(
      (cachedUser) => cachedUser.id === user.id,
    );

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

  private mergeUserIntoCaches(
    userId: string,
    user: Partial<ProfileUser>,
  ): void {
    this.patchUserInUsersCache(userId, user);
    this.patchUserInAssignableCache(userId, user);
  }

  private patchUserInUsersCache(
    userId: string,
    patch: Partial<ProfileUser>,
  ): void {
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

  private patchUserInAssignableCache(
    userId: string,
    patch: Partial<ProfileUser>,
  ): void {
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
}
