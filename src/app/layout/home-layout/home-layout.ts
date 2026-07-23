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

import {
  filter,
} from 'rxjs';

import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { NotificationDropdown } from '../../shared/notification-dropdown/notification-dropdown';

import { PreferencesService } from '../../core/services/preferences';
import { NotificationService } from '../../core/services/notification';

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
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly preferencesService =
    inject(PreferencesService);

  isSidebarCollapsed =
    this.preferencesService
      .getSidebarCollapsedByDefault();

  pageTitle = 'Dashboard';

  constructor() {

    this.pageTitle =
      this.getPageTitle(this.router.url);

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd =>
            event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.pageTitle =
          this.getPageTitle(event.urlAfterRedirects);
      });
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed =
      !this.isSidebarCollapsed;
  }

  private getPageTitle(url: string): string {
    if (url.includes('/users')) {
      return 'Utilizadores';
    }

    if (url.includes('/teams')) {
      return 'Equipas';
    }

    if (url.includes('/contracts/repsol')) {
      return 'Contratos';
    }

    if (url.includes('/tariffs')) {
      return 'Tarifários';
    }

    if (url.includes('/invoice-compare')) {
      return 'Comparar Fatura';
    }

    if (url.includes('/knowledge-base')) {
      return 'Conhecimento';
    }

    if (url.includes('/profile')) {
      return 'Perfil';
    }

    if (url.includes('/omie-averages')) {
      return 'Médias OMIE';
    }

    return 'Dashboard';
  }
}