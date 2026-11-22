import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import {
  AtlasSnapshot,
  BackupAtlasStatus,
  BackupCostEstimate,
  BackupHealth,
  BackupHealthAlert,
  BackupOverview,
  BackupProtectionStatus,
  BackupRunDetail,
  BackupRunSummary,
  BackupStorage,
} from '../../../core/models/admin-backup.model';
import { AdminBackupService } from '../../../core/services/admin-backup';
import { ToastService } from '../../../core/services/toast';

type BackupSection = 'overview' | 'atlas' | 'storage' | 'history';
type StatusTone = 'success' | 'warning' | 'danger' | 'pending' | 'neutral' | 'info';

@Component({
  selector: 'app-backups',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './backups.html',
  styleUrl: './backups.scss',
})
export class Backups implements OnInit {
  private readonly backupService = inject(AdminBackupService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  overview: BackupOverview | null = null;
  health: BackupHealth | null = null;
  atlas: BackupAtlasStatus | null = null;
  storage: BackupStorage | null = null;
  cost: BackupCostEstimate | null = null;
  history: BackupRunSummary[] = [];

  selectedRun: BackupRunDetail | null = null;
  selectedRunId: string | null = null;
  detailLoading = false;
  detailError = '';

  readonly loading: Record<BackupSection, boolean> = {
    overview: false,
    atlas: false,
    storage: false,
    history: false,
  };

  readonly errors: Record<BackupSection, string> = {
    overview: '',
    atlas: '',
    storage: '',
    history: '',
  };

  private backdropPointerId: number | null = null;

  ngOnInit(): void {
    this.refreshAll(false);
  }

  get isRefreshing(): boolean {
    return Object.values(this.loading).some(Boolean);
  }

  get overallStatus(): BackupProtectionStatus {
    return this.health?.status ?? this.overview?.status ?? 'unknown';
  }

  get r2Status(): BackupProtectionStatus {
    return (
      this.health?.r2?.status ??
      this.overview?.r2?.status ??
      this.overview?.latest?.status ??
      'unknown'
    );
  }

  get atlasStatus(): BackupProtectionStatus {
    return (
      this.atlas?.status ??
      this.health?.atlas?.status ??
      this.overview?.atlas?.status ??
      this.overview?.mongoAtlas?.status ??
      'unknown'
    );
  }

  get latestRun(): BackupRunSummary | null {
    return this.overview?.latest ?? this.history[0] ?? null;
  }

  get alertItems(): Array<BackupHealthAlert | string> {
    return this.health?.alerts ?? [];
  }

  get latestR2Date(): string | null {
    const run = this.latestRun;
    return run?.completedAt ?? run?.createdAt ?? run?.startedAt ?? null;
  }

  get atlasLatestSnapshot(): AtlasSnapshot | null {
    return this.atlas?.latest ?? this.atlas?.snapshots?.[0] ?? null;
  }

  get hasStorageData(): boolean {
    return (
      this.storage != null &&
      (this.storage.totalBytes != null ||
        this.storage.totalObjects != null ||
        !!this.storage.classes?.length)
    );
  }

  get monthlyCost(): number | null {
    return this.cost?.monthlyUsd ?? this.cost?.estimatedMonthlyUsd ?? null;
  }

  get isCostComplete(): boolean {
    if (!this.cost) return false;
    if (this.cost.complete === true) return true;
    return this.cost.partial !== true && this.monthlyCost != null;
  }

  refreshAll(refresh = true): void {
    this.loadOverview(refresh);
    this.loadAtlas(refresh);
    this.loadStorageAndCost(refresh);
    this.loadHistory(refresh);
  }

  loadOverview(refresh: boolean): void {
    if (this.loading.overview) return;
    this.loading.overview = true;
    this.errors.overview = '';

    this.backupService
      .getOverview(refresh)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (overview) => {
          this.overview = overview;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errors.overview = this.apiError(error, 'Não foi possível carregar o estado geral.');
          this.loading.overview = false;
          this.cdr.detectChanges();
        },
      });

