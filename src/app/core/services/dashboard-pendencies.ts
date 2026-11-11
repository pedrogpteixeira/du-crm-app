import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DashboardPendenciesResponse,
  DashboardPendingContract,
  DashboardPendingTicket,
} from '../models/dashboard-pendencies.model';
import type { ClientContractProvider } from './client';

interface RawDashboardPendenciesResponse {
  totals?: { contracts?: number; byState?: Record<string, number>; ticketsForReturnedContracts?: number };
  contracts?: unknown[];
  tickets?: unknown[];
  limit?: number;
  hasMoreContracts?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DashboardPendenciesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/dashboard/my-pendencies`;

  getMyPendencies(): Observable<DashboardPendenciesResponse> {
    return this.http.get<RawDashboardPendenciesResponse>(this.url).pipe(map((response) => this.normalize(response)));
  }

  private normalize(response: RawDashboardPendenciesResponse | null | undefined): DashboardPendenciesResponse {
    const raw = response ?? {};
    return {
      totals: {
        contracts: this.number(raw.totals?.contracts),
        byState: raw.totals?.byState && typeof raw.totals.byState === 'object' ? raw.totals.byState : {},
        ticketsForReturnedContracts: this.number(raw.totals?.ticketsForReturnedContracts),
      },
      contracts: (raw.contracts ?? []).map((item) => this.normalizeContract(item)).filter((item): item is DashboardPendingContract => item !== null),
      tickets: (raw.tickets ?? []).map((item) => this.normalizeTicket(item)).filter((item): item is DashboardPendingTicket => item !== null),
      limit: this.number(raw.limit),
      hasMoreContracts: raw.hasMoreContracts === true,
    };
  }

  private normalizeContract(value: unknown): DashboardPendingContract | null {
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    const id = this.text(item['id'] ?? item['_id'] ?? item['contractId']);
    if (!id) return null;
    return {
      id,
      contractId: this.text(item['contractId']) || id,
      companyId: this.text(item['companyId']),
      provider: this.provider(item['provider']),
      nomeClienteEmpresa: this.nullableText(item['nomeClienteEmpresa'] ?? item['nomeCliente'] ?? item['cliente']),
      nif: typeof item['nif'] === 'number' || typeof item['nif'] === 'string' ? item['nif'] : null,
      estado: this.nullableText(item['estado']),
      updatedAt: this.nullableText(item['updatedAt'] ?? item['modifiedAt']),
    };
  }

  private normalizeTicket(value: unknown): DashboardPendingTicket | null {
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    const id = this.text(item['id'] ?? item['_id'] ?? item['ticketId']);
    const contractId = this.text(item['contractId']);
    return id && contractId ? { id, contractId } : null;
  }

  private provider(value: unknown): ClientContractProvider | null {
    const provider = this.text(value) as ClientContractProvider;
    return ['repsol','portulogos','portulogos-b2b','ezu-b2b','nossa-energia-b2b','audax-b2b','plenitude-b2b','endesa-b2b','wallbox','yes-energy','galp-power-gas','galp-solar','iberdrola','iberdrola-solar','meo-energias','vodafone'].includes(provider) ? provider : null;
  }

  private text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
  private nullableText(value: unknown): string | null { const text = this.text(value); return text || null; }
  private number(value: unknown): number { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : 0; }
}
