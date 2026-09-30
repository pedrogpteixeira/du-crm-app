import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastNotification, ToastService } from '../../../core/services/toast';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainer {
  readonly toastService = inject(ToastService);

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  getIcon(toast: ToastNotification): string {
    const icons: Record<ToastNotification['type'], string> = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info',
    };

    return icons[toast.type];
  }

  getTitle(toast: ToastNotification): string {
    const titles: Record<ToastNotification['type'], string> = {
      success: 'Sucesso',
      error: 'Ocorreu um erro',
      warning: 'Atenção',
      info: 'Informação',
    };

    return titles[toast.type];
  }

  trackByToastId(_index: number, toast: ToastNotification): number {
    return toast.id;
  }
}
