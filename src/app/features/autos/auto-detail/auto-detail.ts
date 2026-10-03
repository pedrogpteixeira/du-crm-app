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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ToastService } from '../../../core/services/toast';
import {
  DocumentPreviewService,
  getDocumentPreviewType,
} from '../../../core/services/document-preview';
import { FileAccessService } from '../../../core/services/file-access';
import { FileDropzone } from '../../../shared/components/file-dropzone/file-dropzone';

import { Auth } from '../../../core/services/auth';
import {
  AutoDetail as AutoDetailModel,
  AutoDiagnosticEntry,
  AUTO_ITEM_PAYMENT_METHODS,
  AutoItem,
  AutoItemPayment,
  AutoItemPaymentAttachment,
  AutoItemPaymentMethod,
  AutoProvider,
  AutoService,
  AutoStatus,
  AutoType,
  getAutoProviderLabel,
} from '../../../core/services/auto';
import {
  AutoItemPaymentActionEvent,
  AutoItemsTable,
} from '../auto-items-table/auto-items-table';
import { AutoItemsFilters } from '../auto-items-filters/auto-items-filters';
import {
  AutoItemFilters,
  AutoSelectionFinancialSummary,
  LocalAutoSelection,
  buildAutoItemSelection,
  clearAutoSelection,
  createDefaultAutoSelection,
  createEmptyAutoItemFilters,
  hasActiveAutoItemFilters,
  getSelectedAutoItemCount,
  setAutoItemSelected,
  setAutoItemsSelected,
  summarizeSelectedLoadedItems,
  toAutoItemFilterRequest,
} from '../auto-items-selection';

