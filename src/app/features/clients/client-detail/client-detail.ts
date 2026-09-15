import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  getContractDetailRouteByProvider,
  getContractProviderName,
} from '../../../core/config/contract-detail-route';
import { getContractStatusColor } from '../../../core/config/contract-status-colors';
import {
  ClientContract,
  ClientDetails,
  ClientService,
} from '../../../core/services/client';
import { sortContractsByUpdatedAtDesc } from '../../../core/utils/contract-sorting';

const ACTIVE_CONTRACT_STATUSES = new Set([
  'ativo',
  'atribuido',
]);

const CLOSED_CONTRACT_STATUSES = new Set([
  'cancelado',
  'cancelada',
  'anulado',
  'baixa',
  'parcialmente baixa',
]);

@Component({
  selector: 'app-client-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './client-detail.html',
  styleUrl: './client-detail.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ClientDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly clientService = inject(ClientService);
  private readonly destroyRef = inject(DestroyRef);

  client: ClientDetails | null = null;
  contracts: ClientContract[] = [];

  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const clientId = params.get('clientId') ?? '';

        if (!clientId) {
          this.client = null;
          this.contracts = [];
          this.errorMessage = 'Não foi possível identificar o cliente.';
          return;
        }

        this.loadClient(clientId);
      });
  }

  get totalContracts(): number {
    return this.contracts.length;
  }

  get activeContracts(): number {
    return this.contracts.filter((contract) =>
      ACTIVE_CONTRACT_STATUSES.has(this.normalizeStatus(contract.estado)),
    ).length;
  }

  get closedContracts(): number {
    return this.contracts.filter((contract) =>
      CLOSED_CONTRACT_STATUSES.has(this.normalizeStatus(contract.estado)),
    ).length;
  }

  get inProgressContracts(): number {
    return Math.max(
      this.totalContracts - this.activeContracts - this.closedContracts,
      0,
    );
  }

  get clientPhone(): string {
    const value = this.client?.phone ?? this.client?.telefone;
    return typeof value === 'string' && value.trim() ? value.trim() : '—';
  }

  get clientEmail(): string {
    const value = this.client?.email;
    return typeof value === 'string' && value.trim() ? value.trim() : '—';
  }

  get clientAddress(): string {
    const value = this.client?.address ?? this.client?.morada;
    return typeof value === 'string' && value.trim() ? value.trim() : '—';
  }

  loadClient(clientId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.clientService
      .getClientById(clientId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (client) => {
          this.client = client;
          this.contracts = sortContractsByUpdatedAtDesc(client.contracts ?? []);
        },
        error: (error: HttpErrorResponse) => {
          this.client = null;
          this.contracts = [];
          this.errorMessage =
            error.status === 404
              ? 'O cliente indicado não existe.'
              : error.status === 403
                ? 'Não tem permissão para consultar este cliente.'
                : error.error?.message || 'Não foi possível carregar o cliente.';
        },
      });
  }

  getContractDetailRoute(contract: ClientContract): string[] | null {
    return getContractDetailRouteByProvider(contract.provider, contract.id);
  }

  getProviderName(contract: ClientContract): string {
    return getContractProviderName(contract.provider);
  }

  getStatusColor(status: string | undefined): string {
    return getContractStatusColor(status ?? '');
  }

  getResponsibleName(contract: ClientContract): string {
    return contract.user?.name?.trim() || '—';
  }

  getValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return String(value);
  }

  trackContract(_: number, contract: ClientContract): string {
    return contract.id;
  }

  private normalizeStatus(status: string | undefined): string {
    return (status ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
