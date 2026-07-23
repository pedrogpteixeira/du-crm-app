import {
  DestroyRef,
  Injectable,
  NgZone,
  inject,
} from '@angular/core';

import {
  BehaviorSubject,
  Observable,
  combineLatest,
  map,
} from 'rxjs';

import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import {
  io,
  Socket,
} from 'socket.io-client';

import { environment } from '../../../environments/environment';
import { Auth } from './auth';

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
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(Auth);

  private readonly socket: Socket;

  private connectedAccessToken: string | null = null;

  private readonly onlineUsersSubject =
    new BehaviorSubject<string[]>([]);

  readonly onlineUsers$ =
    this.onlineUsersSubject.asObservable();

  constructor() {
    this.socket = io(
      environment.socketUrl,
      {
        autoConnect: false,
        transports: ['websocket'],
        auth: {
          token: null,
        },
      },
    );

    this.registerConnectionListeners();
    this.registerPresenceListeners();
    this.observeAuthentication();
  }

  connect(): void {
    const accessToken =
      this.auth.getAccessToken();

    if (!accessToken) {
      return;
    }

    this.updateSocketAuthentication(
      accessToken,
    );

    if (this.socket.connected) {
      return;
    }

    this.connectedAccessToken =
      accessToken;

    this.socket.connect();
  }

  disconnect(): void {
    if (this.socket.connected) {
      this.socket.disconnect();
    }

    this.connectedAccessToken = null;

    this.zone.run(() => {
      this.onlineUsersSubject.next([]);
    });
  }

  refreshConnection(
    accessToken?: string,
  ): void {
    const currentAccessToken =
      accessToken ??
      this.auth.getAccessToken();

    if (!currentAccessToken) {
      this.disconnect();
      return;
    }

    this.updateSocketAuthentication(
      currentAccessToken,
    );

    if (!this.socket.connected) {
      this.connectedAccessToken =
        currentAccessToken;

      this.socket.connect();
      return;
    }

    if (
      this.connectedAccessToken ===
      currentAccessToken
    ) {
      return;
    }

    this.connectedAccessToken =
      currentAccessToken;

    this.socket.disconnect();
    this.socket.connect();
  }

  on<T>(
    eventName: string,
    callback: (data: T) => void,
  ): void {
    this.socket.on(
      eventName,
      callback,
    );
  }

  off<T>(
    eventName: string,
    callback?: (data: T) => void,
  ): void {
    if (callback) {
      this.socket.off(
        eventName,
        callback,
      );

      return;
    }

    this.socket.off(eventName);
  }

  isOnline$(
    userId: string,
  ): Observable<boolean> {
    return this.onlineUsers$.pipe(
      map((onlineUsers) =>
        onlineUsers.includes(userId),
      ),
    );
  }

  isOnline(userId: string): boolean {
    return this.onlineUsersSubject
      .value
      .includes(userId);
  }

  getOnlineUsers(): string[] {
    return [
      ...this.onlineUsersSubject.value,
    ];
  }

  listenRepsolContractCreated():
    Observable<RepsolContractSocketEvent> {
    return this.createEventObservable<
      RepsolContractSocketEvent
    >('repsol-contract:created');
  }

  listenRepsolContractUpdated():
    Observable<RepsolContractSocketEvent> {
    return this.createEventObservable<
      RepsolContractSocketEvent
    >('repsol-contract:updated');
  }

  private observeAuthentication(): void {
    combineLatest([
      this.auth.authenticationState$,
      this.auth.accessToken$,
    ])
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(
        ([
          authenticationState,
          accessToken,
        ]) => {
          if (
            authenticationState !==
              'authenticated' ||
            !accessToken
          ) {
            this.disconnect();
            return;
          }

          this.refreshConnection(
            accessToken,
          );
        },
      );
  }

  private updateSocketAuthentication(
    accessToken: string,
  ): void {
    this.socket.auth = {
      token: accessToken,
    };
  }

  private registerConnectionListeners():
    void {
    this.socket.off('connect');
    this.socket.off('disconnect');
    this.socket.off('connect_error');

    this.socket.on('connect', () => {
      this.connectedAccessToken =
        this.auth.getAccessToken();
    });

    this.socket.on(
      'disconnect',
      () => {
        this.zone.run(() => {
          this.onlineUsersSubject.next([]);
        });
      },
    );

    this.socket.on(
      'connect_error',
      (error: Error) => {
        console.error(
          'Erro na ligação Socket.IO:',
          error.message,
        );
      },
    );
  }

  private registerPresenceListeners():
    void {
    this.socket.off('users:online');

    this.socket.on(
      'users:online',
      (onlineUsers: string[]) => {
        this.zone.run(() => {
          this.onlineUsersSubject.next(
            Array.isArray(onlineUsers)
              ? onlineUsers
              : [],
          );
        });
      },
    );
  }

  private createEventObservable<T>(
    eventName: string,
  ): Observable<T> {
    return new Observable<T>(
      (observer) => {
        const handler = (
          payload: T,
        ): void => {
          this.zone.run(() => {
            observer.next(payload);
          });
        };

        this.socket.on(
          eventName,
          handler,
        );

        return () => {
          this.socket.off(
            eventName,
            handler,
          );
        };
      },
    );
  }
}