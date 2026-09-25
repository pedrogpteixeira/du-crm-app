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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { Auth } from '../../core/services/auth';
import {
  AUTO_PROVIDER_OPTIONS,
  Auto,
  AutoDiagnosticEntry,
  AutoItem,
  AutoPreview,
  AutoProvider,
  AutoService,
  AutoStatus,
  AutoType,
  GenerateAutoRequest,
  getAutoProviderLabel,
} from '../../core/services/auto';
import { AutoItemsTable } from './auto-items-table/auto-items-table';

interface AutoFilters {
  provider: '' | AutoProvider;
  status: '' | AutoStatus;
  type: '' | AutoType;
  periodStart: string;
  periodEnd: string;
}

interface GenerateAutoForm {
  provider: AutoProvider;
  periodStart: string;
  periodEnd: string;
}

interface ProviderOption {
  id: AutoProvider;
  label: string;
}

interface AutoDatePreset {
  id: 'last7Days' | 'last30Days';
  label: string;
  days: number;
}

@Component({
  selector: 'app-autos',
  imports: [
    CommonModule,
    FormsModule,
    AutoItemsTable,
  ],
  templateUrl: './autos.html',
  styleUrl: './autos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Autos implements OnInit {
  private readonly autoService = inject(AutoService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly providerOptions: readonly ProviderOption[] = AUTO_PROVIDER_OPTIONS;

  readonly datePresets: readonly AutoDatePreset[] = [
    { id: 'last7Days', label: 'Últimos 7 dias', days: 7 },
    { id: 'last30Days', label: 'Últimos 30 dias', days: 30 },
  ];

  readonly pageSize = 20;
  readonly previewPageSize = 50;

  autos: Auto[] = [];
  filteredAutos: Auto[] = [];
  currentPage = 1;

  isSuperAdmin = false;
  isLoading = false;
  isPreviewing = false;
  isLoadingMore = false;
  isCreating = false;
  isDeleting = false;
  exportingAutoId: string | null = null;

  errorMessage = '';
  successMessage = '';
  modalErrorMessage = '';

  showFilters = false;
  showGenerateModal = false;

  preview: AutoPreview | null = null;
  previewPayload: GenerateAutoRequest | null = null;
  currentPreviewId: string | null = null;
  autoPendingDeletion: Auto | null = null;

  filters: AutoFilters = this.createEmptyFilters();

  generateForm: GenerateAutoForm = {
    provider: 'repsol',
    periodStart: '',
    periodEnd: '',
  };

  get totalPages(): number {
    return Math.max(
      1,
      Math.ceil(this.filteredAutos.length / this.pageSize),
    );
  }

  get visibleAutos(): Auto[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredAutos.slice(start, start + this.pageSize);
  }

  get visibleStart(): number {
    return this.filteredAutos.length
      ? (this.currentPage - 1) * this.pageSize + 1
      : 0;
  }

  get visibleEnd(): number {
    return Math.min(
      this.currentPage * this.pageSize,
      this.filteredAutos.length,
    );
  }

  get hasCurrentPreview(): boolean {
    return Boolean(
      this.preview &&
      this.previewPayload &&
      this.currentPreviewId,
    );
  }

  get canLoadMorePreview(): boolean {
    return Boolean(
      this.preview?.pagination.hasMore &&
      this.currentPreviewId,
    );
  }

  get previewLoadedCount(): number {
    return this.preview?.items.length ?? 0;
  }

  get previewTotalCount(): number {
    return this.preview?.pagination.total ?? this.preview?.contractsCount ?? 0;
  }

  ngOnInit(): void {
    this.isSuperAdmin = this.auth.isSuperAdmin();
    this.observeAutosCache();
    this.observeAutosInvalidation();
    this.loadAutos();
  }

  loadAutos(forceRefresh = false): void {
    const request$ = forceRefresh
      ? this.autoService.refreshAutos()
      : this.autoService.ensureAutosLoaded();

    request$.subscribe({
      error: () => undefined,
    });
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  clearFilters(): void {
    this.filters = this.createEmptyFilters();
    this.applyFilters();
    this.showFilters = false;
  }

  hasActiveFilters(): boolean {
    return Boolean(
      this.filters.provider ||
      this.filters.status ||
      this.filters.type ||
      this.filters.periodStart ||
      this.filters.periodEnd,
    );
  }

  applyFilters(): void {
    const start = this.parseDateBoundary(this.filters.periodStart);
    const end = this.parseDateBoundary(this.filters.periodEnd);

    this.filteredAutos = this.autos.filter((auto) => {
      const matchesProvider =
        !this.filters.provider || auto.provider === this.filters.provider;

      const matchesStatus =
        !this.filters.status || auto.status === this.filters.status;

      const matchesType =
        !this.filters.type || auto.type === this.filters.type;

      const autoStart = new Date(auto.periodStart).getTime();
      const autoEnd = new Date(auto.periodEnd).getTime();

      const matchesStart =
        start === null ||
        Number.isNaN(autoStart) ||
        autoStart >= start;

      const matchesEnd =
        end === null ||
        Number.isNaN(autoEnd) ||
        autoEnd <= end;

      return (
        matchesProvider &&
        matchesStatus &&
        matchesType &&
        matchesStart &&
        matchesEnd
      );
    });

    this.currentPage = 1;
  }

  openGenerateModal(): void {
    if (!this.isSuperAdmin) {
      return;
    }

    this.generateForm = {
      provider: 'repsol',
      periodStart: '',
      periodEnd: '',
    };
    this.resetGeneratePreview();
    this.showGenerateModal = true;
  }

  applyDatePreset(days: number): void {
    if (this.isPreviewing || this.isLoadingMore || this.isCreating) {
      return;
    }

    const endInclusive = this.startOfLocalDay(new Date());
    const startInclusive = new Date(endInclusive);
    startInclusive.setDate(startInclusive.getDate() - (days - 1));

    this.generateForm.periodStart = this.toDateInputValue(startInclusive);
    this.generateForm.periodEnd = this.toDateInputValue(endInclusive);
    this.resetGeneratePreview();
  }

  isDatePresetActive(days: number): boolean {
    const endInclusive = this.startOfLocalDay(new Date());
    const startInclusive = new Date(endInclusive);
    startInclusive.setDate(startInclusive.getDate() - (days - 1));

    return (
      this.generateForm.periodStart === this.toDateInputValue(startInclusive) &&
      this.generateForm.periodEnd === this.toDateInputValue(endInclusive)
    );
  }

  onGenerateFormChanged(): void {
    this.resetGeneratePreview();
  }

  closeGenerateModal(): void {
    if (this.isPreviewing || this.isLoadingMore || this.isCreating) {
      return;
    }

    this.showGenerateModal = false;
    this.resetGeneratePreview();
  }

  previewAuto(): void {
    if (
      !this.isSuperAdmin ||
      this.isPreviewing ||
      this.isLoadingMore ||
      this.isCreating ||
      this.hasCurrentPreview
    ) {
      return;
    }

    const payload = this.buildGeneratePayload();
    if (!payload) {
      return;
    }

    this.isPreviewing = true;
    this.modalErrorMessage = '';

    this.autoService
      .previewAuto(payload, 0, this.previewPageSize)
      .pipe(
        finalize(() => {
          this.isPreviewing = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (preview) => {
          if (!preview.previewId) {
            this.resetGeneratePreview();
            this.modalErrorMessage =
              'A API não devolveu um identificador de pré-visualização válido.';
            this.cdr.markForCheck();
            return;
          }

          this.preview = preview;
          this.previewPayload = payload;
          this.currentPreviewId = preview.previewId;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.resetGeneratePreview();
          this.modalErrorMessage = this.getOperationError(
            error,
            'Não foi possível pré-visualizar o Auto.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  loadMorePreview(): void {
    const preview = this.preview;
    const previewId = this.currentPreviewId;

    if (
      !preview ||
      !previewId ||
      !preview.pagination.hasMore ||
      this.isPreviewing ||
      this.isLoadingMore ||
      this.isCreating
    ) {
      return;
    }

    const nextOffset =
      preview.pagination.offset + preview.pagination.limit;
    const nextLimit = preview.pagination.limit || this.previewPageSize;

    this.isLoadingMore = true;
    this.modalErrorMessage = '';

    this.autoService
      .getPreviewChunk(previewId, nextOffset, nextLimit)
      .pipe(
        finalize(() => {
          this.isLoadingMore = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (chunk) => {
          if (this.currentPreviewId !== previewId || !this.preview) {
            return;
          }

          this.preview = {
            ...this.preview,
            expiresAt: chunk.expiresAt ?? this.preview.expiresAt,
            items: this.appendUniquePreviewItems(
              this.preview.items,
              chunk.items,
            ),
            pagination: chunk.pagination,
            diagnostics: chunk.diagnostics ?? this.preview.diagnostics,
          };
          this.cdr.markForCheck();
        },
        error: (error) => {
          if (this.isPreviewExpiredError(error)) {
            this.expireCurrentPreview();
          } else {
            this.modalErrorMessage = this.getOperationError(
              error,
              'Não foi possível carregar mais contratos. Tenta novamente.',
            );
          }

          this.cdr.markForCheck();
        },
      });
  }

  createAuto(): void {
    const previewId = this.currentPreviewId;

    if (
      !this.isSuperAdmin ||
      this.isCreating ||
      this.isLoadingMore ||
      !this.previewPayload ||
      !this.preview ||
      !previewId
    ) {
      return;
    }

    this.isCreating = true;
    this.modalErrorMessage = '';

    this.autoService
      .createAuto({
        ...this.previewPayload,
        previewId,
      })
      .pipe(
        finalize(() => {
          this.isCreating = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.showGenerateModal = false;
          this.resetGeneratePreview();
          this.successMessage = 'Auto criado com sucesso.';
          this.cdr.markForCheck();
        },
        error: (error) => {
          if (this.isPreviewExpiredError(error)) {
            this.expireCurrentPreview();
          } else {
            this.modalErrorMessage = this.getOperationError(
              error,
              'Não foi possível criar o Auto.',
            );
          }
          this.cdr.markForCheck();
        },
      });
  }

  openAuto(auto: Auto): void {
    void this.router.navigate(['/home/autos', auto.id]);
  }

  requestDelete(auto: Auto): void {
    if (!this.isSuperAdmin || auto.status !== 'draft') {
      return;
    }

    this.autoPendingDeletion = auto;
  }

  cancelDelete(): void {
    if (this.isDeleting) {
      return;
    }

    this.autoPendingDeletion = null;
  }

  confirmDelete(): void {
    const auto = this.autoPendingDeletion;

    if (!auto || !this.isSuperAdmin || this.isDeleting) {
      return;
    }

    this.isDeleting = true;
    this.errorMessage = '';

    this.autoService
      .deleteAuto(auto.id)
      .pipe(
        finalize(() => {
          this.isDeleting = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.autoPendingDeletion = null;
          this.successMessage = 'Auto eliminado com sucesso.';
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = this.getOperationError(
            error,
            'Não foi possível eliminar o Auto.',
          );
          this.autoPendingDeletion = null;
          this.cdr.markForCheck();
        },
      });
  }

  exportAuto(auto: Auto): void {
    if (this.exportingAutoId) {
      return;
    }

    this.exportingAutoId = auto.id;
    this.errorMessage = '';

    this.autoService
      .exportAuto(auto.id)
      .pipe(
        finalize(() => {
          this.exportingAutoId = null;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          const fallback = `auto-${auto.provider}-${auto.id}.xlsx`;
          this.downloadBlob(
            response.body,
            this.extractFilename(response.headers.get('Content-Disposition')) ?? fallback,
          );
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

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
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

  creatorLabel(auto: Auto): string {
    if (auto.createdByName) {
      return auto.createdByName;
    }

    if (typeof auto.createdBy === 'string') {
      return auto.createdBy;
    }

    return auto.createdBy?.name ?? '—';
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

  trackAutoById(_index: number, auto: Auto): string {
    return auto.id;
  }

  private observeAutosCache(): void {
    this.autoService.autosState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.autos = state.autos;
        this.isLoading = state.loading && !state.autos.length;
        this.errorMessage = state.error ?? '';
        this.applyFilters();
        this.cdr.markForCheck();
      });
  }

  private observeAutosInvalidation(): void {
    this.autoService.autosInvalidated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.autoService.refreshAutos().subscribe({
          error: () => undefined,
        });
      });
  }

  private resetGeneratePreview(): void {
    this.preview = null;
    this.previewPayload = null;
    this.currentPreviewId = null;
    this.modalErrorMessage = '';
  }

  private expireCurrentPreview(): void {
    this.resetGeneratePreview();
    this.modalErrorMessage =
      'A pré-visualização expirou. Gere uma nova para continuar.';
  }

  private appendUniquePreviewItems(
    current: readonly AutoItem[],
    incoming: readonly AutoItem[],
  ): AutoItem[] {
    const items = [...current];
    const keys = new Set(
      current.map((item) => item.id ?? item.contractId),
    );

    for (const item of incoming) {
      const key = item.id ?? item.contractId;
      if (keys.has(key)) {
        continue;
      }

      keys.add(key);
      items.push(item);
    }

    return items;
  }

  private isPreviewExpiredError(error: unknown): boolean {
    if (this.isHttpStatus(error, 404) || this.isHttpStatus(error, 410)) {
      return true;
    }

    const message = this.getNestedErrorMessage(error)?.toLowerCase() ?? '';
    return (
      message.includes('preview') &&
      (
        message.includes('expir') ||
        message.includes('not found') ||
        message.includes('não existe') ||
        message.includes('nao existe')
      )
    );
  }

  private startOfLocalDay(date: Date): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private buildGeneratePayload(): GenerateAutoRequest | null {
    this.modalErrorMessage = '';

    if (!this.generateForm.periodStart || !this.generateForm.periodEnd) {
      this.modalErrorMessage = 'Seleciona a data inicial e a data final.';
      return null;
    }

    const start = this.toUtcMidnightIso(this.generateForm.periodStart);
    const end = this.toUtcExclusiveEndIso(this.generateForm.periodEnd);

    if (!start || !end) {
      this.modalErrorMessage = 'As datas selecionadas não são válidas.';
      return null;
    }

    if (new Date(end).getTime() <= new Date(start).getTime()) {
      this.modalErrorMessage = 'A data final deve ser igual ou posterior à data inicial.';
      return null;
    }

    return {
      provider: this.generateForm.provider,
      periodStart: start,
      periodEnd: end,
    };
  }

  private toUtcMidnightIso(value: string): string | null {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private toUtcExclusiveEndIso(value: string): string | null {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
  }

  private parseDateBoundary(value: string): number | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  private createEmptyFilters(): AutoFilters {
    return {
      provider: '',
      status: '',
      type: '',
      periodStart: '',
      periodEnd: '',
    };
  }

  private getOperationError(error: unknown, fallback: string): string {
    if (this.isHttpStatus(error, 403)) {
      return 'Não tem permissão para executar esta operação.';
    }

    const nestedMessage = this.getNestedErrorMessage(error);
    if (nestedMessage) {
      return nestedMessage;
    }

    return fallback;
  }

  private getNestedErrorMessage(error: unknown): string | null {
    if (!error || typeof error !== 'object' || !('error' in error)) {
      return null;
    }

    const nested = (error as { error?: { message?: unknown } }).error;
    return typeof nested?.message === 'string' && nested.message.trim()
      ? nested.message.trim()
      : null;
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
