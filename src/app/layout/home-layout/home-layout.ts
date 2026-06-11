import { Component, OnInit, inject} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { SocketService } from '../../core/services/socket';
import { PreferencesService } from '../../core/services/preferences';

@Component({
  selector: 'app-home-layout',
  imports: [RouterOutlet, Sidebar],
  templateUrl: './home-layout.html',
  styleUrl: './home-layout.scss',
})
export class HomeLayout implements OnInit {
  private readonly preferencesService = inject(PreferencesService);
  private readonly socketService = inject(SocketService);

  isSidebarCollapsed = this.preferencesService.getSidebarCollapsedByDefault();

  ngOnInit(): void {
    const token = localStorage.getItem('token');

    if (token) {
      this.socketService.connect(token);
    }
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }
}