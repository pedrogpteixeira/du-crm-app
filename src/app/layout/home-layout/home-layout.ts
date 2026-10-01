import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { PasswordPolicy } from '../../core/models/password-policy';
import { Auth } from '../../core/services/auth';
import { PreferencesService } from '../../core/services/preferences';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { SystemNoticeComponent } from '../../shared/components/system-notice/system-notice';
import { NotificationDropdown } from '../../shared/notification-dropdown/notification-dropdown';

@Component({
  selector: 'app-home-layout',
  imports: [
    CommonModule,
    RouterOutlet,
    Sidebar,
    NotificationDropdown,
    SystemNoticeComponent,
  ],
  templateUrl: './home-layout.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './home-layout.scss',
})
export class HomeLayout {
  private readonly preferencesService =
    inject(PreferencesService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly mobileSidebarQuery =
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 900px)')
      : null;

  isMobileViewport =
    this.mobileSidebarQuery?.matches ?? false;

  passwordWarningMessage: string | null = null;

  isSidebarCollapsed = this.isMobileViewport
    ? true
    : this.preferencesService
        .getSidebarCollapsedByDefault();

  constructor() {
    const mediaQuery = this.mobileSidebarQuery;

    if (mediaQuery) {
      const onViewportChange = (
        event: MediaQueryListEvent,
      ): void => {
        this.isMobileViewport = event.matches;

        if (event.matches) {
          this.isSidebarCollapsed = true;
        } else {
          this.isSidebarCollapsed =
            this.preferencesService
              .getSidebarCollapsedByDefault();
        }
      };

      mediaQuery.addEventListener(
        'change',
        onViewportChange,
      );

      this.destroyRef.onDestroy(() => {
        mediaQuery.removeEventListener(
          'change',
          onViewportChange,
        );
      });
    }

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd =>
            event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.isMobileViewport) {
          this.isSidebarCollapsed = true;
        }
      });


    this.auth.passwordPolicy$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((policy) => {
        this.passwordWarningMessage = this.getPasswordWarningMessage(policy);
      });
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed =
      !this.isSidebarCollapsed;
  }

  goToPasswordChange(): void {
    void this.router.navigate(['/change-password']);
  }

  closeMobileSidebar(): void {
    if (this.isMobileViewport) {
      this.isSidebarCollapsed = true;
    }
  }

  private getPasswordWarningMessage(policy: PasswordPolicy | null): string | null {
    if (
      !policy?.enabled ||
      policy.expired ||
      policy.daysRemaining !== 1
    ) {
      return null;
    }

    return 'A sua palavra-passe expira amanhã.';
  }

}
