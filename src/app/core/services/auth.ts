import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import {
  BehaviorSubject,
  catchError,
  defer,
  distinctUntilChanged,
  finalize,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
  timer,
} from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthUser } from '../models/auth-user';
import { normalizeRoleName } from '../utils/position-normalization';
import { PasswordPolicy } from '../models/password-policy';
import { AppTheme, ThemeService } from './theme';

export type AuthenticationState =
  'initializing' | 'authenticated' | 'unauthenticated' | 'recoverable-error';

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  passwordPolicy?: PasswordPolicy;
}

interface RefreshResponse {
  accessToken: string;
  passwordPolicy?: PasswordPolicy;
}

interface AuthSyncTokenMessage {
  type: 'token';
  source: string;
  accessToken: string;
  user?: AuthUser | null;
  passwordPolicy?: PasswordPolicy | null;
  timestamp: number;
}

interface AuthSyncRefreshStartMessage {
  type: 'refresh-start';
  source: string;
  timestamp: number;
}

interface AuthSyncTokenRequestMessage {
  type: 'token-request';
  source: string;
  timestamp: number;
}

interface AuthSyncLogoutMessage {
  type: 'logout';
  source: string;
  timestamp: number;
}

type AuthSyncMessage =
  | AuthSyncTokenMessage
  | AuthSyncTokenRequestMessage
  | AuthSyncRefreshStartMessage
  | AuthSyncLogoutMessage;

interface BrowserLockManager {
  request<T>(name: string, options: { mode: 'exclusive' }, callback: () => Promise<T>): Promise<T>;
}

const AUTH_BROADCAST_CHANNEL = 'certo-crm-auth';
const AUTH_REFRESH_LOCK = 'certo-crm-auth-refresh';
const REFRESH_CONCURRENT_CODE = 'REFRESH_CONCURRENT';
const REFRESH_CONCURRENT_RETRY_DELAYS_MS = [300, 500] as const;
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000;

