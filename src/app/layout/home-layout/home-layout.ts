import { Component, OnInit, inject} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { SocketService } from '../../core/services/socket';

@Component({
  selector: 'app-home-layout',
  imports: [RouterOutlet, Sidebar],
  templateUrl: './home-layout.html',
  styleUrl: './home-layout.scss',
})
export class HomeLayout implements OnInit {
  isSidebarCollapsed = false;

  private readonly socketService = inject(SocketService);

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