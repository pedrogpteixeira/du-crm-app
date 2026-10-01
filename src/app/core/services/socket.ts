import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';

import { BehaviorSubject, Observable, filter, map, take } from 'rxjs';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { io, Socket } from 'socket.io-client';

import { environment } from '../../../environments/environment';
import type { ContractActivitySocketPayload } from '../models/contract-activity';
import type { PasswordPolicy } from '../models/password-policy';
import { Auth } from './auth';
import { CriticalRequestService } from './critical-request';
import { SystemNoticeService } from './system-notice';
import type { TicketApiModel } from './ticket';

interface ContractSocketBaseEvent extends ContractActivitySocketPayload {
  contractId: string;
  estado: string;
  nomeClienteEmpresa: string;
  nif: number;
  updatedBy?: string;
  userId?: string;
  updatedByUserId?: string;
  observacoes?: string;
  observacoesInternas?: string;
}

export interface AssignableUsersInvalidationEvent {
  reason?: string;
  timestamp?: string;
}

export interface TeamsInvalidationEvent {
  reason?: string;
  timestamp: string;
}

export interface AutosInvalidationEvent {
  reason?: string;
  timestamp: string;
}

export interface TicketSocketEvent extends TicketApiModel {
  ticketId?: string;
  id?: string;
  updatedBy?: string;
  userId?: string;
  updatedByUserId?: string;
  ticket?: TicketApiModel;
}

export interface GalpSolarContractSocketEvent extends ContractSocketBaseEvent {}

export interface GalpPowerGasContractSocketEvent extends ContractSocketBaseEvent {}

export interface RepsolContractSocketEvent extends ContractSocketBaseEvent {}

export interface PortulogosContractSocketEvent extends ContractSocketBaseEvent {}

export interface WallboxContractSocketEvent extends ContractSocketBaseEvent {}

export interface YesEnergyContractSocketEvent extends ContractSocketBaseEvent {}

export interface IberdrolaContractSocketEvent extends ContractSocketBaseEvent {}

export interface IberdrolaSolarContractSocketEvent extends ContractSocketBaseEvent {}

export interface MeoEnergiasContractSocketEvent extends ContractSocketBaseEvent {}

