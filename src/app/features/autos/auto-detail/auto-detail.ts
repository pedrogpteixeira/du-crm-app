import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Auth } from '../../../core/services/auth';
import {
  AutoDetail as AutoDetailModel,
  AutoDiagnosticEntry,
  AutoItem,
  AutoProvider,
  AutoService,
  AutoStatus,
  AutoType,
  getAutoProviderLabel,
} from '../../../core/services/auto';
import { AutoItemsTable } from '../auto-items-table/auto-items-table';

@Component({
  selector: 'app-auto-detail',
  imports: [CommonModule, RouterLink, AutoItemsTable],
  templateUrl: './auto-detail.html',
  styleUrl: './auto-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly autoService = inject(AutoService);
  private readonly auth = inject(Auth);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  private autoLoadRequestId = 0;
  private itemsRevision = 0;
  private loadingAutoId = '';

  readonly itemsPageSize = 50;

  auto: AutoDetailModel | null = null;
  autoId = '';

  isSuperAdmin = false;
  isLoadingAuto = false;
  isLoadingMore = false;
  isFinalizing = false;
  isDeleting = false;
  isExporting = false;

  errorMessage = '';
  loadMoreErrorMessage = '';
  successMessage = '';
  showFinalizeConfirm = false;
  showDeleteConfirm = false;

  ngOnInit(): void {
    this.isSuperAdmin = this.auth.isSuperAdmin();

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('autoId');

        if (!id) {
          this.errorMessage = 'Auto inválido.';
          this.isLoadingAuto = false;
          this.cdr.markForCheck();
          return;
        }

        if (this.autoId !== id) {
          this.auto = null;
          this.loadMoreErrorMessage = '';
        }

        this.autoId = id;
        this.loadAuto();
      });

    this.autoService.autosInvalidated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.autoId) {
          this.loadAuto(false);
        }
      });
  }

  loadAuto(showLoading = true): void {
    if (!this.autoId) {
      return;
    }

    if (this.isLoadingAuto && this.loadingAutoId === this.autoId) {
      return;
    }

    const requestedAutoId = this.autoId;
    const requestId = ++this.autoLoadRequestId;
    ++this.itemsRevision;

    this.loadingAutoId = requestedAutoId;
    this.isLoadingAuto = true;
    this.isLoadingMore = false;
    this.loadMoreErrorMessage = '';

    if (showLoading && !this.auto) {
      this.cdr.markForCheck();
    }

    this.errorMessage = '';

    this.autoService
      .getAuto(requestedAutoId, 0, this.itemsPageSize)
      .pipe(
        finalize(() => {
          if (requestId !== this.autoLoadRequestId) {
            return;
          }

          this.isLoadingAuto = false;
          this.loadingAutoId = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (auto) => {
          if (
            requestId !== this.autoLoadRequestId ||
            requestedAutoId !== this.autoId
          ) {
            return;
          }

          this.auto = auto;
          this.cdr.markForCheck();
        },
        error: (error) => {
          if (
            requestId !== this.autoLoadRequestId ||
            requestedAutoId !== this.autoId
          ) {
            return;
          }

          this.errorMessage = this.getOperationError(
            error,
            'Não foi possível carregar o Auto.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  loadMore(): void {
    if (
      !this.auto ||
      this.isLoadingAuto ||
      this.isLoadingMore ||
      !this.auto.pagination.hasMore
    ) {
      return;
    }

    const currentAuto = this.auto;
    const requestedAutoId = this.autoId;
    const revision = this.itemsRevision;
    const nextOffset =
      currentAuto.pagination.offset + currentAuto.pagination.limit;
    const nextLimit = currentAuto.pagination.limit || this.itemsPageSize;

    this.isLoadingMore = true;
    this.loadMoreErrorMessage = '';

    this.autoService
      .getAuto(requestedAutoId, nextOffset, nextLimit)
      .pipe(
        finalize(() => {
          if (
            revision !== this.itemsRevision ||
            requestedAutoId !== this.autoId
          ) {
            return;
          }

          this.isLoadingMore = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          if (
            revision !== this.itemsRevision ||
            requestedAutoId !== this.autoId ||
            !this.auto
          ) {
            return;
          }

          this.auto = {
            ...this.auto,
            items: this.appendUniqueItems(
              this.auto.items,
              response.items,
            ),
            pagination: response.pagination,
            diagnostics: response.diagnostics ?? this.auto.diagnostics,
          };
          this.cdr.markForCheck();
        },
        error: (error) => {
          if (
            revision !== this.itemsRevision ||
            requestedAutoId !== this.autoId
          ) {
            return;
          }

          this.loadMoreErrorMessage = this.getOperationError(
            error,
            'Não foi possível carregar mais contratos.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  requestFinalize(): void {
    if (!this.canFinalize) {
      return;
    }

    this.showFinalizeConfirm = true;
  }

  cancelFinalize(): void {
    if (!this.isFinalizing) {
      this.showFinalizeConfirm = false;
    }
  }

  confirmFinalize(): void {
    if (!this.canFinalize || this.isFinalizing || !this.auto) {
      return;
    }

    this.isFinalizing = true;
    this.errorMessage = '';

    this.autoService
      .finalizeAuto(this.auto.id)
      .pipe(
        finalize(() => {
          this.isFinalizing = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (updated) => {
          if (this.auto) {
            this.auto = {
              ...this.auto,
              ...updated,
              items: this.auto.items,
              pagination: this.auto.pagination,
              diagnostics: this.auto.diagnostics,
            };
          }

          this.showFinalizeConfirm = false;
          this.successMessage = 'Auto finalizado com sucesso.';
          this.cdr.markForCheck();

          // A finalização pode alterar metadata dos AutoItems. Recarrega apenas
          // a primeira chunk; as restantes continuam lazy.
          this.loadAuto(false);
        },
        error: (error) => {
          this.errorMessage = this.getOperationError(
            error,
            'Não foi possível finalizar o Auto.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  requestDelete(): void {
    if (!this.canDelete) {
      return;
    }

    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    if (!this.isDeleting) {
      this.showDeleteConfirm = false;
    }
  }

  confirmDelete(): void {
    if (!this.canDelete || this.isDeleting || !this.auto) {
      return;
    }

    this.isDeleting = true;
    this.errorMessage = '';

    this.autoService
      .deleteAuto(this.auto.id)
      .pipe(
        finalize(() => {
          this.isDeleting = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          void this.router.navigate(['/home/autos']);
        },
        error: (error) => {
          this.errorMessage = this.getOperationError(
            error,
            'Não foi possível eliminar o Auto.',
          );
          this.showDeleteConfirm = false;
          this.cdr.markForCheck();
        },
      });
  }

  exportAuto(): void {
    if (!this.auto || this.isExporting) {
      return;
    }

    this.isExporting = true;
    this.errorMessage = '';

    this.autoService
      .exportAuto(this.auto.id)
      .pipe(
        finalize(() => {
          this.isExporting = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          const filename =
            this.extractFilename(response.headers.get('Content-Disposition')) ??
            `auto-${this.auto?.provider ?? 'export'}-${this.auto?.id ?? 'auto'}.xlsx`;

          this.downloadBlob(response.body, filename);
        },
        error: (error) => {
          this.errorMessage = this.getOperationError(
            error,
            'Não foi possível exportar o Auto.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  get loadedItemsCount(): number {
    return this.auto?.items.length ?? 0;
  }

  get totalItemsCount(): number {
    return this.auto?.pagination.total ?? this.auto?.contractsCount ?? 0;
  }

  get hasMoreItems(): boolean {
    return Boolean(this.auto?.pagination.hasMore);
  }

  get canFinalize(): boolean {
    return Boolean(
      this.isSuperAdmin &&
      this.auto?.status === 'draft',
    );
  }

  get canDelete(): boolean {
    return this.canFinalize;
  }

  providerLabel(provider: AutoProvider): string {
    return getAutoProviderLabel(provider);
  }

  typeLabel(type: AutoType): string {
    return type === 'automatic' ? 'Automático' : 'Manual';
  }

  statusLabel(status: AutoStatus): string {
    return status === 'finalized' ? 'Finalizado' : 'Rascunho';
  }

  diagnosticLabel(entry: AutoDiagnosticEntry): string {
    if (typeof entry === 'string') {
      return entry;
    }

    return entry.message ?? entry.detail ?? entry.code ?? 'Diagnóstico sem descrição';
  }

  creatorLabel(): string {
    if (!this.auto) {
      return '—';
    }

    if (this.auto.createdByName) {
      return this.auto.createdByName;
    }

    if (typeof this.auto.createdBy === 'string') {
      return this.auto.createdBy;
    }

    return this.auto.createdBy?.name ?? '—';
  }

  formatInteger(value: number | null | undefined): string {
    return new Intl.NumberFormat('pt-PT', {
      maximumFractionDigits: 0,
    }).format(Number(value ?? 0));
  }

  formatCurrency(value: number | null | undefined): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(Number(value ?? 0));
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private appendUniqueItems(
    currentItems: readonly AutoItem[],
    nextItems: readonly AutoItem[],
  ): AutoItem[] {
    const seen = new Set(
      currentItems.map((item) => item.id ?? item.contractId),
    );
    const appended = [...currentItems];

    for (const item of nextItems) {
      const key = item.id ?? item.contractId;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      appended.push(item);
    }

    return appended;
  }

  private getOperationError(error: unknown, fallback: string): string {
    if (this.isHttpStatus(error, 403)) {
      return 'Não tem permissão para executar esta operação.';
    }

    if (
      error &&
      typeof error === 'object' &&
      'error' in error
    ) {
      const nested = (error as { error?: { message?: unknown } }).error;
      if (typeof nested?.message === 'string' && nested.message.trim()) {
        return nested.message;
      }
    }

    return fallback;
  }

  private isHttpStatus(error: unknown, status: number): boolean {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status?: unknown }).status === status,
    );
  }

  private extractFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) {
      return null;
    }

    const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utfMatch?.[1]) {
      return decodeURIComponent(utfMatch[1].replace(/["']/g, '').trim());
    }

    const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
    return match?.[1]?.trim() ?? null;
  }

  private downloadBlob(blob: Blob | null, filename: string): void {
    if (!blob) {
      this.errorMessage = 'O ficheiro exportado não foi recebido.';
      return;
    }

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }
}
