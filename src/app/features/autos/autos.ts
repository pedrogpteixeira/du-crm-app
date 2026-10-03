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
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ToastService } from '../../core/services/toast';

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
import { AutoItemsFilters } from './auto-items-filters/auto-items-filters';
import {
  AutoItemFilters,
  AutoSelectionFinancialSummary,
  LocalAutoSelection,
  buildAutoItemSelection,
  clearAutoSelection,
  createDefaultAutoSelection,
  createEmptyAutoItemFilters,
  filterAutoItems,
  getAutoItemId,
  getSelectedAutoItemCount,
  setAutoItemSelected,
  setAutoItemsSelected,
  summarizeSelectedLoadedItems,
} from './auto-items-selection';

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
    RouterLink,
    AutoItemsTable,
    AutoItemsFilters,
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
  private readonly toast = inject(ToastService);

  private _errorMessage = '';
  get errorMessage(): string {
    return this._errorMessage;
  }
  set errorMessage(message: string) {
    this._errorMessage = message ?? '';

    if (this._errorMessage) {
      this.toast.error(this._errorMessage);
    }
  }

  private _successMessage = '';
  get successMessage(): string {
    return this._successMessage;
  }
  set successMessage(message: string) {
    this._successMessage = message ?? '';

    if (this._successMessage) {
      this.toast.success(this._successMessage);
    }
  }

  modalErrorMessage = '';

  showFilters = false;
  showGenerateModal = false;

  preview: AutoPreview | null = null;
  previewPayload: GenerateAutoRequest | null = null;
  currentPreviewId: string | null = null;
  previewFilters: AutoItemFilters = createEmptyAutoItemFilters();
  filteredPreviewItems: AutoItem[] = [];
  previewSelection: LocalAutoSelection = createDefaultAutoSelection();
  previewSelectionSummary: AutoSelectionFinancialSummary = summarizeSelectedLoadedItems([], this.previewSelection);
  isLoadingAllPreview = false;
  showCreateConfirm = false;
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

  get previewAllItemsLoaded(): boolean {
    return Boolean(
      this.preview &&
      !this.preview.pagination.hasMore &&
      this.preview.items.length >= this.previewTotalCount,
    );
  }

  get previewSelectedCount(): number {
    return getSelectedAutoItemCount(
      this.previewSelection,
      this.previewTotalCount,
    );
  }

  get previewExcludedCount(): number {
    return Math.max(0, this.previewTotalCount - this.previewSelectedCount);
  }

  get previewFinancialSummaryReliable(): boolean {
    return Boolean(
      this.preview &&
      (this.previewSelectedCount === this.previewTotalCount ||
        this.previewAllItemsLoaded ||
        this.previewSelection.mode === 'include'),
    );
  }

  ngOnInit(): void {
    this.isSuperAdmin = this.auth.isSuperAdmin();
    this.observeAutosCache();
    this.observeAutosInvalidation();
    this.loadAutos(true);
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
    if (this.isPreviewing || this.isLoadingMore || this.isLoadingAllPreview || this.isCreating) {
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
    if (this.isPreviewing || this.isLoadingMore || this.isLoadingAllPreview || this.isCreating) {
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
      this.isLoadingAllPreview ||
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
          this.previewFilters = createEmptyAutoItemFilters();
          this.previewSelection = createDefaultAutoSelection();
          this.refreshPreviewDerivedState();
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
      this.isCreating ||
      this.isLoadingAllPreview
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
          this.refreshPreviewDerivedState();
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
    if (
      !this.isSuperAdmin ||
      this.isCreating ||
      this.isLoadingMore ||
      this.isLoadingAllPreview ||
      !this.previewPayload ||
      !this.preview ||
      !this.currentPreviewId ||
      this.previewSelectedCount === 0
    ) {
      return;
    }

    this.showCreateConfirm = true;
  }

  cancelCreateAuto(): void {
    if (!this.isCreating) {
      this.showCreateConfirm = false;
    }
  }

  confirmCreateAuto(): void {
    const previewId = this.currentPreviewId;

    if (
      !this.isSuperAdmin ||
      this.isCreating ||
      !this.previewPayload ||
      !this.preview ||
      !previewId ||
      this.previewSelectedCount === 0
    ) {
      return;
    }

    let selection;
    try {
      selection = buildAutoItemSelection(
        this.previewSelection,
        this.previewTotalCount,
        this.previewAllItemsLoaded
          ? this.preview.items.map((item) => getAutoItemId(item))
          : undefined,
      );
    } catch {
      this.modalErrorMessage = 'Selecione pelo menos uma linha.';
      this.showCreateConfirm = false;
      return;
    }

    this.isCreating = true;
    this.modalErrorMessage = '';

    this.autoService
      .createAuto({
        ...this.previewPayload,
        previewId,
        ...(selection ? { selection } : {}),
      })
      .pipe(
        finalize(() => {
          this.isCreating = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (created) => {
          this.showCreateConfirm = false;
          this.showGenerateModal = false;
          this.resetGeneratePreview();
          this.successMessage = 'Auto criado com sucesso.';
          this.cdr.markForCheck();
          void this.router.navigate(['/home/autos', created.id]);
        },
        error: (error) => {
          this.showCreateConfirm = false;
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

  applyPreviewItemFilters(filters: AutoItemFilters): void {
    this.previewFilters = filters;
    this.refreshPreviewDerivedState();
    this.cdr.markForCheck();
  }

  onPreviewItemSelectionChange(event: { itemId: string; selected: boolean }): void {
    this.previewSelection = setAutoItemSelected(
      this.previewSelection,
      event.itemId,
      event.selected,
    );
    this.refreshPreviewDerivedState();
    this.cdr.markForCheck();
  }

  onPreviewVisibleSelectionChange(selected: boolean): void {
    this.previewSelection = setAutoItemsSelected(
      this.previewSelection,
      this.filteredPreviewItems.map((item) => getAutoItemId(item)).filter(Boolean),
      selected,
    );
    this.refreshPreviewDerivedState();
    this.cdr.markForCheck();
  }

  includePreviewFiltered(): void {
    this.onPreviewVisibleSelectionChange(true);
  }

  excludePreviewFiltered(): void {
    this.onPreviewVisibleSelectionChange(false);
  }

  includeAllPreview(): void {
    this.previewSelection = createDefaultAutoSelection();
    this.refreshPreviewDerivedState();
    this.cdr.markForCheck();
  }

  clearPreviewSelection(): void {
    this.previewSelection = clearAutoSelection();
    this.refreshPreviewDerivedState();
    this.cdr.markForCheck();
  }

  loadAllPreviewItems(): void {
    if (
      !this.preview ||
      !this.currentPreviewId ||
      this.previewAllItemsLoaded ||
      this.isLoadingAllPreview ||
      this.isLoadingMore ||
      this.isCreating
    ) {
      return;
    }

    this.isLoadingAllPreview = true;
    this.modalErrorMessage = '';
    this.loadNextPreviewChunkForAll(this.currentPreviewId);
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
    this.previewFilters = createEmptyAutoItemFilters();
    this.filteredPreviewItems = [];
    this.previewSelection = createDefaultAutoSelection();
    this.previewSelectionSummary = summarizeSelectedLoadedItems([], this.previewSelection);
    this.isLoadingAllPreview = false;
    this.showCreateConfirm = false;
    this.modalErrorMessage = '';
  }

  private refreshPreviewDerivedState(): void {
    const items = this.preview?.items ?? [];
    this.filteredPreviewItems = filterAutoItems(items, this.previewFilters);
    this.previewSelectionSummary = summarizeSelectedLoadedItems(
      items,
      this.previewSelection,
    );
  }

  private loadNextPreviewChunkForAll(previewId: string): void {
    const preview = this.preview;

    if (
      !preview ||
      this.currentPreviewId !== previewId ||
      !preview.pagination.hasMore
    ) {
      this.isLoadingAllPreview = false;
      this.refreshPreviewDerivedState();
      this.cdr.markForCheck();
      return;
    }

    const nextOffset = preview.pagination.offset + preview.pagination.limit;
    const nextLimit = 200;

    this.autoService
      .getPreviewChunk(previewId, nextOffset, nextLimit)
      .subscribe({
        next: (chunk) => {
          if (this.currentPreviewId !== previewId || !this.preview) {
            this.isLoadingAllPreview = false;
            this.cdr.markForCheck();
            return;
          }

          this.preview = {
            ...this.preview,
            expiresAt: chunk.expiresAt ?? this.preview.expiresAt,
            items: this.appendUniquePreviewItems(this.preview.items, chunk.items),
            pagination: chunk.pagination,
            diagnostics: chunk.diagnostics ?? this.preview.diagnostics,
          };
          this.refreshPreviewDerivedState();
          this.cdr.markForCheck();
          this.loadNextPreviewChunkForAll(previewId);
        },
        error: (error) => {
          this.isLoadingAllPreview = false;
          if (this.isPreviewExpiredError(error)) {
            this.expireCurrentPreview();
          } else {
            this.modalErrorMessage = this.getOperationError(
              error,
              'Não foi possível carregar todos os contratos.',
            );
          }
          this.cdr.markForCheck();
        },
      });
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
      current.map((item) => getAutoItemId(item) || item.contractId),
    );

    for (const item of incoming) {
      const key = getAutoItemId(item) || item.contractId;
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

    const code = this.getBackendErrorCode(error);
    if (code === 'auto-selection-empty') {
      return 'Selecione pelo menos uma linha antes de continuar.';
    }
    if (code === 'auto-selection-invalid') {
      return 'A seleção contém linhas que já não pertencem a esta preview. Atualize a pré-visualização e tente novamente.';
    }

    const nestedMessage = this.getNestedErrorMessage(error);
    if (nestedMessage) {
      return nestedMessage;
    }

    return fallback;
  }

  private getBackendErrorCode(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return '';
    }

    const directCode = (error as { code?: unknown }).code;
    if (typeof directCode === 'string') {
      return directCode;
    }

    if ('error' in error) {
      const nested = (error as { error?: unknown }).error;
      if (nested && typeof nested === 'object') {
        const nestedCode = (nested as { code?: unknown }).code;
        if (typeof nestedCode === 'string') {
          return nestedCode;
        }

        const deep = (nested as { error?: unknown }).error;
        if (deep && typeof deep === 'object') {
          const deepCode = (deep as { code?: unknown }).code;
          if (typeof deepCode === 'string') {
            return deepCode;
          }
        }
      }
    }

    return '';
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
