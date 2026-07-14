import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { Auth } from '../../../core/services/auth';
import { AuthUser } from '../../../core/models/auth-user';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  private readonly auth = inject(Auth);

  @Input() collapsed = false;
  @Output() toggle = new EventEmitter<void>();

  user: AuthUser | null = this.auth.getCurrentUser();

  constructor() {
    this.auth.currentUser$.subscribe((user) => {
      this.user = user;
    });
  }

  get userInitial(): string {
    if (!this.user?.name) {
      return '?';
    }

    return this.user.name.charAt(0).toUpperCase();
  }

  get profilePictureUrl(): string | null {
    if (!this.user?.profilePicture || !this.user?.id) {
      return null;
    }

    return `${environment.apiUrl}/api/users/${this.user.id}/profile-picture`;
  }

  canAccessRoles(...allowedRoles: string[]): boolean {
    const role = this.user?.role ?? '';

    return allowedRoles.some((allowedRole) =>
      role.toLowerCase().includes(allowedRole.toLowerCase()),
    );
  }
}
