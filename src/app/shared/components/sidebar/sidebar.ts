import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { environment } from '../../../../environments/environment';

import { Auth } from '../../../core/services/auth';
import { AuthUser } from '../../../core/models/auth-user';

@Component({
  selector: 'app-sidebar',
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class Sidebar {
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);

  @Input() collapsed = false;

  @Output() toggle = new EventEmitter<void>();

  user: AuthUser | null = this.auth.getCurrentUser();

  constructor() {
    this.auth.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.user = user;
      });
  }

  get userInitial(): string {
    if (!this.user?.name) {
      return '?';
    }

    return this.user.name
      .charAt(0)
      .toUpperCase();
  }

  get profilePictureUrl(): string | null {
    if (
      !this.user?.profilePicture ||
      !this.user?.id
    ) {
      return null;
    }

    return `${environment.apiUrl}/api/users/${this.user.id}/profile-picture`;
  }

  canAccessRoles(...allowedRoles: string[]): boolean {
    const role = this.user?.role?.trim() ?? '';

    if (!role) {
      return false;
    }

    const normalizedRole = role.toLowerCase();

    return allowedRoles.some((allowedRole) =>
      normalizedRole.includes(
        allowedRole.toLowerCase(),
      ),
    );
  }
}