import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { getContractCompanyName, getContractDetailRoute, getContractDetailRouteByProvider } from '../../../core/config/contract-detail-route';
import { getContractStatusColor } from '../../../core/config/contract-status-colors';
import { DashboardPendingContract, DashboardPendenciesResponse } from '../../../core/models/dashboard-pendencies.model';
import { DashboardPendenciesService } from '../../../core/services/dashboard-pendencies';
import { Auth } from '../../../core/services/auth';
import { Tickets } from '../../tickets/tickets/tickets';

@Component({
  selector: 'app-my-dashboard',
  imports: [CommonModule, Tickets],
  templateUrl: './my-dashboard.html',
  styleUrl: './my-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyDashboard {
  private readonly service = inject(DashboardPendenciesService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly data = signal<DashboardPendenciesResponse | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  constructor() {
    if (this.auth.roleIncludes(['Super Admin', 'DU'])) {
      void this.router.navigate(['/home/dashboard'], { replaceUrl: true });
      return;
    }

    this.loadPendencies();
  }

  get nonComplianceCount(): number { return this.stateCount('Não Conformidade'); }
  get pendingDocsCount(): number { return this.stateCount('Pendente Docs'); }
  get totalPending(): number { return this.data()?.totals.contracts ?? 0; }

  contracts(): DashboardPendingContract[] {
    return [...(this.data()?.contracts ?? [])].sort((a, b) => this.timestamp(b.updatedAt) - this.timestamp(a.updatedAt));
  }

  companyName(contract: DashboardPendingContract): string {
    return getContractCompanyName(contract.companyId, contract.contractId);
  }

  statusColor(status: string | null): string { return getContractStatusColor(status ?? ''); }

  ticketCount(contractId: string): number {
    return (this.data()?.tickets ?? []).filter((ticket) => ticket.contractId === contractId).length;
  }

  contractRoute(contract: DashboardPendingContract): string[] | null {
    if (contract.provider) return getContractDetailRouteByProvider(contract.provider, contract.contractId);
    return getContractDetailRoute(contract.companyId, contract.contractId);
  }

  openContract(contract: DashboardPendingContract): void {
    const route = this.contractRoute(contract);
    if (route) void this.router.navigate(route);
  }

  retry(): void { this.loadPendencies(); }

  private loadPendencies(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.service.getMyPendencies().pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => this.data.set(data),
      error: () => { this.data.set(null); this.errorMessage.set('Não foi possível carregar as pendências. Os teus Tickets continuam disponíveis abaixo.'); },
    });
  }

  private stateCount(target: string): number {
    const entries = Object.entries(this.data()?.totals.byState ?? {});
    const normalizedTarget = this.normalize(target);
    return entries.reduce((sum, [state, count]) => this.normalize(state) === normalizedTarget ? sum + Number(count || 0) : sum, 0);
  }

  private normalize(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(); }
  private timestamp(value: string | null): number { const time = value ? Date.parse(value) : NaN; return Number.isFinite(time) ? time : 0; }
}
