import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { RouterOutlet } from '@angular/router';

import { TeamService } from './core/services/team';
import { ToastContainer } from './shared/components/toast-container/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    // TeamService owns the global Teams cache + Socket.IO invalidation flow.
    // Instantiate it once at app bootstrap so synchronization is independent
    // from whichever authenticated route is currently mounted.
    inject(TeamService);
  }
}
