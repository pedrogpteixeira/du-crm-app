import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SocketService } from './core/services/socket';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor(private socketService: SocketService) {
    const token = localStorage.getItem('token');

    if (token) {
      this.socketService.connect(token);
    }
  }
}