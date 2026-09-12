import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';

import { finalize } from 'rxjs';

import { Notification } from '../../core/models/notification.model';
import { getNotificationRoute } from '../../core/utils/notification-route';
import { Auth } from '../../core/services/auth';
import { NotificationService } from '../../core/services/notification';

@Component({
  selector: 'app-notification-dropdown',
  imports: [CommonModule],
  templateUrl: './notification-dropdown.html',
  styleUrl: './notification-dropdown.scss',
})
export class NotificationDropdown {
  private readonly notificationService =
    inject(NotificationService);

  private readonly elementRef =
    inject(ElementRef);

  private readonly auth =
    inject(Auth);

  private readonly router =
    inject(Router);

  readonly notifications$ =
    this.notificationService.notifications$;

  readonly unreadCount$ =
    this.notificationService.unreadCount$;

  isOpen = false;
  isMarkingAllAsRead = false;
  markAllErrorMessage = '';

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();

    if (this.isOpen) {
      this.closeDropdown();
      return;
    }

    this.isOpen = true;
    this.markAllErrorMessage = '';
  }

  closeDropdown(): void {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    this.flushPendingReads();
  }

  hasNotificationRoute(notification: Notification): boolean {
    return getNotificationRoute(notification) !== null;
  }

  openNotification(notification: Notification): void {
    this.markAsRead(notification);

    const route = getNotificationRoute(notification);

    if (!route) {
      return;
    }

    this.closeDropdown();
    void this.router.navigate([...route]);
  }

  onNotificationKeydown(
    event: KeyboardEvent,
    notification: Notification,
  ): void {
    if (!this.hasNotificationRoute(notification)) {
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.openNotification(notification);
  }

  markAsRead(notification: Notification): void {
    if (this.isRead(notification)) {
      return;
    }

    this.notificationService.queueAsRead(
      notification.id,
    );
  }

  markNotificationAsRead(
    event: MouseEvent,
    notification: Notification,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    this.markAsRead(notification);
  }

  markAllAsRead(event: MouseEvent): void {
    event.stopPropagation();

    if (this.isMarkingAllAsRead) {
      return;
    }

    this.notificationService.queueAllAsRead();

    this.isMarkingAllAsRead = true;
    this.markAllErrorMessage = '';

    this.notificationService
      .flushPendingReads()
      .pipe(
        finalize(() => {
          this.isMarkingAllAsRead = false;
        }),
      )
      .subscribe({
        error: () => {
          this.markAllErrorMessage =
            'Não foi possível marcar todas as notificações como lidas.';
        },
      });
  }

  isRead(notification: Notification): boolean {
    const currentUser =
      this.auth.getCurrentUser();

    if (!currentUser?.id) {
      return false;
    }

    return notification.readBy?.includes(
      currentUser.id,
    );
  }

  getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
      info: 'info',
      success: 'check_circle',
      warning: 'warning',
      error: 'error',
    };

    return icons[type] || 'notifications';
  }

  formatDate(value?: string): string {
    if (!value) {
      return '';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) {
      return;
    }

    const clickedInside =
      this.elementRef.nativeElement.contains(
        event.target,
      );

    if (!clickedInside) {
      this.closeDropdown();
    }
  }

  private flushPendingReads(): void {
    this.notificationService
      .flushPendingReads()
      .subscribe({
        error: () => {
          /*
           * O service faz rollback do estado otimista.
           * A notificação voltará a aparecer como não lida.
           */
        },
      });
  }
}
