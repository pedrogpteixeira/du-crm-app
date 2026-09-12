import { HttpClient } from '@angular/common/http';

import {
  DestroyRef,
  Injectable,
  NgZone,
  inject,
} from '@angular/core';

import {
  BehaviorSubject,
  distinctUntilChanged,
  forkJoin,
  map,
  Observable,
  of,
  shareReplay,
  tap,
  catchError,
  finalize,
  switchMap,
  throwError,
} from 'rxjs';

import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification.model';

import { Auth } from './auth';
import { SocketService } from './socket';

export interface MarkNotificationsAsReadResponse {
  success: boolean;
  requestedCount: number;
  modifiedCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly socketService = inject(SocketService);
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  private readonly apiUrl =
    environment.apiUrl;

  private readonly notificationsSubject =
    new BehaviorSubject<Notification[]>([]);

  private readonly pendingReadIds =
    new Set<string>();

  private flushInFlight$: Observable<MarkNotificationsAsReadResponse | null> | null = null;

  readonly notifications$ =
    this.notificationsSubject.asObservable();

  readonly unreadCount$ =
    this.notifications$.pipe(
      map((notifications) => {
        const currentUser =
          this.auth.getCurrentUser();

        if (!currentUser?.id) {
          return 0;
        }

        return notifications.filter(
          (notification) =>
            !notification.readBy?.includes(
              currentUser.id,
            ),
        ).length;
      }),
    );

  private readonly newNotificationHandler = (
    notification: Notification,
  ): void => {
    this.zone.run(() => {
      this.handleNewNotification(
        notification,
      );
    });
  };

  constructor() {
    this.listenToSocketNotifications();
    this.observeAuthentication();
  }

  init(): void {
    /*
     * Mantido temporariamente para compatibilidade
     * com o HomeLayout.
     *
     * A inicialização real é feita no constructor.
     */
  }

  loadNotifications(): void {
    const currentUser =
      this.auth.getCurrentUser();

    if (!currentUser?.id) {
      this.clearNotifications();
      return;
    }

    this.http
      .get<Notification[]>(
        `${this.apiUrl}/api/notifications/me`,
      )
      .subscribe({
        next: (notifications) => {
          const authenticatedUser =
            this.auth.getCurrentUser();

          if (
            authenticatedUser?.id !==
            currentUser.id
          ) {
            return;
          }

          const unreadNotifications =
            notifications.filter(
              (notification) =>
                !notification.readBy?.includes(
                  currentUser.id,
                ),
            );

          this.notificationsSubject.next(
            this.sortNotifications(
              unreadNotifications,
            ),
          );
        },
        error: () => {
          this.clearNotifications();
        },
      });
  }

  /**
   * Marca a notificação como lida apenas no estado local.
   * O request é adiado até flushPendingReads().
   */
  queueAsRead(notificationId: string): void {
    const currentUser =
      this.auth.getCurrentUser();

    if (!currentUser?.id) {
      return;
    }

    const notification =
      this.notificationsSubject.value.find(
        (item) => item.id === notificationId,
      );

    if (
      !notification ||
      notification.readBy?.includes(currentUser.id)
    ) {
      return;
    }

    this.pendingReadIds.add(notificationId);
    this.applyOptimisticReadState(
      new Set([notificationId]),
      currentUser.id,
    );
  }

  /**
   * Coloca todas as notificações atualmente não lidas na fila local.
   * Não faz qualquer request por si só.
   */
  queueAllAsRead(): number {
    const currentUser =
      this.auth.getCurrentUser();

    if (!currentUser?.id) {
      return 0;
    }

    const ids = this.notificationsSubject.value
      .filter(
        (notification) =>
          !notification.readBy?.includes(
            currentUser.id,
          ),
      )
      .map((notification) => notification.id);

    if (!ids.length) {
      return 0;
    }

    ids.forEach((id) =>
      this.pendingReadIds.add(id),
    );

    this.applyOptimisticReadState(
      new Set(ids),
      currentUser.id,
    );

    return ids.length;
  }

  /**
   * Envia as leituras acumuladas através do endpoint bulk.
   * Cada request contém no máximo 200 IDs e a fila é drenada até ficar
   * vazia, incluindo IDs que possam ter sido adicionados durante um flush.
   */
  flushPendingReads(): Observable<MarkNotificationsAsReadResponse | null> {
    if (this.flushInFlight$) {
      return this.flushInFlight$;
    }

    if (!this.pendingReadIds.size) {
      return of(null);
    }

    const request$ = this.flushPendingReadQueue().pipe(
      finalize(() => {
        this.flushInFlight$ = null;
      }),
      shareReplay({
        bufferSize: 1,
        refCount: false,
      }),
    );

    this.flushInFlight$ = request$;

    return request$;
  }