export interface VodafoneContractSocketEvent extends ContractSocketBaseEvent {}

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(Auth);
  private readonly criticalRequests = inject(CriticalRequestService);
  private readonly router = inject(Router);
  private readonly systemNotices = inject(SystemNoticeService);

  private readonly socket: Socket;

  private connectedAccessToken: string | null = null;
  private passwordRedirectPending = false;

  private readonly onlineUsersSubject = new BehaviorSubject<string[]>([]);

  readonly onlineUsers$ = this.onlineUsersSubject.asObservable();

  constructor() {
    this.socket = io(environment.socketUrl, {
      autoConnect: false,
      transports: ['websocket'],
      auth: {},
    });

    this.registerConnectionListeners();
    this.registerPresenceListeners();
    this.registerGlobalApplicationListeners();
    this.observeAuthentication();
  }

  isConnected(): boolean {
    return this.socket.connected;
  }

  connect(): void {
    const accessToken = this.auth.getAccessToken();

    if (!accessToken) {
      this.disconnect();
      return;
    }

    this.refreshConnection(accessToken);
  }

  disconnect(): void {
    if (this.socket.connected) {
      this.socket.disconnect();
    }

    this.socket.auth = {};
    this.connectedAccessToken = null;

    this.zone.run(() => {
      this.onlineUsersSubject.next([]);
    });
  }

  refreshConnection(accessToken: string | null = this.auth.getAccessToken()): void {
    if (!accessToken) {
      this.disconnect();
      return;
    }

    this.updateSocketAuthentication(accessToken);

    if (!this.socket.connected) {
      this.connectedAccessToken = accessToken;
      this.socket.connect();
      return;
    }

    if (this.connectedAccessToken === accessToken) {
      return;
    }

    this.connectedAccessToken = accessToken;
    this.socket.disconnect();
    this.socket.connect();
  }

  on<T>(eventName: string, callback: (data: T) => void): void {
    this.socket.on(eventName, callback);
  }

  off<T>(eventName: string, callback?: (data: T) => void): void {
    if (callback) {
      this.socket.off(eventName, callback);

      return;
    }

    this.socket.off(eventName);
  }

  isOnline$(userId: string): Observable<boolean> {
    return this.onlineUsers$.pipe(map((onlineUsers) => onlineUsers.includes(userId)));
  }

  isOnline(userId: string): boolean {
    return this.onlineUsersSubject.value.includes(userId);
  }

  getOnlineUsers(): string[] {
    return [...this.onlineUsersSubject.value];
  }

  listenRepsolContractCreated(): Observable<RepsolContractSocketEvent> {
    return this.createEventObservable<RepsolContractSocketEvent>('repsol-contract:created');
  }

  listenRepsolContractUpdated(): Observable<RepsolContractSocketEvent> {
    return this.createEventObservable<RepsolContractSocketEvent>('repsol-contract:updated');
  }

  listenPortulogosContractCreated(): Observable<PortulogosContractSocketEvent> {
    return this.createEventObservable<PortulogosContractSocketEvent>('portulogos-contract:created');
  }

  listenPortulogosContractUpdated(): Observable<PortulogosContractSocketEvent> {
    return this.createEventObservable<PortulogosContractSocketEvent>('portulogos-contract:updated');
  }

  listenGalpSolarContractCreated(): Observable<GalpSolarContractSocketEvent> {
    return this.createEventObservable<GalpSolarContractSocketEvent>('galp-solar-contract:created');
  }

  listenGalpSolarContractUpdated(): Observable<GalpSolarContractSocketEvent> {
    return this.createEventObservable<GalpSolarContractSocketEvent>('galp-solar-contract:updated');
  }

  listenGalpPowerGasContractCreated(): Observable<GalpPowerGasContractSocketEvent> {
    return this.createEventObservable<GalpPowerGasContractSocketEvent>(
      'galp-power-gas-contract:created',
    );
  }

  listenGalpPowerGasContractUpdated(): Observable<GalpPowerGasContractSocketEvent> {
    return this.createEventObservable<GalpPowerGasContractSocketEvent>(
      'galp-power-gas-contract:updated',
    );
  }

  listenWallboxContractCreated() {
    return this.createEventObservable<WallboxContractSocketEvent>('wallbox-contract:created');
  }

  listenWallboxContractUpdated() {
    return this.createEventObservable<WallboxContractSocketEvent>('wallbox-contract:updated');
  }

  listenYesEnergyContractCreated() {
    return this.createEventObservable<YesEnergyContractSocketEvent>('yes-energy-contract:created');
  }

  listenYesEnergyContractUpdated() {
    return this.createEventObservable<YesEnergyContractSocketEvent>('yes-energy-contract:updated');
  }

  listenIberdrolaContractCreated() {
    return this.createEventObservable<IberdrolaContractSocketEvent>('iberdrola-contract:created');
  }

  listenIberdrolaContractUpdated() {
    return this.createEventObservable<IberdrolaContractSocketEvent>('iberdrola-contract:updated');
  }

  listenIberdrolaSolarContractCreated() {
    return this.createEventObservable<IberdrolaSolarContractSocketEvent>(
      'iberdrola-solar-contract:created',
    );
  }

  listenIberdrolaSolarContractUpdated() {
    return this.createEventObservable<IberdrolaSolarContractSocketEvent>(
      'iberdrola-solar-contract:updated',
    );
  }

  listenMeoEnergiasContractCreated() {
    return this.createEventObservable<MeoEnergiasContractSocketEvent>(
      'meo-energias-contract:created',
    );
  }

  listenMeoEnergiasContractUpdated() {
    return this.createEventObservable<MeoEnergiasContractSocketEvent>(
      'meo-energias-contract:updated',
    );
  }

  listenVodafoneContractCreated() {
    return this.createEventObservable<VodafoneContractSocketEvent>('vodafone-contract:created');
  }

  listenVodafoneContractUpdated() {
    return this.createEventObservable<VodafoneContractSocketEvent>('vodafone-contract:updated');
  }

  listenAssignableUsersInvalidated(): Observable<AssignableUsersInvalidationEvent> {
    return this.createEventObservable<AssignableUsersInvalidationEvent>(
      'users:assignable:invalidated',
    );
  }

  listenTeamsInvalidated(): Observable<TeamsInvalidationEvent> {
    return this.createEventObservable<TeamsInvalidationEvent>('teams:invalidated');
  }

  listenAutosInvalidated(): Observable<AutosInvalidationEvent> {
    return this.createEventObservable<AutosInvalidationEvent>('autos:invalidated');
  }

  listenConnected(): Observable<void> {
    return this.createEventObservable<void>('connect');
  }

  listenTicketCreated(): Observable<TicketSocketEvent> {
    return this.createEventObservable<TicketSocketEvent>('ticket:created');
  }

  listenTicketUpdated(): Observable<TicketSocketEvent> {
    return this.createEventObservable<TicketSocketEvent>('ticket:updated');
  }

  private observeAuthentication(): void {
    this.auth.accessToken$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((accessToken) => {
      this.refreshConnection(accessToken);
    });
  }

  private updateSocketAuthentication(accessToken: string): void {
    this.socket.auth = { token: accessToken };
  }

  private registerGlobalApplicationListeners(): void {
    this.socket.off('auth:password-status');
    this.socket.off('auth:password-expired');
    this.socket.off('auth:session-invalidated');
    this.socket.off('system:notice');

    this.socket.on('auth:password-status', (policy: PasswordPolicy) => {
      this.zone.run(() => {
        this.auth.setPasswordPolicy(policy);

        if (policy.expired) {
          this.redirectToPasswordChangeWhenSafe();
        }
      });
    });

    this.socket.on('auth:password-expired', (policy?: PasswordPolicy) => {
      this.zone.run(() => {
        this.auth.markPasswordExpired(policy ?? null);
        this.redirectToPasswordChangeWhenSafe();
      });
    });

    this.socket.on('auth:session-invalidated', () => {
      this.zone.run(() => {
        this.auth.clearSession();

        void this.router.navigate(['/login'], {
          replaceUrl: true,
          queryParams: {
            sessionInvalidated: 'true',
          },
        });
      });
    });

    this.socket.on('system:notice', (notice: unknown) => {
      this.zone.run(() => {
        this.systemNotices.handleIncomingNotice(notice);
      });
    });
  }

  private redirectToPasswordChangeWhenSafe(): void {
    if (this.passwordRedirectPending) {
      return;
    }

    if (this.criticalRequests.count === 0) {
      void this.router.navigate(['/change-password'], {
        replaceUrl: true,
      });
      return;
    }

    this.passwordRedirectPending = true;

    this.criticalRequests.count$
      .pipe(
        filter((count) => count === 0),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.passwordRedirectPending = false;

        if (!this.auth.isPasswordExpired()) {
          return;
        }

        void this.router.navigate(['/change-password'], {
          replaceUrl: true,
        });
      });
  }

  private registerConnectionListeners(): void {
    this.socket.off('connect');
    this.socket.off('disconnect');
    this.socket.off('connect_error');

    this.socket.on('connect', () => {
      this.connectedAccessToken = this.auth.getAccessToken();
    });

    this.socket.on('disconnect', () => {
      this.zone.run(() => {
        this.onlineUsersSubject.next([]);
      });
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Erro na ligação Socket.IO:', error.message);
    });
  }

  private registerPresenceListeners(): void {
    this.socket.off('users:online');

    this.socket.on('users:online', (onlineUsers: string[]) => {
      this.zone.run(() => {
        this.onlineUsersSubject.next(Array.isArray(onlineUsers) ? onlineUsers : []);
      });
    });
  }

  private createEventObservable<T>(eventName: string): Observable<T> {
    return new Observable<T>((observer) => {
      const handler = (payload: T): void => {
        this.zone.run(() => {
          observer.next(payload);
        });
      };

      this.socket.on(eventName, handler);

      return () => {
        this.socket.off(eventName, handler);
      };
    });
  }
}
