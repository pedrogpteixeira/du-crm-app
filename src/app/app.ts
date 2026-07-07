import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SocketService } from './core/services/socket';
import { Auth } from './core/services/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly auth = inject(Auth);

  constructor(private socketService: SocketService) {
    this.socketService.connect();
  }

  ngOnInit(): void {
    if (this.auth.hasToken() && !this.auth.getCurrentUser()) {
      this.auth.loadCurrentUser().subscribe();
    }
  }
}