  private flushPendingReadQueue(): Observable<MarkNotificationsAsReadResponse | null> {
    const notificationIds =
      Array.from(this.pendingReadIds);

    if (!notificationIds.length) {
      return of(null);
    }

    const batches =
      this.chunkNotificationIds(
        notificationIds,
        200,
      );

    const requests = batches.map((ids) =>
      this.http.patch<MarkNotificationsAsReadResponse>(
        `${this.apiUrl}/api/notifications/read`,
        {
          notificationIds: ids,
        },
      ),
    );

    const currentFlush$ =
      requests.length === 1
        ? requests[0]
        : forkJoin(requests).pipe(
            map((responses) =>
              this.mergeBulkReadResponses(responses),
            ),
          );

    return currentFlush$.pipe(
      tap(() => {
        this.commitPendingReads(
          notificationIds,
        );
      }),
      switchMap((response) => {
        if (!this.pendingReadIds.size) {
          return of(response);
        }

        return this.flushPendingReadQueue().pipe(
          map((nextResponse) =>
            nextResponse
              ? this.mergeBulkReadResponses([
                  response,
                  nextResponse,
                ])
              : response,
          ),
        );
      }),
      catchError((error) => {
        this.rollbackPendingReads(
          notificationIds,
        );
        return throwError(() => error);
      }),
    );
  }

  private mergeBulkReadResponses(
    responses: MarkNotificationsAsReadResponse[],
  ): MarkNotificationsAsReadResponse {
    return {
      success: responses.every(
        (response) => response.success,
      ),
      requestedCount: responses.reduce(
        (total, response) =>
          total + response.requestedCount,
        0,
      ),
      modifiedCount: responses.reduce(
        (total, response) =>
          total + response.modifiedCount,
        0,
      ),
    };
  }

  handleNewNotification(
    notification: Notification,
  ): void {
    const currentUser =
      this.auth.getCurrentUser();

    if (!currentUser?.id) {
      return;
    }

    if (
      notification.readBy?.includes(
        currentUser.id,
      )
    ) {
      return;
    }

    const currentNotifications =
      this.notificationsSubject.value;

    const alreadyExists =
      currentNotifications.some(
        (item) =>
          item.id === notification.id,
      );

    if (alreadyExists) {
      return;
    }

    this.notificationsSubject.next(
      this.sortNotifications([
        notification,
        ...currentNotifications,
      ]),
    );

    this.showBrowserToast(
      notification,
    );
  }

  clearNotifications(): void {
    this.pendingReadIds.clear();
    this.notificationsSubject.next([]);
  }

  private applyOptimisticReadState(
    notificationIds: Set<string>,
    currentUserId: string,
  ): void {
    const notifications =
      this.notificationsSubject.value.map(
        (notification) => {
          if (
            !notificationIds.has(notification.id)
          ) {
            return notification;
          }

          return {
            ...notification,
            readBy: Array.from(
              new Set([
                ...(notification.readBy ?? []),
                currentUserId,
              ]),
            ),
          };
        },
      );

    this.notificationsSubject.next(
      notifications,
    );
  }

  private commitPendingReads(
    notificationIds: string[],
  ): void {
    const committedIds =
      new Set(notificationIds);

    notificationIds.forEach((id) =>
      this.pendingReadIds.delete(id),
    );

    this.notificationsSubject.next(
      this.notificationsSubject.value.filter(
        (notification) =>
          !committedIds.has(notification.id),
      ),
    );
  }

  private rollbackPendingReads(
    notificationIds: string[],
  ): void {
    const currentUser =
      this.auth.getCurrentUser();

    const rolledBackIds =
      new Set(notificationIds);

    notificationIds.forEach((id) =>
      this.pendingReadIds.delete(id),
    );

    if (!currentUser?.id) {
      return;
    }

    this.notificationsSubject.next(
      this.notificationsSubject.value.map(
        (notification) => {
          if (!rolledBackIds.has(notification.id)) {
            return notification;
          }

          return {
            ...notification,
            readBy: (notification.readBy ?? []).filter(
              (userId) => userId !== currentUser.id,
            ),
          };
        },
      ),
    );
  }

  private chunkNotificationIds(
    notificationIds: string[],
    chunkSize: number,
  ): string[][] {
    const chunks: string[][] = [];

    for (
      let index = 0;
      index < notificationIds.length;
      index += chunkSize
    ) {
      chunks.push(
        notificationIds.slice(
          index,
          index + chunkSize,
        ),
      );
    }

    return chunks;
  }

  private observeAuthentication(): void {
    this.auth.authenticationState$
      .pipe(
        distinctUntilChanged(),
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(
        (authenticationState) => {
          if (
            authenticationState ===
            'authenticated'
          ) {
            this.loadNotifications();
            return;
          }

          this.clearNotifications();
        },
      );
  }

  private listenToSocketNotifications():
    void {
    this.socketService.off(
      'notifications:new',
      this.newNotificationHandler,
    );

    this.socketService.on<Notification>(
      'notifications:new',
      this.newNotificationHandler,
    );
  }

  private sortNotifications(
    notifications: Notification[],
  ): Notification[] {
    return [...notifications].sort(
      (a, b) => {
        const dateA = a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;

        const dateB = b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;

        return dateB - dateA;
      },
    );
  }

  private showBrowserToast(
    notification: Notification,
  ): void {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window)
    ) {
      return;
    }

    if (
      window.Notification.permission ===
      'granted'
    ) {
      new window.Notification(
        notification.title,
        {
          body: notification.message,
        },
      );
    }
  }
}
