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

export interface UpdateUserRequest {
  name: string;
  email: string;
  phone: string;
  defaultTeam: string;
}

export interface AssignableUsersState {
  users: ProfileUser[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  lastLoadedAt: string | null;
}

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

  private readonly assignableUsersStateSubject =
    new BehaviorSubject<AssignableUsersState>(INITIAL_ASSIGNABLE_USERS_STATE);

  readonly assignableUsersState$ =
    this.assignableUsersStateSubject.asObservable();

  private assignableUsersRequest$: Observable<ProfileUser[]> | null = null;
  private refreshAssignableUsersAfterCurrentRequest = false;

  constructor() {
    this.observeAuthentication();
    this.observeAssignableUsersInvalidation();
  }

  getUserById(id: string): Observable<ProfileUser> {
    return this.http.get<ProfileUser>(
      `${this.apiUrl}/${id}`,
    );
  }

  getUsers(): Observable<ProfileUser[]> {
    return this.http.get<ProfileUser[]>(this.apiUrl);
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
          this.ensureAssignableUsersLoaded().subscribe({
            error: () => undefined,
          });
          return;
        }

        if (state === 'unauthenticated') {
          this.clearAssignableUsersCache();
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
      });
  }
}
