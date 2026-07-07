import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { SocketService } from '../../core/services/socket';
import { PreferencesService } from '../../core/services/preferences';
import { NotificationService } from '../../core/services/notification';
import { NotificationDropdown } from "../../shared/notification-dropdown/notification-dropdown";
import { filter } from 'rxjs';

@Component({
  selector: 'app-home-layout',
  imports: [RouterOutlet, Sidebar, NotificationDropdown],
  templateUrl: './home-layout.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './home-layout.scss',
})
export class HomeLayout implements OnInit {
  private readonly router = inject(Router);
  private readonly preferencesService = inject(PreferencesService);
  private readonly socketService = inject(SocketService);
  private readonly notificationService = inject(NotificationService);

  isSidebarCollapsed = this.preferencesService.getSidebarCollapsedByDefault();

  pageTitle = 'Dashboard';

  constructor() {
    this.notificationService.init();

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.pageTitle = this.getPageTitle(this.router.url);
      });
  }

  ngOnInit(): void {
    this.socketService.connect();
    this.notificationService.init();
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  private getPageTitle(url: string): string {
    if (url.includes('/users')) return 'Utilizadores';
    if (url.includes('/teams')) return 'Equipas';
    if (url.includes('/contracts/repsol')) return 'Contratos';
    if (url.includes('/tariffs/create')) return 'Novo Tarifário';
    if (url.includes('/tariffs/edit')) return 'Editar Tarifários';
    if (url.includes('/invoice-compare')) return 'Comparar Fatura';
    if (url.includes('/knowledge-base')) return 'Conhecimento';
    if (url.includes('/profile')) return 'Perfil';

    return 'Dashboard';
  }
}
