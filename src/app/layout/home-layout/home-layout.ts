import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';

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

  isSidebarCollapsed =
    this.preferencesService
      .getSidebarCollapsedByDefault();

  toggleSidebar(): void {
    this.isSidebarCollapsed =
      !this.isSidebarCollapsed;
  }
}
