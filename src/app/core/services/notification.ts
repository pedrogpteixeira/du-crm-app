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
  map,
} from 'rxjs';

import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification.model';

import { Auth } from './auth';
import { SocketService } from './socket';

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

  markAsRead(
    notificationId: string,
  ): void {
    this.http
      .patch<Notification>(
        `${this.apiUrl}/api/notifications/${notificationId}/read`,
        {},
      )
      .subscribe({
        next: () => {
          const notifications =
            this.notificationsSubject.value.filter(
              (notification) =>
                notification.id !==
                notificationId,
            );

          this.notificationsSubject.next(
            notifications,
          );
        },
      });
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
    this.notificationsSubject.next([]);
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