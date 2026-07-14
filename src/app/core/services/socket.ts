import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { io, Socket } from 'socket.io-client';

import { environment } from '../../../environments/environment';

export interface RepsolContractSocketEvent {
  contractId: string;
  estado: string;
  nomeClienteEmpresa: string;
  nif: number;
}

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private readonly zone = inject(NgZone);

  private socket: Socket | null = null;

  private readonly onlineUsersSubject = new BehaviorSubject<string[]>([]);
  onlineUsers$ = this.onlineUsersSubject.asObservable();

  connect(): void {
    const token = localStorage.getItem('token');

    if (token) {
      if (this.socket?.connected) {
        return;
      }

      this.socket = io(environment.socketUrl, {
        transports: ['websocket'],
        auth: { token },
      });

      this.registerPresenceListeners();
    }
  }

  disconnect(): void {
    this.socket?.off('users:online');
    this.socket?.disconnect();
    this.socket = null;
    this.onlineUsersSubject.next([]);
  }

  on<T>(eventName: string, callback: (data: T) => void): void {
    this.socket?.on(eventName, callback);
  }

  off(eventName: string): void {
    this.socket?.off(eventName);
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

  public listenRepsolContractCreated(): Observable<RepsolContractSocketEvent> {
    return new Observable((observer) => {
      if (!this.socket) {
        observer.complete();
        return;
      }

      const handler = (payload: RepsolContractSocketEvent) => {
        observer.next(payload);
      };

      this.socket.on('repsol-contract:created', handler);

      return () => {
        this.socket?.off('repsol-contract:created', handler);
      };
    });
  }

  public listenRepsolContractUpdated(): Observable<RepsolContractSocketEvent> {
    return new Observable((observer) => {
      if (!this.socket) {
        observer.complete();
        return;
      }

      const handler = (payload: RepsolContractSocketEvent) => {
        observer.next(payload);
      };

      this.socket.on('repsol-contract:updated', handler);

      return () => {
        this.socket?.off('repsol-contract:updated', handler);
      };
    });
  }
}