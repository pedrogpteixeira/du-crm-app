import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { io, Socket } from 'socket.io-client';

import { environment } from '../../../environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private readonly zone = inject(NgZone);

  private socket: Socket | null = null;

  private readonly onlineUsersSubject = new BehaviorSubject<string[]>([]);
  onlineUsers$ = this.onlineUsersSubject.asObservable();

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
      auth: { token },
    });

    this.registerPresenceListeners();
  }

  disconnect(): void {
    this.socket?.off('users:online');
    this.socket?.disconnect();
    this.socket = null;
    this.onlineUsersSubject.next([]);
  }

  isOnline$(userId: string): Observable<boolean> {
    return this.onlineUsers$.pipe(
      map((onlineUsers) => onlineUsers.includes(userId)),
    );
  }

  getOnlineUsers(): string[] {
    return this.onlineUsersSubject.value;
  }

  private registerPresenceListeners(): void {
    if (!this.socket) {
      return;
    }

    this.socket.off('users:online');

    this.socket.on('users:online', (onlineUsers: string[]) => {
      this.zone.run(() => {
        this.onlineUsersSubject.next(onlineUsers);
      });
    });
  }
}