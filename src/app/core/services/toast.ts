import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastNotification {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

export interface ToastOptions {
  duration?: number;
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4500,
  error: 6500,
  warning: 5500,
  info: 5000,
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly state = signal<ToastNotification[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 1;

  readonly toasts = this.state.asReadonly();

  success(message: string, options?: ToastOptions): number {
    return this.show('success', message, options);
  }

  error(message: string, options?: ToastOptions): number {
    return this.show('error', message, options);
  }

  warning(message: string, options?: ToastOptions): number {
    return this.show('warning', message, options);
  }

  info(message: string, options?: ToastOptions): number {
    return this.show('info', message, options);
  }

  show(type: ToastType, message: string, options?: ToastOptions): number {
    const normalizedMessage = message?.trim();

    if (!normalizedMessage) {
      return -1;
    }

    const duplicate = this.state().find(
      (toast) => toast.type === type && toast.message === normalizedMessage,
    );

    if (duplicate) {
      this.dismiss(duplicate.id);
    }

    const id = this.nextId++;
    const duration = Math.max(1200, options?.duration ?? DEFAULT_DURATIONS[type]);
    const toast: ToastNotification = {
      id,
      type,
      message: normalizedMessage,
      duration,
    };

    const nextToasts = [...this.state(), toast];

    while (nextToasts.length > 5) {
      const oldest = nextToasts.shift();

      if (oldest) {
        this.clearTimer(oldest.id);
      }
    }

    this.state.set(nextToasts);

    const timer = setTimeout(() => {
      this.dismiss(id);
    }, duration);

    this.timers.set(id, timer);

    return id;
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.state.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  clear(): void {
    for (const id of this.timers.keys()) {
      this.clearTimer(id);
    }

    this.state.set([]);
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);

    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