    this.backupService
      .getHealth(refresh)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading.overview = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (health) => {
          this.health = health;
        },
        error: (error) => {
          const message = this.apiError(
            error,
            'Não foi possível carregar a monitorização de saúde.',
          );
          this.errors.overview = this.errors.overview || message;
        },
      });
  }

  loadAtlas(refresh: boolean): void {
    if (this.loading.atlas) return;
    this.loading.atlas = true;
    this.errors.atlas = '';

    this.backupService
      .getAtlas(refresh)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading.atlas = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (atlas) => {
          this.atlas = atlas;
        },
        error: (error) => {
          this.errors.atlas = this.apiError(
            error,
            'Não foi possível carregar o estado do MongoDB Atlas.',
          );
        },
      });
  }

  loadStorageAndCost(refresh: boolean): void {
    if (this.loading.storage) return;
    this.loading.storage = true;
    this.errors.storage = '';
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending === 0) {
        this.loading.storage = false;
        this.cdr.detectChanges();
      }
    };

    this.backupService
      .getStorage(refresh)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (storage) => {
          this.storage = storage;
          done();
        },
        error: (error) => {
          this.errors.storage = this.apiError(
            error,
            'Não foi possível carregar a medição de armazenamento.',
          );
          done();
        },
      });

    this.backupService
      .getCostEstimate(refresh)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cost) => {
          this.cost = cost;
          done();
        },
        error: (error) => {
          const message = this.apiError(error, 'Não foi possível carregar a estimativa de custos.');
          this.errors.storage = this.errors.storage || message;
          done();
        },
      });
  }

  loadHistory(refresh: boolean): void {
    if (this.loading.history) return;
    this.loading.history = true;
    this.errors.history = '';

    this.backupService
      .getHistory(refresh)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading.history = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (history) => {
          this.history = history;
        },
        error: (error) => {
          this.errors.history = this.apiError(
            error,
            'Não foi possível carregar o histórico de backups.',
          );
        },
      });
  }

  openRun(run: BackupRunSummary): void {
    const runId = run.runId?.trim();
    if (!runId || this.detailLoading) return;

    this.selectedRunId = runId;
    this.selectedRun = null;
    this.detailError = '';
    this.detailLoading = true;

    this.backupService
      .getRunDetail(runId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.detailLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (detail) => {
          this.selectedRun = detail;
        },
        error: (error) => {
          this.detailError = this.apiError(
            error,
            'Não foi possível carregar os detalhes desta execução.',
          );
        },
      });
  }

  closeRunDetail(): void {
    if (this.detailLoading) return;
    this.selectedRun = null;
    this.selectedRunId = null;
    this.detailError = '';
  }

  onBackdropPointerDown(event: PointerEvent): void {
    if (event.target === event.currentTarget) {
      this.backdropPointerId = event.pointerId;
    }
  }

  onBackdropPointerUp(event: PointerEvent): void {
    const shouldClose =
      this.backdropPointerId === event.pointerId && event.target === event.currentTarget;
    this.backdropPointerId = null;
    if (shouldClose) this.closeRunDetail();
  }

  onModalPointer(event: PointerEvent): void {
    this.backdropPointerId = null;
    event.stopPropagation();
  }

  resetBackdropPointer(): void {
    this.backdropPointerId = null;
  }

  statusLabel(status: BackupProtectionStatus | null | undefined): string {
    const normalized = String(status ?? 'unknown')
      .trim()
      .toLowerCase();
    const labels: Record<string, string> = {
      protected: 'Protegido',
      healthy: 'Protegido',
      ok: 'Protegido',
      current: 'Atual',
      attention: 'Atenção necessária',
      warning: 'Atenção necessária',
      critical: 'Falha crítica',
      failed: 'Falhado',
      failure: 'Falhado',
      pending_upgrade: 'Configuração pendente',
      pending_configuration: 'Configuração pendente',
      pending: 'Configuração pendente',
      completed: 'Concluído',
      complete: 'Concluído',
      success: 'Concluído',
      partial: 'Parcial',
      running: 'Em execução',
      in_progress: 'Em execução',
      unknown: 'Desconhecido',
      not_integrated: 'Configuração pendente',
    };
    return labels[normalized] ?? String(status ?? 'Desconhecido');
  }

  statusTone(status: BackupProtectionStatus | null | undefined): StatusTone {
    const normalized = String(status ?? '').toLowerCase();
    if (
      ['protected', 'healthy', 'ok', 'current', 'completed', 'complete', 'success'].includes(
        normalized,
      )
    )
      return 'success';
    if (['attention', 'warning', 'partial'].includes(normalized)) return 'warning';
    if (['critical', 'failed', 'failure', 'error'].includes(normalized)) return 'danger';
    if (
      ['pending_upgrade', 'pending_configuration', 'pending', 'not_integrated'].includes(normalized)
    )
      return 'pending';
    if (['running', 'in_progress'].includes(normalized)) return 'info';
    return 'neutral';
  }

  alertMessage(alert: BackupHealthAlert | string): string {
    if (typeof alert === 'string') return alert;
    return alert.message?.trim() || alert.code?.trim() || 'Alerta de monitorização sem descrição.';
  }

  alertTone(alert: BackupHealthAlert | string): StatusTone {
    if (typeof alert === 'string') return 'warning';
    return this.statusTone(alert.severity ?? 'warning');
  }

  alertSource(alert: BackupHealthAlert | string): string | null {
    return typeof alert === 'string' ? null : alert.source?.trim() || null;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(date);
  }

  formatNumber(value: number | null | undefined): string {
    return value == null ? '—' : new Intl.NumberFormat('pt-PT').format(value);
  }

  formatBytes(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    if (value === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(
      Math.floor(Math.log(Math.abs(value)) / Math.log(1024)),
      units.length - 1,
    );
    const normalized = value / 1024 ** Math.max(index, 0);
    return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: index > 1 ? 2 : 1 }).format(normalized)} ${units[Math.max(index, 0)]}`;
  }

  formatDuration(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    if (value < 1000) return `${Math.max(0, Math.round(value))} ms`;
    const seconds = Math.round(value / 1000);
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes} min ${remaining}s`;
  }

  formatUsd(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  }

  describeObject(value: Record<string, unknown> | string): string {
    if (typeof value === 'string') return value;
    const message = value['message'];
    if (typeof message === 'string') return message;
    const code = value['code'];
    if (typeof code === 'string') return code;
    return 'Informação adicional disponível no registo desta execução.';
  }

  objectEntries(
    value: Record<string, unknown> | null | undefined,
  ): Array<{ key: string; value: string }> {
    if (!value) return [];
    return Object.entries(value)
      .filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item) || item === null)
      .map(([key, item]) => ({ key, value: item == null ? '—' : String(item) }));
  }

  trackRun(_index: number, run: BackupRunSummary): string {
    return run.runId ?? `${run.startedAt ?? ''}-${run.completedAt ?? ''}-${_index}`;
  }

  private apiError(error: any, fallback: string): string {
    const status = error?.status;
    if (status === 403) return 'Não tem permissões para consultar esta informação.';
    if (status === 401) return 'A sessão já não permite consultar esta informação.';
    return error?.error?.message || fallback;
  }
}
