import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterOutlet } from '@angular/router';

import { ToastContainer } from './shared/components/toast-container/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App {}
