import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, distinctUntilChanged, map, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  SystemNotice,
  SystemNoticeAudience,
  SystemNoticeCreateInput,
  SystemNoticeCreateResponse,
  SystemNoticeType,
} from '../models/system-notice';
import { Auth } from './auth';
import { CriticalRequestService } from './critical-request';

@Injectable({ providedIn: 'root' })
export class SystemNoticeService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly criticalRequests = inject(CriticalRequestService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = environment.apiUrl;

  private readonly noticesSubject = new BehaviorSubject<SystemNotice[]>([]);
  private readonly activeNoticeSubject = new BehaviorSubject<SystemNotice | null>(null);

  readonly notices$ = this.noticesSubject.asObservable();
  readonly activeNotice$ = this.activeNoticeSubject.asObservable();

  private readonly dismissedNoticeIds = new Set<string>();
  private pendingNotice: SystemNotice | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.auth.authenticationState$
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((authenticationState) => {
        if (authenticationState === 'authenticated') {
          this.dismissedNoticeIds.clear();
          this.loadMine().subscribe({
            error: () => {
              // System notices are supplementary. Keep the CRM usable if this
              // initial request fails and wait for future socket notices.
            },
          });
          return;
        }

        this.clearAuthenticatedState();
      });

    this.criticalRequests.count$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((count) => {
        if (count === 0) {
          this.flushPendingNotice();
        }
      });

    this.destroyRef.onDestroy(() => this.clearExpiryTimer());
  }

  loadMine(): Observable<SystemNotice[]> {
    const userId = this.auth.getCurrentUser()?.id ?? null;

    return this.http.get<unknown>(`${this.apiUrl}/api/system-notices/me`).pipe(
      map((payload) => this.parseNoticeCollection(payload)),
      tap((notices) => {
        const currentUserId = this.auth.getCurrentUser()?.id ?? null;

        if (
          this.auth.getAuthenticationState() !== 'authenticated' ||
          currentUserId !== userId
        ) {
          return;
        }

        this.setNotices(notices);
      }),
    );
  }

  create(payload: SystemNoticeCreateInput): Observable<SystemNoticeCreateResponse> {
    return this.http.post<unknown>(`${this.apiUrl}/api/system-notices`, payload).pipe(
      map((response) => this.parseCreateResponse(response)),
      tap((response) => this.mergeNotice(response.notice)),
    );
  }

  remove(noticeId: string): Observable<void> {
    const normalizedId = this.readNonEmptyString(noticeId);

    if (!normalizedId) {
      throw new Error('A valid System Notice id is required.');
    }

    return this.http
      .delete<void>(`${this.apiUrl}/api/system-notices/${encodeURIComponent(normalizedId)}`)
      .pipe(tap(() => this.removeFromLocalState(normalizedId)));
  }

  handleIncomingNotice(payload: unknown): void {
    if (this.auth.getAuthenticationState() !== 'authenticated') {
      return;
    }

    const notice = this.parseNotice(payload);

    if (!notice || this.isExpired(notice) || notice.active === false || this.hasNotice(notice.id)) {
      return;
    }

    if (notice.deferWhileCriticalRequest && this.criticalRequests.count > 0) {
      this.pendingNotice = notice;
      return;
    }

    this.mergeNotice(notice);
  }

  dismissLocally(noticeId: string): void {
    const normalizedId = this.readNonEmptyString(noticeId);

    if (!normalizedId) {
      return;
    }

    // Dismiss is presentation-only. The notice remains in noticesSubject so
    // the Super Admin can still see/remove it from the active-notices list.
    this.dismissedNoticeIds.add(normalizedId);
    this.recomputeActiveNotice();
  }

  clearAuthenticatedState(): void {
    this.pendingNotice = null;
    this.dismissedNoticeIds.clear();
    this.noticesSubject.next([]);
    this.activeNoticeSubject.next(null);
    this.clearExpiryTimer();
  }

  private flushPendingNotice(): void {
    const pending = this.pendingNotice;

    if (!pending) {
      return;
    }

    this.pendingNotice = null;

    if (this.isExpired(pending) || pending.active === false || this.hasNotice(pending.id)) {
      return;
    }

    this.mergeNotice(pending);
  }

  private mergeNotice(notice: SystemNotice): void {
    if (this.isExpired(notice) || notice.active === false || this.hasNotice(notice.id)) {
      return;
    }

    this.setNotices([notice, ...this.noticesSubject.value]);
  }

  private setNotices(notices: SystemNotice[]): void {
    const unique = new Map<string, SystemNotice>();

    for (const notice of notices) {
      if (this.isExpired(notice) || notice.active === false || unique.has(notice.id)) {
        continue;
      }

      unique.set(notice.id, notice);
    }

    const next = this.sortNotices([...unique.values()]);
    this.noticesSubject.next(next);

    const currentIds = new Set(next.map((notice) => notice.id));
    for (const dismissedId of [...this.dismissedNoticeIds]) {
      if (!currentIds.has(dismissedId)) {
        this.dismissedNoticeIds.delete(dismissedId);
      }
    }

    this.recomputeActiveNotice();
    this.scheduleExpiry(next);
  }

  private removeFromLocalState(noticeId: string): void {
    if (this.pendingNotice?.id === noticeId) {
      this.pendingNotice = null;
    }

    this.dismissedNoticeIds.delete(noticeId);
    this.setNotices(this.noticesSubject.value.filter((notice) => notice.id !== noticeId));
  }

  private recomputeActiveNotice(): void {
    const visibleNotice = this.noticesSubject.value.find(
      (notice) => !this.dismissedNoticeIds.has(notice.id),
    );

    this.activeNoticeSubject.next(visibleNotice ?? null);
  }

  private scheduleExpiry(notices: SystemNotice[]): void {
    this.clearExpiryTimer();

    const futureExpiries = notices
      .map((notice) => (notice.expiresAt ? new Date(notice.expiresAt).getTime() : null))
      .filter(
        (value): value is number => value !== null && Number.isFinite(value) && value > Date.now(),
      );

    if (!futureExpiries.length) {
      return;
    }

    const remainingMs = Math.min(...futureExpiries) - Date.now();
    const maxTimeout = 2_147_483_647;

    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null;
      this.setNotices(this.noticesSubject.value);
    }, Math.min(remainingMs, maxTimeout));
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private hasNotice(noticeId: string): boolean {
    return this.noticesSubject.value.some((notice) => notice.id === noticeId);
  }

  private sortNotices(notices: SystemNotice[]): SystemNotice[] {
    return [...notices].sort((a, b) => {
      const dateA = new Date(a.publishedAt).getTime();
      const dateB = new Date(b.publishedAt).getTime();
      return dateB - dateA;
    });
  }

  private parseNoticeCollection(payload: unknown): SystemNotice[] {
    const rawNotices = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)['notices']
        : null;

    if (!Array.isArray(rawNotices)) {
      throw new Error('Invalid System Notice list returned by the API.');
    }

    return rawNotices
      .map((rawNotice) => this.parseNotice(rawNotice))
      .filter((notice): notice is SystemNotice => Boolean(notice));
  }

  private parseCreateResponse(payload: unknown): SystemNoticeCreateResponse {
    const directNotice = this.parseNotice(payload);

    if (directNotice) {
      return { notice: directNotice };
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Invalid System Notice create response returned by the API.');
    }

    const value = payload as Record<string, unknown>;
    const notice = this.parseNotice(value['notice']);

    if (!notice) {
      throw new Error('Invalid System Notice create response returned by the API.');
    }

    const recipientSockets = value['recipientSockets'];
    const message = this.readNonEmptyString(value['message']);

    return {
      notice,
      ...(message ? { message } : {}),
      ...(typeof recipientSockets === 'number' && Number.isFinite(recipientSockets)
        ? { recipientSockets }
        : {}),
    };
  }

  private parseNotice(payload: unknown): SystemNotice | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const value = payload as Record<string, unknown>;
    const id = this.readNonEmptyString(value['id']) ?? this.readNonEmptyString(value['_id']);
    const title = this.readNonEmptyString(value['title']);
    const message = this.readNonEmptyString(value['message']);
    const type = value['type'];
    const audience = value['audience'];
    const deferWhileCriticalRequest = value['deferWhileCriticalRequest'];
    const publishedAt =
      this.readNonEmptyString(value['publishedAt']) ?? this.readNonEmptyString(value['createdAt']);
    const expiresAt = value['expiresAt'];
    const active = value['active'];

    if (
      !id ||
      !title ||
      !message ||
      !this.isNoticeType(type) ||
      !this.isNoticeAudience(audience) ||
      !publishedAt ||
      !Number.isFinite(new Date(publishedAt).getTime()) ||
      !this.isValidOptionalDate(expiresAt) ||
      (deferWhileCriticalRequest !== undefined && typeof deferWhileCriticalRequest !== 'boolean') ||
      (active !== undefined && typeof active !== 'boolean')
    ) {
      return null;
    }

    const createdBy = this.readOptionalString(value['createdBy']);
    const createdAt = this.readOptionalDateString(value['createdAt']);
    const updatedAt = this.readOptionalDateString(value['updatedAt']);

    return {
      id,
      title,
      message,
      type,
      audience,
      deferWhileCriticalRequest: deferWhileCriticalRequest === true,
      publishedAt,
      expiresAt: typeof expiresAt === 'string' ? expiresAt : null,
      ...(typeof active === 'boolean' ? { active } : {}),
      ...(createdBy ? { createdBy } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
    };
  }

  private isExpired(notice: Pick<SystemNotice, 'expiresAt'>): boolean {
    if (!notice.expiresAt) {
      return false;
    }

    const expiresAt = new Date(notice.expiresAt).getTime();
    return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
  }

  private isValidOptionalDate(value: unknown): boolean {
    return (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && Number.isFinite(new Date(value).getTime()))
    );
  }

  private readOptionalDateString(value: unknown): string | null {
    return typeof value === 'string' && Number.isFinite(new Date(value).getTime()) ? value : null;
  }

  private readNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private readOptionalString(value: unknown): string | null {
    return this.readNonEmptyString(value);
  }

  private isNoticeType(value: unknown): value is SystemNoticeType {
    return value === 'info' || value === 'warning' || value === 'error';
  }

  private isNoticeAudience(value: unknown): value is SystemNoticeAudience {
    return value === 'authenticated' || value === 'all';
  }
}
