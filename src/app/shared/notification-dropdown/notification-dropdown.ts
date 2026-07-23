import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  inject,
} from '@angular/core';

import { finalize } from 'rxjs';

import { Notification } from '../../core/models/notification.model';
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

  readonly notifications$ =
    this.notificationService.notifications$;

  readonly unreadCount$ =
    this.notificationService.unreadCount$;

  isOpen = false;
  isMarkingAllAsRead = false;
  markAllErrorMessage = '';

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();

    this.isOpen = !this.isOpen;
    this.markAllErrorMessage = '';
  }

  closeDropdown(): void {
    this.isOpen = false;
  }

  markAsRead(notification: Notification): void {
    if (this.isRead(notification)) {
      return;
    }

    this.notificationService.markAsRead(
      notification.id,
    );
  }

  markAllAsRead(event: MouseEvent): void {
    event.stopPropagation();

    if (this.isMarkingAllAsRead) {
      return;
    }

    this.isMarkingAllAsRead = true;
    this.markAllErrorMessage = '';

    this.notificationService
      .markAllAsRead()
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
      this.isOpen = false;
    }
  }
}