@Component({
  selector: 'app-auto-detail',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AutoItemsTable, AutoItemsFilters, FileDropzone],
  templateUrl: './auto-detail.html',
  styleUrl: './auto-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly autoService = inject(AutoService);
  private readonly auth = inject(Auth);
  private readonly documentPreview = inject(DocumentPreviewService);
  private readonly fileAccess = inject(FileAccessService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  private autoLoadRequestId = 0;
  private itemsRevision = 0;
  private loadingAutoId = '';
  private paymentsLoadRequestId = 0;

  readonly itemsPageSize = 50;
  readonly paymentMethodOptions = AUTO_ITEM_PAYMENT_METHODS;

  paymentsByAutoItemId = new Map<string, AutoItemPayment>();
  isLoadingPayments = false;
  paymentsUnavailable = false;

  showRegisterPaymentModal = false;
  showPaymentDetailModal = false;

  selectedPaymentItem: AutoItem | null = null;
  selectedPayment: AutoItemPayment | null = null;
  readonly paymentForm = new FormGroup({
    paymentMethod: new FormControl<AutoItemPaymentMethod | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    paymentMethodOther: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
  });
  selectedPaymentFiles: File[] = [];

  isRegisteringPayment = false;
  downloadingPaymentAttachment = '';
  previewingPaymentAttachment = '';

  auto: AutoDetailModel | null = null;
  autoId = '';
  draftFilters: AutoItemFilters = createEmptyAutoItemFilters();
  filteredDraftItems: AutoItem[] = [];
  draftSelection: LocalAutoSelection = createDefaultAutoSelection();
  draftSelectionSummary: AutoSelectionFinancialSummary = summarizeSelectedLoadedItems([], this.draftSelection);

  isSuperAdmin = false;
  isLoadingAuto = false;
  isLoadingMore = false;
  isLoadingAllItems = false;
  isFilteringItems = false;
  isFinalizing = false;
  isDeleting = false;
  isExporting = false;
  loadMoreErrorMessage = '';

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

  showFinalizeConfirm = false;
  showDeleteConfirm = false;

  get paymentMethodControl(): FormControl<AutoItemPaymentMethod | ''> {
    return this.paymentForm.controls.paymentMethod;
  }

  get paymentMethodOtherControl(): FormControl<string> {
    return this.paymentForm.controls.paymentMethodOther;
  }

  get isOtherPaymentMethod(): boolean {
    return this.paymentMethodControl.value === 'Outro';
  }

  ngOnInit(): void {
    this.isSuperAdmin = this.auth.isSuperAdmin();

    this.paymentMethodControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((paymentMethod) => {
        this.syncPaymentMethodOtherValidation(paymentMethod);
        this.cdr.markForCheck();
      });

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
          this.resetPaymentsState();
          this.resetDraftControls();
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
      .getAuto(
        requestedAutoId,
        0,
        this.itemsPageSize,
        this.auto?.status === 'draft'
          ? toAutoItemFilterRequest(this.draftFilters)
          : undefined,
      )
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

          if (auto.status === 'draft') {
            this.refreshDraftDerivedState();
          } else {
            this.filteredDraftItems = [...auto.items];
          }

          if (auto.status === 'finalized') {
            this.loadPayments(auto.id);
          } else {
            this.resetPaymentsState();
          }

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
      this.isLoadingAllItems ||
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
      .getAuto(
        requestedAutoId,
        nextOffset,
        nextLimit,
        currentAuto.status === 'draft'
          ? toAutoItemFilterRequest(this.draftFilters)
          : undefined,
      )
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
          if (this.auto.status === 'draft') {
            this.refreshDraftDerivedState();
          }
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

  loadPayments(autoId: string): void {
    const requestId = ++this.paymentsLoadRequestId;
    const requestedAutoId = autoId;

    this.isLoadingPayments = true;
    this.paymentsUnavailable = false;
    this.cdr.markForCheck();

    this.autoService
      .getAutoPayments(requestedAutoId)
      .pipe(
        finalize(() => {
          if (requestId !== this.paymentsLoadRequestId) {
            return;
          }

          this.isLoadingPayments = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (payments) => {
          if (
            requestId !== this.paymentsLoadRequestId ||
            requestedAutoId !== this.autoId
          ) {
            return;
          }

          this.paymentsByAutoItemId = new Map(
            payments.map((payment) => [payment.autoItemId, payment]),
          );
          this.paymentsUnavailable = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          if (
            requestId !== this.paymentsLoadRequestId ||
            requestedAutoId !== this.autoId
          ) {
            return;
          }

          this.paymentsUnavailable = true;
          this.errorMessage = this.getOperationError(
            error,
            'Não foi possível carregar os pagamentos deste Auto.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  openRegisterPayment(item: AutoItem): void {
    if (!this.canManagePaymentForItem(item)) {
      return;
    }

    const itemId = this.getAutoItemId(item);
    if (!itemId || this.paymentsByAutoItemId.has(itemId)) {
      return;
    }

    this.selectedPaymentItem = item;
    this.selectedPayment = null;
    this.resetPaymentForm();
    this.selectedPaymentFiles = [];
    this.showRegisterPaymentModal = true;
  }

  closeRegisterPayment(): void {
    if (this.isRegisteringPayment) {
      return;
    }

    this.showRegisterPaymentModal = false;
    this.selectedPaymentItem = null;
    this.resetPaymentForm();
    this.selectedPaymentFiles = [];
  }

  registerSelectedPayment(): void {
    const item = this.selectedPaymentItem;
    const itemId = item ? this.getAutoItemId(item) : '';

    if (
      !item ||
      !itemId ||
      !this.canManagePaymentForItem(item) ||
      this.isRegisteringPayment
    ) {
      return;
    }

    this.paymentForm.markAllAsTouched();

    if (this.paymentForm.invalid) {
      if (!this.paymentMethodControl.value) {
        this.errorMessage = 'Seleciona o método de pagamento.';
      } else if (
        this.paymentMethodOtherControl.hasError('required') ||
        this.paymentMethodOtherControl.hasError('pattern')
      ) {
        this.errorMessage = 'Especifica o método de pagamento.';
      } else {
        this.errorMessage = 'Revê os dados do pagamento antes de continuar.';
      }
      this.cdr.markForCheck();
      return;
    }

    if (!this.selectedPaymentFiles.length) {
      this.errorMessage = 'Adiciona pelo menos um comprovativo do pagamento.';
      this.cdr.markForCheck();
      return;
    }

    const paymentMethod = this.paymentMethodControl.value as AutoItemPaymentMethod;
    const paymentMethodOther =
      paymentMethod === 'Outro'
        ? this.paymentMethodOtherControl.value.trim()
        : undefined;

    if (paymentMethod === 'Outro') {
      this.paymentMethodOtherControl.setValue(paymentMethodOther ?? '', {
        emitEvent: false,
      });
    }

    this.isRegisteringPayment = true;
    this.paymentForm.disable({ emitEvent: false });

    this.autoService
      .createAutoItemPayment(
        itemId,
        paymentMethod,
        this.selectedPaymentFiles,
        paymentMethodOther,
      )
      .pipe(
        finalize(() => {
          this.isRegisteringPayment = false;
          this.paymentForm.enable({ emitEvent: false });
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (payment) => {
          this.upsertPayment(payment);
          this.showRegisterPaymentModal = false;
          this.selectedPaymentItem = null;
          this.resetPaymentForm();
          this.selectedPaymentFiles = [];
          this.successMessage = 'Pagamento registado com sucesso.';
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = this.getOperationError(
            error,
            'Não foi possível registar o pagamento.',
          );

          if (this.isPaymentEligibilityError(error)) {
            // O AutoItem pode ter sido bloqueado por um refund entretanto.
            // Recarrega Auto + payments para voltar à fonte de verdade do backend.
            this.showRegisterPaymentModal = false;
            this.selectedPaymentItem = null;
            this.resetPaymentForm();
            this.selectedPaymentFiles = [];
            this.loadAuto(false);
          } else {
            this.refreshPaymentForItem(itemId);
          }

          this.cdr.markForCheck();
        },
      });
  }

  openPaymentDetail(event: AutoItemPaymentActionEvent): void {
    this.selectedPaymentItem = event.item;
    this.selectedPayment = event.payment;
    this.showPaymentDetailModal = true;
  }

  closePaymentDetail(): void {
    this.showPaymentDetailModal = false;
    this.selectedPaymentItem = null;
    this.selectedPayment = null;
  }

  canPreviewPaymentAttachment(attachment: AutoItemPaymentAttachment): boolean {
    return this.documentPreview.canPreview(attachment);
  }

  previewPaymentAttachment(attachment: AutoItemPaymentAttachment): void {
    const payment = this.selectedPayment;
    if (!payment || this.previewingPaymentAttachment) {
      return;
    }

    const fileName = this.paymentAttachmentRequestName(attachment);
    if (!fileName) {
      this.errorMessage = 'Não foi possível identificar o comprovativo.';
      return;
    }

    this.previewingPaymentAttachment = fileName;

    this.documentPreview
      .preview(attachment, () =>
        this.autoService.downloadAutoItemPaymentAttachment(payment.autoItemId, fileName),
      )
      .pipe(
        finalize(() => {
          this.previewingPaymentAttachment = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        error: (error) => {
          this.errorMessage = this.getOperationError(
            error,
            'Não foi possível pré-visualizar o comprovativo.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  downloadPaymentAttachment(attachment: AutoItemPaymentAttachment): void {
    const payment = this.selectedPayment;
    if (!payment || this.downloadingPaymentAttachment) {
      return;
    }

    if (!this.fileAccess.canViewFile(attachment)) {
      this.errorMessage = 'Não tem permissão para visualizar este ficheiro.';
      return;
    }

    const requestFileName = this.paymentAttachmentRequestName(attachment);
    const downloadFileName = this.paymentAttachmentDisplayName(attachment);

    if (!requestFileName) {
      this.errorMessage = 'Não foi possível identificar o comprovativo.';
      return;
    }

    this.downloadingPaymentAttachment = requestFileName;

    this.autoService
      .downloadAutoItemPaymentAttachment(payment.autoItemId, requestFileName)
      .pipe(
        finalize(() => {
          this.downloadingPaymentAttachment = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (blob) => {
          if (!blob?.size) {
            this.errorMessage = 'O comprovativo não foi recebido.';
            return;
          }

          this.downloadBlob(blob, downloadFileName || requestFileName);
        },
        error: (error) => {
          this.errorMessage = this.getOperationError(
            error,
            'Não foi possível descarregar o comprovativo.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  paymentAttachmentDisplayName(attachment: AutoItemPaymentAttachment): string {
    return String(
      attachment.originalName ?? attachment.name ?? attachment.fileName ?? 'Comprovativo',
    ).trim() || 'Comprovativo';
  }

  paymentAttachmentRequestName(attachment: AutoItemPaymentAttachment): string {
    return String(
      attachment.fileName ?? attachment.name ?? attachment.originalName ?? '',
    ).trim();
  }

  paymentAttachmentIcon(attachment: AutoItemPaymentAttachment): string {
    const previewType = getDocumentPreviewType(attachment);

    if (previewType === 'pdf') {
      return 'picture_as_pdf';
    }

    if (previewType === 'image') {
      return 'image';
    }

    if (previewType === 'audio') {
      return 'audio_file';
    }

    return 'description';
  }

  isPaymentAttachmentBusy(attachment: AutoItemPaymentAttachment): boolean {
    const fileName = this.paymentAttachmentRequestName(attachment);
    return Boolean(
      fileName &&
        (this.downloadingPaymentAttachment === fileName ||
          this.previewingPaymentAttachment === fileName),
    );
  }

  get canManagePayments(): boolean {
    return Boolean(this.isSuperAdmin && this.auto?.status === 'finalized');
  }

  formatFileSize(size: number | null | undefined): string {
    if (size === null || size === undefined || Number.isNaN(Number(size))) {
      return '';
    }

    const bytes = Number(size);
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  applyDraftItemFilters(filters: AutoItemFilters): void {
    if (!this.auto || this.auto.status !== 'draft' || this.isFilteringItems) {
      return;
    }

    this.draftFilters = filters;
    this.reloadDraftView();
  }

  onDraftItemSelectionChange(event: { itemId: string; selected: boolean }): void {
    this.draftSelection = setAutoItemSelected(
      this.draftSelection,
      event.itemId,
      event.selected,
    );
    this.refreshDraftDerivedState();
    this.cdr.markForCheck();
  }

  onDraftVisibleSelectionChange(selected: boolean): void {
    this.draftSelection = setAutoItemsSelected(
      this.draftSelection,
      this.filteredDraftItems.map((item) => this.getAutoItemId(item)).filter(Boolean),
      selected,
    );
    this.refreshDraftDerivedState();
    this.cdr.markForCheck();
  }

  includeDraftFiltered(): void {
    this.onDraftVisibleSelectionChange(true);
  }

  excludeDraftFiltered(): void {
    this.onDraftVisibleSelectionChange(false);
  }

  includeAllDraft(): void {
    this.draftSelection = createDefaultAutoSelection();
    this.refreshDraftDerivedState();
    this.cdr.markForCheck();
  }

  clearDraftSelection(): void {
    this.draftSelection = clearAutoSelection();
    this.refreshDraftDerivedState();
    this.cdr.markForCheck();
  }

  loadAllDraftItems(): void {
    if (
      !this.auto ||
      this.auto.status !== 'draft' ||
      this.draftViewAllItemsLoaded ||
      this.isLoadingAllItems ||
      this.isLoadingMore ||
      this.isLoadingAuto ||
      this.isFinalizing ||
      this.isFilteringItems
    ) {
      return;
    }

    this.isLoadingAllItems = true;
    this.loadMoreErrorMessage = '';
    this.loadNextDraftChunkForAll(this.auto.id, this.itemsRevision);
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

    let selection;
    try {
      selection = buildAutoItemSelection(
        this.draftSelection,
        this.totalItemsCount,
        this.draftAllItemsLoaded
          ? this.auto.items.map((item) => this.getAutoItemId(item))
          : undefined,
      );
    } catch {
      this.errorMessage = 'Selecione pelo menos uma linha.';
      this.showFinalizeConfirm = false;
      return;
    }

    this.isFinalizing = true;
    this.errorMessage = '';

    this.autoService
      .finalizeAuto(
        this.auto.id,
        selection ? { selection } : {},
      )
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
    return this.auto?.contractsCount ?? 0;
  }

  get viewItemsCount(): number {
    return this.auto?.pagination.total ?? 0;
  }

  get hasMoreItems(): boolean {
    return Boolean(this.auto?.pagination.hasMore);
  }

  get draftViewAllItemsLoaded(): boolean {
    return Boolean(
      this.auto?.status === 'draft' &&
      !this.auto.pagination.hasMore &&
      this.auto.items.length >= this.viewItemsCount,
    );
  }

  get draftAllItemsLoaded(): boolean {
    return Boolean(
      this.auto?.status === 'draft' &&
      !hasActiveAutoItemFilters(this.draftFilters) &&
      this.draftViewAllItemsLoaded &&
      this.auto.items.length >= this.totalItemsCount,
    );
  }

  get draftSelectedCount(): number {
    return getSelectedAutoItemCount(this.draftSelection, this.totalItemsCount);
  }

  get draftExcludedCount(): number {
    return Math.max(0, this.totalItemsCount - this.draftSelectedCount);
  }

  get draftFinancialSummaryReliable(): boolean {
    return Boolean(
      this.auto?.status === 'draft' &&
      (this.draftSelectedCount === this.totalItemsCount ||
        this.draftAllItemsLoaded),
    );
  }

  get hasDraftViewFilters(): boolean {
    return hasActiveAutoItemFilters(this.draftFilters);
  }

  get canFinalize(): boolean {
    return Boolean(
      this.isSuperAdmin &&
      this.auto?.status === 'draft' &&
      this.draftSelectedCount > 0 &&
      !this.isFilteringItems,
    );
  }

  get canDelete(): boolean {
    return Boolean(
      this.isSuperAdmin &&
      this.auto?.status === 'draft',
    );
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

  paymentAmount(item: AutoItem): number {
    if (item.payableAmount !== undefined && item.payableAmount !== null) {
      const payableAmount = Number(item.payableAmount);
      return Number.isFinite(payableAmount) ? payableAmount : 0;
    }

    const commission = Number(item.commission);
    return Number.isFinite(commission) ? commission : 0;
  }

  private canManagePaymentForItem(item: AutoItem): boolean {
    const itemId = this.getAutoItemId(item);
    const paymentAllowed =
      item.paymentAllowed !== undefined
        ? item.paymentAllowed === true
        : item.paymentBlockReason == null &&
          item.paymentBlocked !== true &&
          Number(item.commission) > 0;
    const payableAmount =
      item.payableAmount !== undefined && item.payableAmount !== null
        ? Number(item.payableAmount)
        : Number(item.commission);

    return Boolean(
      this.canManagePayments &&
      paymentAllowed &&
      Number.isFinite(payableAmount) &&
      payableAmount > 0 &&
      itemId &&
      !this.paymentsByAutoItemId.has(itemId),
    );
  }

  private getAutoItemId(item: AutoItem): string {
    return item.domainId ?? item.id ?? '';
  }

  private upsertPayment(payment: AutoItemPayment): void {
    this.paymentsByAutoItemId = new Map(this.paymentsByAutoItemId);
    this.paymentsByAutoItemId.set(payment.autoItemId, payment);
  }

  private refreshPaymentForItem(autoItemId: string): void {
    this.autoService.getAutoItemPayment(autoItemId).subscribe({
      next: (payment) => {
        const nextPayments = new Map(this.paymentsByAutoItemId);

        if (payment) {
          nextPayments.set(autoItemId, payment);
          if (this.selectedPayment?.autoItemId === autoItemId) {
            this.selectedPayment = payment;
          }
        } else {
          nextPayments.delete(autoItemId);
        }

        this.paymentsByAutoItemId = nextPayments;
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  private reloadDraftView(): void {
    const autoId = this.auto?.id;
    if (!autoId || this.auto?.status !== 'draft') {
      return;
    }

    const revision = ++this.itemsRevision;
    this.isFilteringItems = true;
    this.isLoadingMore = false;
    this.isLoadingAllItems = false;
    this.loadMoreErrorMessage = '';

    this.autoService
      .getAuto(
        autoId,
        0,
        this.itemsPageSize,
        toAutoItemFilterRequest(this.draftFilters),
      )
      .pipe(
        finalize(() => {
          if (revision !== this.itemsRevision) {
            return;
          }
          this.isFilteringItems = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          if (!this.auto || this.auto.id !== autoId || revision !== this.itemsRevision) {
            return;
          }

          this.auto = {
            ...this.auto,
            ...response,
            items: response.items,
            pagination: response.pagination,
            diagnostics: response.diagnostics ?? this.auto.diagnostics,
          };
          this.refreshDraftDerivedState();
          this.cdr.markForCheck();
        },
        error: (error) => {
          if (revision !== this.itemsRevision) {
            return;
          }
          this.loadMoreErrorMessage = this.getOperationError(
            error,
            'Não foi possível aplicar os filtros ao Auto.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  private resetDraftControls(): void {
    this.draftFilters = createEmptyAutoItemFilters();
    this.filteredDraftItems = [];
    this.draftSelection = createDefaultAutoSelection();
    this.draftSelectionSummary = summarizeSelectedLoadedItems([], this.draftSelection);
    this.isLoadingAllItems = false;
    this.isFilteringItems = false;
    this.showFinalizeConfirm = false;
  }

  private refreshDraftDerivedState(): void {
    const items = this.auto?.items ?? [];
    this.filteredDraftItems = [...items];
    this.draftSelectionSummary = summarizeSelectedLoadedItems(
      items,
      this.draftSelection,
    );
  }

  private loadNextDraftChunkForAll(autoId: string, revision: number): void {
    const auto = this.auto;

    if (
      !auto ||
      auto.id !== autoId ||
      this.autoId !== autoId ||
      revision !== this.itemsRevision ||
      auto.status !== 'draft' ||
      !auto.pagination.hasMore
    ) {
      this.isLoadingAllItems = false;
      this.refreshDraftDerivedState();
      this.cdr.markForCheck();
      return;
    }

    const nextOffset = auto.pagination.offset + auto.pagination.limit;

    this.autoService
      .getAuto(
        autoId,
        nextOffset,
        200,
        toAutoItemFilterRequest(this.draftFilters),
      )
      .subscribe({
        next: (response) => {
          if (
            !this.auto ||
            this.autoId !== autoId ||
            revision !== this.itemsRevision
          ) {
            this.isLoadingAllItems = false;
            this.cdr.markForCheck();
            return;
          }

          this.auto = {
            ...this.auto,
            items: this.appendUniqueItems(this.auto.items, response.items),
            pagination: response.pagination,
            diagnostics: response.diagnostics ?? this.auto.diagnostics,
          };
          this.refreshDraftDerivedState();
          this.cdr.markForCheck();
          this.loadNextDraftChunkForAll(autoId, revision);
        },
        error: (error) => {
          this.isLoadingAllItems = false;
          this.loadMoreErrorMessage = this.getOperationError(
            error,
            'Não foi possível carregar todos os contratos.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  private resetPaymentsState(): void {
    ++this.paymentsLoadRequestId;
    this.paymentsByAutoItemId = new Map();
    this.isLoadingPayments = false;
    this.paymentsUnavailable = false;
    this.showRegisterPaymentModal = false;
    this.showPaymentDetailModal = false;
    this.selectedPaymentItem = null;
    this.selectedPayment = null;
    this.resetPaymentForm();
    this.selectedPaymentFiles = [];
  }

  private syncPaymentMethodOtherValidation(
    paymentMethod: AutoItemPaymentMethod | '',
  ): void {
    const control = this.paymentMethodOtherControl;

    if (paymentMethod === 'Outro') {
      control.setValidators([
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(100),
      ]);
    } else {
      control.setValidators([Validators.maxLength(100)]);
      if (control.value) {
        control.setValue('', { emitEvent: false });
      }
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private resetPaymentForm(): void {
    this.paymentForm.reset({
      paymentMethod: '',
      paymentMethodOther: '',
    });
    this.syncPaymentMethodOtherValidation('');
  }

  paymentMethodLabel(payment: AutoItemPayment): string {
    const customMethod = payment.paymentMethodOther?.trim();

    if (payment.paymentMethod === 'Outro' && customMethod) {
      return `Outro — ${customMethod}`;
    }

    return payment.paymentMethod || '—';
  }

  private appendUniqueItems(
    currentItems: readonly AutoItem[],
    nextItems: readonly AutoItem[],
  ): AutoItem[] {
    const seen = new Set(
      currentItems.map((item) => item.domainId ?? item.id ?? item.contractId),
    );
    const appended = [...currentItems];

    for (const item of nextItems) {
      const key = item.domainId ?? item.id ?? item.contractId;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      appended.push(item);
    }

    return appended;
  }

  private isPaymentEligibilityError(error: unknown): boolean {
    const code = this.getBackendErrorCode(error);
    return (
      code === 'auto-item-refund-pending' ||
      code === 'auto-item-refunded' ||
      code === 'auto-item-no-longer-payable'
    );
  }

  private getBackendErrorCode(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return '';
    }

    const directCode = (error as { code?: unknown }).code;
    if (typeof directCode === 'string') {
      return directCode;
    }

    const nested = (error as { error?: unknown }).error;
    if (nested && typeof nested === 'object') {
      const nestedCode = (nested as { code?: unknown }).code;
      if (typeof nestedCode === 'string') {
        return nestedCode;
      }

      const nestedError = (nested as { error?: unknown }).error;
      if (nestedError && typeof nestedError === 'object') {
        const deepCode = (nestedError as { code?: unknown }).code;
        if (typeof deepCode === 'string') {
          return deepCode;
        }
      }
    }

    return '';
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
      return 'A seleção contém linhas que já não pertencem a este Auto. Atualize os dados e tente novamente.';
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

    // Evita libertar a Blob URL antes de o browser iniciar efetivamente o download.
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }
}