interface ChangePasswordResponse {
  message: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordPayload {
  token: string;
  verificationCode: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly instanceId = this.createInstanceId();
  private authChannel: BroadcastChannel | null = null;
  private peerRefreshStartedAt = 0;
  private refreshRequest$: Observable<string> | null = null;
  private initializationRequest$: Observable<boolean> | null = null;
  private accessTokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  private accessToken: string | null = null;

  private readonly accessTokenSubject = new BehaviorSubject<string | null>(null);

  readonly accessToken$ = this.accessTokenSubject.asObservable().pipe(distinctUntilChanged());

  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(null);

  private readonly passwordPolicySubject = new BehaviorSubject<PasswordPolicy | null>(null);

  readonly passwordPolicy$ = this.passwordPolicySubject.asObservable().pipe(distinctUntilChanged());

  readonly passwordExpired$ = this.passwordPolicy$.pipe(
    map((policy) => policy?.expired === true),
    distinctUntilChanged(),
  );

  private readonly authenticationStateSubject = new BehaviorSubject<AuthenticationState>(
    'initializing',
  );

  readonly authenticationState$ = this.authenticationStateSubject
    .asObservable()
    .pipe(distinctUntilChanged());

  readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.initializeCrossTabSync();

    this.destroyRef.onDestroy(() => {
      this.clearAccessTokenRefreshTimer();
      this.authChannel?.close();
      this.authChannel = null;
    });
  }

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  login(identifier: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        `${this.apiUrl}/api/auth/signin`,
        {
          username: identifier,
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
          this.setPasswordPolicy(response.passwordPolicy ?? null);
          this.setAuthenticationState('authenticated');
          this.broadcastCurrentToken();

          this.saveUserPreferences(response.user);
        }),
      );
  }

  // ---------------------------------------------------------------------------
  // Password
  // ---------------------------------------------------------------------------

  changePassword(payload: {
    currentPassword: string;
    newPassword: string;
  }): Observable<ChangePasswordResponse> {
    return this.http.patch<ChangePasswordResponse>(`${this.apiUrl}/api/auth/password`, payload, {
      withCredentials: true,
    });
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    const payload: ForgotPasswordPayload = {
      email,
    };

    return this.http.post<ForgotPasswordResponse>(
      `${this.apiUrl}/api/auth/forgot-password`,
      payload,
      {
        withCredentials: true,
      },
    );
  }

  resetPassword(
    token: string,
    verificationCode: string,
    newPassword: string,
  ): Observable<ResetPasswordResponse> {
    const payload: ResetPasswordPayload = {
      token,
      verificationCode,
      newPassword,
    };

    return this.http.post<ResetPasswordResponse>(
      `${this.apiUrl}/api/auth/reset-password`,
      payload,
      {
        withCredentials: true,
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Session restoration
  // ---------------------------------------------------------------------------

  restoreSession(): Observable<boolean> {
    this.setAuthenticationState('initializing');

    if (this.hasUsableAccessToken()) {
      if (this.getCurrentUser()) {
        this.setAuthenticationState('authenticated');
        return of(true);
      }

      return this.loadCurrentUser().pipe(
        map(() => true),
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            return this.restoreSessionWithRefresh();
          }

          this.setAuthenticationState('recoverable-error');
          return of(false);
        }),
      );
    }

    return this.requestTokenFromPeer().pipe(
      switchMap((peerToken) => {
        if (!peerToken) {
          return this.restoreSessionWithRefresh();
        }

        if (this.getCurrentUser()) {
          this.setAuthenticationState('authenticated');
          return of(true);
        }

        return this.loadCurrentUser().pipe(
          map(() => true),
          catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
              return this.restoreSessionWithRefresh();
            }

            this.setAuthenticationState('recoverable-error');
            return of(false);
          }),
        );
      }),
    );
  }

  refresh(): Observable<string> {
    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const tokenAtStart = this.getAccessToken();

    const request$ = defer(() => this.coordinateRefreshAcrossTabs(tokenAtStart)).pipe(
      catchError((error: HttpErrorResponse) => {
        if (this.isPasswordExpiredError(error)) {
          this.markPasswordExpired(this.getPasswordPolicyFromError(error));
          return throwError(() => error);
        }

        if (this.isDefinitiveSessionFailure(error)) {
          this.clearSession();
        } else if (!this.getAccessToken()) {
          this.setAuthenticationState('recoverable-error');
        }

        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshRequest$ = null;
      }),
      shareReplay({
        bufferSize: 1,
        refCount: false,
      }),
    );

    this.refreshRequest$ = request$;
    return request$;
  }

  private restoreSessionWithRefresh(): Observable<boolean> {
    return this.refresh().pipe(
      switchMap(() => {
        if (this.isPasswordExpired()) {
          this.setAuthenticationState('authenticated');
          return of(true);
        }

        return this.loadCurrentUser().pipe(map(() => true));
      }),
      catchError((error: HttpErrorResponse) => {
        if (this.isPasswordExpired()) {
          this.setAuthenticationState('authenticated');
          return of(true);
        }

        if (this.isDefinitiveSessionFailure(error)) {
          this.clearSession();
        } else {
          this.setAuthenticationState('recoverable-error');
        }

        return of(false);
      }),
    );
  }

  private coordinateRefreshAcrossTabs(tokenAtStart: string | null): Observable<string> {
    const locks = this.getBrowserLockManager();

    if (!locks) {
      return this.waitForPeerRefresh(tokenAtStart).pipe(
        switchMap((synchronizedToken) =>
          synchronizedToken ? of(synchronizedToken) : this.performRefreshWithConcurrentRetry(),
        ),
      );
    }

    return from(
      locks.request(AUTH_REFRESH_LOCK, { mode: 'exclusive' }, async () => {
        const synchronizedToken = this.getAccessToken();

        if (
          synchronizedToken &&
          synchronizedToken !== tokenAtStart &&
          this.isAccessTokenValid(synchronizedToken, 5_000)
        ) {
          return synchronizedToken;
        }

        return firstValueFrom(this.performRefreshWithConcurrentRetry());
      }),
    );
  }

  private performRefreshWithConcurrentRetry(attempt = 0): Observable<string> {
    this.broadcastAuthMessage({
      type: 'refresh-start',
      source: this.instanceId,
      timestamp: Date.now(),
    });

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

          if (response.passwordPolicy !== undefined) {
            this.setPasswordPolicy(response.passwordPolicy);
          }

          this.broadcastCurrentToken();

          if (this.getCurrentUser()) {
            this.setAuthenticationState('authenticated');
          }
        }),
        map((response) => response.accessToken),
        catchError((error: HttpErrorResponse) => {
          if (
            this.isConcurrentRefreshError(error) &&
            attempt < REFRESH_CONCURRENT_RETRY_DELAYS_MS.length
          ) {
            const delayMs = REFRESH_CONCURRENT_RETRY_DELAYS_MS[attempt];

            return timer(delayMs).pipe(
              switchMap(() => {
                const synchronizedToken = this.getAccessToken();

                if (synchronizedToken && this.isAccessTokenValid(synchronizedToken, 5_000)) {
                  return of(synchronizedToken);
                }

                return this.performRefreshWithConcurrentRetry(attempt + 1);
              }),
            );
          }

          return throwError(() => error);
        }),
      );
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  logout(): void {
    const accessToken = this.getAccessToken();

    this.clearSession({ broadcast: true });

    this.http
      .post<void>(
        `${this.apiUrl}/api/auth/logout`,
        {},
        {
          withCredentials: true,
          headers: accessToken
            ? {
                Authorization: `Bearer ${accessToken}`,
              }
            : {},
        },
      )
      .pipe(catchError(() => of(undefined)))
      .subscribe();
  }

  logoutAll(): void {
    this.clearSession({ broadcast: true });

    this.http
      .post<void>(
        `${this.apiUrl}/api/auth/logout-all`,
        {},
        {
          withCredentials: true,
        },
      )
      .pipe(catchError(() => of(undefined)))
      .subscribe();
  }

  // ---------------------------------------------------------------------------
  // Access token
  // ---------------------------------------------------------------------------

  setAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
    this.accessTokenSubject.next(accessToken);
    this.scheduleAccessTokenRefresh(accessToken);
  }

  clearAccessToken(): void {
    this.clearAccessTokenRefreshTimer();
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
    this.currentUserSubject.next(
      user
        ? {
            ...user,
            role: normalizeRoleName(user.role),
          }
        : null,
    );
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  loadCurrentUser(): Observable<AuthUser> {
    return this.http
      .get<AuthUser>(`${this.apiUrl}/api/users/me`, {
        withCredentials: true,
      })
      .pipe(
        tap((user) => {
          this.setCurrentUser(user);
          this.setAuthenticationState('authenticated');

          this.saveUserPreferences(user);
        }),
      );
  }

  // ---------------------------------------------------------------------------
  // Password policy
  // ---------------------------------------------------------------------------

  setPasswordPolicy(policy: PasswordPolicy | null): void {
    this.passwordPolicySubject.next(policy);
  }

  getPasswordPolicy(): PasswordPolicy | null {
    return this.passwordPolicySubject.value;
  }

  isPasswordExpired(): boolean {
    return this.passwordPolicySubject.value?.expired === true;
  }

  markPasswordExpired(policy?: PasswordPolicy | null): void {
    const currentPolicy = this.passwordPolicySubject.value;
    const nextPolicy = policy ?? currentPolicy;

    this.passwordPolicySubject.next({
      enabled: nextPolicy?.enabled ?? true,
      maxAgeDays: nextPolicy?.maxAgeDays ?? 0,
      expired: true,
      expiresAt: nextPolicy?.expiresAt ?? null,
      daysRemaining: 0,
    });

    if (this.getAccessToken()) {
      this.setAuthenticationState('authenticated');
    }
  }

  clearPasswordPolicy(): void {
    this.passwordPolicySubject.next(null);
  }

  // ---------------------------------------------------------------------------
  // Authentication state
  // ---------------------------------------------------------------------------

  initializeAuthentication(): Observable<boolean> {
    if (this.getAuthenticationState() !== 'initializing') {
      return of(this.isAuthenticated());
    }

    if (this.initializationRequest$) {
      return this.initializationRequest$;
    }

    const request$ = defer(() => this.restoreSession()).pipe(
      finalize(() => {
        this.initializationRequest$ = null;
      }),
      shareReplay({
        bufferSize: 1,
        refCount: false,
      }),
    );

    this.initializationRequest$ = request$;
    return request$;
  }

  getAuthenticationState(): AuthenticationState {
    return this.authenticationStateSubject.value;
  }

  setAuthenticationState(state: AuthenticationState): void {
    this.authenticationStateSubject.next(state);
  }

  isAuthenticated(): boolean {
    return this.getAuthenticationState() === 'authenticated' && this.getAccessToken() !== null;
  }

  // ---------------------------------------------------------------------------
  // Session cleanup
  // ---------------------------------------------------------------------------

  clearSession(options: { broadcast?: boolean } = {}): void {
    this.clearAccessToken();
    this.setCurrentUser(null);
    this.clearPasswordPolicy();
    this.setAuthenticationState('unauthenticated');

    localStorage.removeItem('preferences');
    localStorage.removeItem('token');
    this.themeService.resetTheme();

    if (options.broadcast) {
      this.broadcastAuthMessage({
        type: 'logout',
        source: this.instanceId,
        timestamp: Date.now(),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Refresh token/session coordination
  // ---------------------------------------------------------------------------

  isDefinitiveSessionFailure(error: HttpErrorResponse): boolean {
    return error.status === 401 && !this.isPasswordExpiredError(error);
  }

  private isConcurrentRefreshError(error: HttpErrorResponse): boolean {
    if (error.status !== 409 || !error.error || typeof error.error !== 'object') {
      return false;
    }

    return (error.error as { code?: string }).code === REFRESH_CONCURRENT_CODE;
  }

  private hasUsableAccessToken(): boolean {
    const token = this.getAccessToken();
    return token !== null && this.isAccessTokenValid(token, 5_000);
  }

  private isAccessTokenValid(token: string, minimumRemainingMs = 0): boolean {
    const expiresAt = this.getAccessTokenExpiry(token);

    if (expiresAt === null) {
      return false;
    }

    return expiresAt - Date.now() > minimumRemainingMs;
  }

  private getAccessTokenExpiry(token: string): number | null {
    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    try {
      const payloadPart = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = payloadPart.padEnd(
        payloadPart.length + ((4 - (payloadPart.length % 4)) % 4),
        '=',
      );
      const payload = JSON.parse(atob(paddedPayload)) as { exp?: number };

      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  private scheduleAccessTokenRefresh(token: string): void {
    this.clearAccessTokenRefreshTimer();

    const expiresAt = this.getAccessTokenExpiry(token);

    if (expiresAt === null) {
      return;
    }

    const delayMs = Math.max(1_000, expiresAt - Date.now() - ACCESS_TOKEN_REFRESH_MARGIN_MS);

    this.accessTokenRefreshTimer = setTimeout(() => {
      if (this.getAccessToken() !== token) {
        return;
      }

      this.refresh().subscribe({
        error: () => {
          // Falhas temporárias preservam a sessão local. O próximo pedido
          // autenticado volta a tentar renovar através do interceptor.
        },
      });
    }, delayMs);
  }

  private clearAccessTokenRefreshTimer(): void {
    if (this.accessTokenRefreshTimer === null) {
      return;
    }

    clearTimeout(this.accessTokenRefreshTimer);
    this.accessTokenRefreshTimer = null;
  }

  private requestTokenFromPeer(): Observable<string | null> {
    if (!this.authChannel) {
      return of(null);
    }

    return new Observable<string | null>((subscriber) => {
      const timeoutId = setTimeout(() => {
        subscriber.next(null);
        subscriber.complete();
      }, 200);

      const subscription = this.accessToken$.subscribe((accessToken) => {
        if (!accessToken || !this.isAccessTokenValid(accessToken, 5_000)) {
          return;
        }

        clearTimeout(timeoutId);
        subscriber.next(accessToken);
        subscriber.complete();
      });

      this.broadcastAuthMessage({
        type: 'token-request',
        source: this.instanceId,
        timestamp: Date.now(),
      });

      return () => {
        clearTimeout(timeoutId);
        subscription.unsubscribe();
      };
    });
  }

  private waitForPeerRefresh(tokenAtStart: string | null): Observable<string | null> {
    const peerRefreshIsRecent = Date.now() - this.peerRefreshStartedAt <= 1_500;

    if (!peerRefreshIsRecent) {
      return of(null);
    }

    return new Observable<string | null>((subscriber) => {
      const timeoutId = setTimeout(() => {
        subscriber.next(null);
        subscriber.complete();
      }, 500);

      const subscription = this.accessToken$.subscribe((accessToken) => {
        if (
          !accessToken ||
          accessToken === tokenAtStart ||
          !this.isAccessTokenValid(accessToken, 5_000)
        ) {
          return;
        }

        clearTimeout(timeoutId);
        subscriber.next(accessToken);
        subscriber.complete();
      });

      return () => {
        clearTimeout(timeoutId);
        subscription.unsubscribe();
      };
    });
  }

  private broadcastCurrentToken(): void {
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      return;
    }

    this.broadcastAuthMessage({
      type: 'token',
      source: this.instanceId,
      accessToken,
      user: this.getCurrentUser(),
      passwordPolicy: this.getPasswordPolicy(),
      timestamp: Date.now(),
    });
  }

  private initializeCrossTabSync(): void {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }

    this.authChannel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    this.authChannel.addEventListener('message', (event: MessageEvent<unknown>) => {
      const message = this.parseAuthSyncMessage(event.data);

      if (!message || message.source === this.instanceId) {
        return;
      }

      if (message.type === 'token-request') {
        if (this.hasUsableAccessToken()) {
          this.broadcastCurrentToken();
        }
        return;
      }

      if (message.type === 'refresh-start') {
        this.peerRefreshStartedAt = message.timestamp;
        return;
      }

      if (message.type === 'token') {
        if (message.user !== undefined) {
          this.setCurrentUser(message.user);

          if (message.user) {
            this.saveUserPreferences(message.user);
          }
        }

        if (message.passwordPolicy !== undefined) {
          this.setPasswordPolicy(message.passwordPolicy);
        }

        // Emitir o access token apenas depois de restaurar o utilizador.
        // requestTokenFromPeer() observa accessToken$ e, desta forma, o guard
        // já encontra o perfil disponível sem precisar de /api/users/me.
        this.setAccessToken(message.accessToken);

        if (this.getCurrentUser()) {
          this.setAuthenticationState('authenticated');
        }

        return;
      }

      this.clearSession();

      void this.router.navigate(['/login'], {
        replaceUrl: true,
        queryParams: {
          sessionInvalidated: 'true',
        },
      });
    });
  }

  private parseAuthSyncMessage(value: unknown): AuthSyncMessage | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<AuthSyncMessage> & {
      source?: unknown;
      timestamp?: unknown;
    };

    if (
      typeof candidate.type !== 'string' ||
      typeof candidate.source !== 'string' ||
      typeof candidate.timestamp !== 'number'
    ) {
      return null;
    }

    if (candidate.type === 'token-request') {
      return candidate as AuthSyncTokenRequestMessage;
    }

    if (candidate.type === 'refresh-start') {
      return candidate as AuthSyncRefreshStartMessage;
    }

    if (candidate.type === 'logout') {
      return candidate as AuthSyncLogoutMessage;
    }

    if (
      candidate.type === 'token' &&
      typeof (candidate as Partial<AuthSyncTokenMessage>).accessToken === 'string'
    ) {
      return candidate as AuthSyncTokenMessage;
    }

    return null;
  }

  private broadcastAuthMessage(message: AuthSyncMessage): void {
    this.authChannel?.postMessage(message);
  }

  private getBrowserLockManager(): BrowserLockManager | null {
    if (typeof navigator === 'undefined') {
      return null;
    }

    const locks = (navigator as Navigator & { locks?: BrowserLockManager }).locks;
    return locks ?? null;
  }

  private createInstanceId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  roleIncludes(requiredRoles: string | string[]): boolean {
    const user = this.getCurrentUser();
    const role = user?.role || '';

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    return roles.some((requiredRole) => role.toLowerCase().includes(requiredRole.toLowerCase()));
  }

  isSuperAdmin(): boolean {
    return this.roleIncludes('Super Admin');
  }

  private isPasswordExpiredError(error: HttpErrorResponse): boolean {
    if (error.status !== 403 || !error.error || typeof error.error !== 'object') {
      return false;
    }

    return (error.error as { code?: string }).code === 'PASSWORD_EXPIRED';
  }

  private getPasswordPolicyFromError(error: HttpErrorResponse): PasswordPolicy | null {
    if (!error.error || typeof error.error !== 'object') {
      return null;
    }

    return (error.error as { passwordPolicy?: PasswordPolicy }).passwordPolicy ?? null;
  }

  // ---------------------------------------------------------------------------
  // Preferences
  // ---------------------------------------------------------------------------

  private saveUserPreferences(user: AuthUser): void {
    if (!user.preferences) {
      localStorage.removeItem('preferences');
      this.themeService.setTheme('light');

      return;
    }

    const preferences = user.preferences;
    const normalizedPreferences = {
      ...preferences,
      contractsDefaultView:
        preferences.contractsDefaultView ?? preferences.repsolContractsDefaultView ?? 'table',
      contractDetailsCollapsedByDefault:
        preferences.contractDetailsCollapsedByDefault ??
        preferences.repsolContractDetailsCollapsedByDefault ??
        false,
      contractLayout: preferences.contractLayout === 'pro' ? 'pro' : 'light',
      theme: (preferences.theme === 'dark' ? 'dark' : 'light') as AppTheme,
    };

    localStorage.setItem('preferences', JSON.stringify(normalizedPreferences));

    this.themeService.setTheme(normalizedPreferences.theme);
  }
}
