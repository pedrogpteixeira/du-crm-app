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

import { PreferencesService } from '../../core/services/preferences';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { NotificationDropdown } from '../../shared/notification-dropdown/notification-dropdown';

@Component({
  selector: 'app-home-layout',
  imports: [
    RouterOutlet,
    Sidebar,
    NotificationDropdown,
  ],
  templateUrl: './home-layout.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './home-layout.scss',
})
export class HomeLayout {
  private readonly preferencesService =
    inject(PreferencesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly mobileSidebarQuery =
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 900px)')
      : null;

  isMobileViewport =
    this.mobileSidebarQuery?.matches ?? false;

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
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed =
      !this.isSidebarCollapsed;
  }

  closeMobileSidebar(): void {
    if (this.isMobileViewport) {
      this.isSidebarCollapsed = true;
    }
  }
}
