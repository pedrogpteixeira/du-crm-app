import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Observable,
  catchError,
  concatMap,
  finalize,
  from,
  map,
  of,
  switchMap,
  tap,
  toArray,
} from 'rxjs';

import { ToastService } from '../../../core/services/toast';

import {
  Campaign,
  CampaignService,
  CreateCampaignRequest,
} from '../../../core/services/campaign';
import { FormsModule } from '@angular/forms';

import { Auth } from '../../../core/services/auth';
import { KnowledgeBaseService } from '../../../core/services/knowledge-base';
import { FileDropzone } from '../../../shared/components/file-dropzone/file-dropzone';

type CampaignCreationState =
  | 'idle'
  | 'creatingCampaign'
  | 'uploadingAttachments'
  | 'partialFailure'
  | 'completed';

interface CampaignAttachmentUploadResult {
  file: File;
  uploaded: boolean;
  message?: string;
}

interface CampaignCreationOutcome {
  campaign: Campaign;
  attachmentResults: CampaignAttachmentUploadResult[];
  missingArticleId: boolean;
}

@Component({
  selector: 'app-knowledge-campaigns',
  imports: [CommonModule, RouterLink, FormsModule, FileDropzone],
  templateUrl: './knowledge-campaigns.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './knowledge-campaigns.scss',
})
export class KnowledgeCampaigns implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly campaignService = inject(CampaignService);
  private readonly knowledgeBaseService = inject(KnowledgeBaseService);
  private readonly auth = inject(Auth);

  companyId = '';
  companyName = 'Empresa';
  supplierName = 'Empresa';

  campaigns: Campaign[] = [];

  showCreateCampaignModal = false;
  showEditCampaignModal = false;
  isCreatingCampaign = false;
  isEditingCampaign = false;
  isLoading = false;

  readonly maxCampaignAttachmentSizeBytes = 10 * 1024 * 1024;
  campaignCreationState: CampaignCreationState = 'idle';
  selectedCampaignAttachments: File[] = [];
  uploadedCampaignAttachments: File[] = [];
  pendingCampaignAttachments: File[] = [];
  createdCampaign: Campaign | null = null;
  campaignAttachmentValidationMessage = '';
  campaignAttachmentFailureDetails: string[] = [];
  attachmentUploadProgressCompleted = 0;
  attachmentUploadProgressTotal = 0;
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

  updatingCampaignId: string | null = null;
  deletingCampaignId: string | null = null;
  openActionsCampaignId: string | null = null;

  readonly canManageCampaigns =
    this.auth.roleIncludes(
      'Super Admin',
    );

  newCampaign = {
    name: '',
    active: true,
    loyalty: false,
    chargebackDays: null as number | null,
    startDate: '',
    endDate: '',
  };

  editingCampaign: Campaign | null = null;

  editCampaign = {
    active: true,
    loyalty: false,
    chargebackDays: null as number | null,
  };

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.companyId = params.get('companyId') || '';
      this.companyName = this.route.snapshot.queryParamMap.get('name') || 'Empresa';
      this.supplierName =
        this.route.snapshot.queryParamMap.get('supplier') || this.companyName;

      if (this.companyId) {
        this.loadCampaigns();
      }
    });
  }

  loadCampaigns(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.campaignService.getCampaignsByCompanyId(this.companyId).subscribe({
      next: (campaigns) => {
        this.campaigns = campaigns;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar as campanhas.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  toggleCampaign(campaign: Campaign): void {
    this.closeActionsMenu();

    if (!this.canManageCampaigns) {
      return;
    }

    const newActiveValue = !campaign.active;

    this.updatingCampaignId = campaign.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.campaignService
      .updateCampaign(campaign.id, {
        active: newActiveValue,
      })
      .subscribe({
        next: (updatedCampaign) => {
          this.replaceCampaign(updatedCampaign);

          this.successMessage = updatedCampaign.active
            ? 'Campanha ativada com sucesso.'
            : 'Campanha desativada com sucesso.';

          this.clearSuccessMessage();
        },
        error: (error) => {
          if (error?.status === 400) {
            this.errorMessage = 'A campanha já se encontra nesse estado.';
            return;
          }

          this.errorMessage = 'Não foi possível atualizar a campanha.';
        },
        complete: () => {
          this.updatingCampaignId = null;
        },
      });
  }


  toggleActionsMenu(campaignId: string, event: MouseEvent): void {
    event.stopPropagation();

    if (
      this.updatingCampaignId === campaignId ||
      this.deletingCampaignId === campaignId
    ) {
      return;
    }

    this.openActionsCampaignId =
      this.openActionsCampaignId === campaignId ? null : campaignId;
  }

  closeActionsMenu(): void {
    this.openActionsCampaignId = null;
  }

  @HostListener('document:click')
  closeActionsMenuOnDocumentClick(): void {
    this.closeActionsMenu();
  }

  openCreateCampaignModal(): void {
    if (!this.canManageCampaigns) {
      return;
    }

    this.resetCampaignCreationState();
    this.showCreateCampaignModal = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeCreateCampaignModal(): void {
    if (this.isCampaignCreationBusy) {
      return;
    }

    this.showCreateCampaignModal = false;
    this.resetCampaignCreationForm();
  }

  get isCampaignCreationBusy(): boolean {
    return (
      this.campaignCreationState === 'creatingCampaign' ||
      this.campaignCreationState === 'uploadingAttachments'
    );
  }

  get campaignCreationStatusMessage(): string {
    if (this.campaignCreationState === 'creatingCampaign') {
      return 'A criar campanha...';
    }

    if (this.campaignCreationState === 'uploadingAttachments') {
      const progress = this.attachmentUploadProgressTotal
        ? ` (${this.attachmentUploadProgressCompleted}/${this.attachmentUploadProgressTotal})`
        : '';

      return `A enviar anexos para a Base de Conhecimento...${progress}`;
    }

    if (this.campaignCreationState === 'partialFailure') {
      return 'A campanha foi criada, mas alguns anexos não foram enviados.';
    }

    return '';
  }

  onCampaignAttachmentFilesChange(files: File[]): void {
    if (this.isCampaignCreationBusy || this.createdCampaign) {
      return;
    }

    const acceptedFiles: File[] = [];
    const seenNames = new Set<string>();
    const duplicateNames: string[] = [];
    const oversizedNames: string[] = [];

    files.forEach((file) => {
      const normalizedName = this.normalizeAttachmentName(file.name);

      if (seenNames.has(normalizedName)) {
        duplicateNames.push(file.name);
        return;
      }

      seenNames.add(normalizedName);

      if (file.size > this.maxCampaignAttachmentSizeBytes) {
        oversizedNames.push(file.name);
        return;
      }

      acceptedFiles.push(file);
    });

    this.selectedCampaignAttachments = acceptedFiles;

    const messages: string[] = [];

    if (duplicateNames.length) {
      messages.push(
        `Foram removidos ficheiros com nomes repetidos: ${duplicateNames.join(', ')}.`,
      );
    }

    if (oversizedNames.length) {
      messages.push(
        `Foram removidos ficheiros com mais de 10 MB: ${oversizedNames.join(', ')}.`,
      );
    }

    this.campaignAttachmentValidationMessage = messages.join(' ');

    if (this.campaignAttachmentValidationMessage) {
      this.toast.warning(this.campaignAttachmentValidationMessage);
    }
  }

  createCampaign(): void {
    if (
      !this.canManageCampaigns ||
      this.isCampaignCreationBusy ||
      this.createdCampaign
    ) {
      return;
    }

    if (!this.newCampaign.name.trim()) {
      this.errorMessage = 'O nome da campanha é obrigatório.';
      return;
    }

    const chargebackError = this.getChargebackDaysError(
      this.newCampaign.chargebackDays,
    );

    if (chargebackError) {
      this.errorMessage = chargebackError;
      return;
    }

    const attachmentsToUpload = [...this.selectedCampaignAttachments];

    this.isCreatingCampaign = true;
    this.campaignCreationState = 'creatingCampaign';
    this.pendingCampaignAttachments = [...attachmentsToUpload];
    this.uploadedCampaignAttachments = [];
    this.campaignAttachmentFailureDetails = [];
    this.attachmentUploadProgressCompleted = 0;
    this.attachmentUploadProgressTotal = attachmentsToUpload.length;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = this.buildCreateCampaignPayload();

    this.campaignService
      .createCampaign(payload)
      .pipe(
        switchMap((campaign) => {
          this.createdCampaign = campaign;
          this.campaigns = [campaign, ...this.campaigns];

          if (!attachmentsToUpload.length) {
            return of<CampaignCreationOutcome>({
              campaign,
              attachmentResults: [],
              missingArticleId: false,
            });
          }

          if (!campaign.knowledgeBaseArticleId) {
            return of<CampaignCreationOutcome>({
              campaign,
              attachmentResults: [],
              missingArticleId: true,
            });
          }

          this.campaignCreationState = 'uploadingAttachments';

          return this.uploadCampaignAttachmentsSequentially(
            campaign.knowledgeBaseArticleId,
            attachmentsToUpload,
          ).pipe(
            map((attachmentResults) => ({
              campaign,
              attachmentResults,
              missingArticleId: false,
            })),
          );
        }),
        finalize(() => {
          this.isCreatingCampaign = false;
        }),
      )
      .subscribe({
        next: (outcome) => {
          this.handleCampaignCreationOutcome(outcome);
        },
        error: (error: HttpErrorResponse) => {
          this.campaignCreationState = 'idle';
          this.errorMessage =
            error.error?.message || 'Não foi possível criar a campanha.';
        },
      });
  }

  retryPendingCampaignAttachments(): void {
    const articleId = this.createdCampaign?.knowledgeBaseArticleId;

    if (
      !articleId ||
      !this.pendingCampaignAttachments.length ||
      this.isCampaignCreationBusy
    ) {
      return;
    }

    const attachmentsToRetry = [...this.pendingCampaignAttachments];

    this.isCreatingCampaign = true;
    this.campaignCreationState = 'uploadingAttachments';
    this.campaignAttachmentFailureDetails = [];
    this.attachmentUploadProgressCompleted = 0;
    this.attachmentUploadProgressTotal = attachmentsToRetry.length;

    this.uploadCampaignAttachmentsSequentially(articleId, attachmentsToRetry)
      .pipe(
        finalize(() => {
          this.isCreatingCampaign = false;
        }),
      )
      .subscribe({
        next: (attachmentResults) => {
          this.applyAttachmentUploadResults(attachmentResults);
        },
      });
  }

  formatCampaignAttachmentSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0 B';
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private buildCreateCampaignPayload(): CreateCampaignRequest {
    const payload: CreateCampaignRequest = {
      companyId: this.companyId,
      name: this.newCampaign.name.trim(),
      active: this.newCampaign.active,
      loyalty: this.newCampaign.loyalty,
      chargebackDays: this.normalizeChargebackDays(
        this.newCampaign.chargebackDays,
      ),
    };

    if (this.newCampaign.startDate) {
      payload.startDate = new Date(this.newCampaign.startDate).toISOString();
    }

    if (this.newCampaign.endDate) {
      payload.endDate = new Date(this.newCampaign.endDate).toISOString();
    }

    return payload;
  }

  private uploadCampaignAttachmentsSequentially(
    articleId: string,
    files: File[],
  ): Observable<CampaignAttachmentUploadResult[]> {
    return from(files).pipe(
      concatMap((file) =>
        this.uploadSingleCampaignAttachment(articleId, file).pipe(
          tap(() => {
            this.attachmentUploadProgressCompleted += 1;
          }),
        ),
      ),
      toArray(),
    );
  }

  private uploadSingleCampaignAttachment(
    articleId: string,
    file: File,
  ): Observable<CampaignAttachmentUploadResult> {
    return this.knowledgeBaseService
      .uploadArticleAttachments(articleId, [file])
      .pipe(
        map(() => ({ file, uploaded: true })),
        catchError((error: HttpErrorResponse) => {
          if (!this.shouldVerifyAttachmentUpload(error)) {
            return of({
              file,
              uploaded: false,
              message: this.getAttachmentUploadErrorMessage(file, error),
            });
          }

          return this.knowledgeBaseService.getArticle(articleId).pipe(
            map((article) => {
              const alreadyAttached = article.attachments.some(
                (attachment) =>
                  this.normalizeAttachmentName(attachment.originalName) ===
                    this.normalizeAttachmentName(file.name) &&
                  attachment.size === file.size,
              );

              if (alreadyAttached) {
                return { file, uploaded: true };
              }

              return {
                file,
                uploaded: false,
                message: this.getAttachmentUploadErrorMessage(file, error),
              };
            }),
            catchError(() =>
              of({
                file,
                uploaded: false,
                message: this.getAttachmentUploadErrorMessage(file, error),
              }),
            ),
          );
        }),
      );
  }

  private shouldVerifyAttachmentUpload(error: HttpErrorResponse): boolean {
    return [0, 408, 409, 504].includes(error.status);
  }

  private getAttachmentUploadErrorMessage(
    file: File,
    error: HttpErrorResponse,
  ): string {
    if (error.status === 409) {
      return `Não foi possível enviar "${file.name}" porque já existe um anexo com esse nome.`;
    }

    if (error.status === 413) {
      return `O ficheiro "${file.name}" excede o limite máximo de 10 MB.`;
    }

    const backendMessage =
      typeof error.error?.message === 'string' ? error.error.message.trim() : '';

    return backendMessage || `Não foi possível enviar o anexo "${file.name}".`;
  }

  private handleCampaignCreationOutcome(outcome: CampaignCreationOutcome): void {
    if (outcome.missingArticleId) {
      this.campaignCreationState = 'partialFailure';
      this.campaignAttachmentFailureDetails = [
        'A campanha foi criada, mas não foi devolvido o identificador do artigo da Base de Conhecimento.',
      ];
      this.toast.warning(
        'A campanha foi criada, mas não foi possível adicionar os anexos.',
      );
      return;
    }

    if (!this.selectedCampaignAttachments.length) {
      this.completeCampaignCreation('Campanha criada com sucesso.');
      return;
    }

    this.applyAttachmentUploadResults(outcome.attachmentResults);
  }

  private applyAttachmentUploadResults(
    results: CampaignAttachmentUploadResult[],
  ): void {
    const uploaded = results.filter((result) => result.uploaded).map((result) => result.file);
    const failed = results.filter((result) => !result.uploaded);

    this.uploadedCampaignAttachments = this.mergeFilesByName(
      this.uploadedCampaignAttachments,
      uploaded,
    );
    this.pendingCampaignAttachments = failed.map((result) => result.file);
    this.campaignAttachmentFailureDetails = failed.map(
      (result) => result.message || `Não foi possível enviar "${result.file.name}".`,
    );

    if (this.pendingCampaignAttachments.length) {
      this.campaignCreationState = 'partialFailure';
      this.toast.warning(
        'A campanha foi criada, mas alguns anexos não foram enviados.',
      );
      return;
    }

    this.completeCampaignCreation(
      'Campanha criada e anexos adicionados com sucesso.',
    );
  }

  private completeCampaignCreation(message: string): void {
    this.campaignCreationState = 'completed';
    this.successMessage = message;
    this.clearSuccessMessage();
    this.closeCreateCampaignModal();
  }

  private mergeFilesByName(current: File[], additions: File[]): File[] {
    const merged = [...current];
    const names = new Set(
      current.map((file) => this.normalizeAttachmentName(file.name)),
    );

    additions.forEach((file) => {
      const normalizedName = this.normalizeAttachmentName(file.name);

      if (!names.has(normalizedName)) {
        names.add(normalizedName);
        merged.push(file);
      }
    });

    return merged;
  }

  private normalizeAttachmentName(fileName: string): string {
    return fileName.trim().toLocaleLowerCase('pt-PT');
  }

  private resetCampaignCreationState(): void {
    this.campaignCreationState = 'idle';
    this.isCreatingCampaign = false;
    this.selectedCampaignAttachments = [];
    this.uploadedCampaignAttachments = [];
    this.pendingCampaignAttachments = [];
    this.createdCampaign = null;
    this.campaignAttachmentValidationMessage = '';
    this.campaignAttachmentFailureDetails = [];
    this.attachmentUploadProgressCompleted = 0;
    this.attachmentUploadProgressTotal = 0;
  }

  private resetCampaignCreationForm(): void {
    this.newCampaign = {
      name: '',
      active: true,
      loyalty: false,
      chargebackDays: null,
      startDate: '',
      endDate: '',
    };

    this.resetCampaignCreationState();
  }

  openEditCampaignModal(campaign: Campaign): void {
    this.closeActionsMenu();

    if (!this.canManageCampaigns) {
      return;
    }

    this.editingCampaign = campaign;
    this.editCampaign = {
      active: campaign.active,
      loyalty: campaign.loyalty,
      chargebackDays: campaign.chargebackDays ?? null,
    };

    this.showEditCampaignModal = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeEditCampaignModal(): void {
    if (this.isEditingCampaign) {
      return;
    }

    this.showEditCampaignModal = false;
    this.editingCampaign = null;
    this.editCampaign = {
      active: true,
      loyalty: false,
      chargebackDays: null,
    };
  }

  saveCampaignChanges(): void {
    if (!this.canManageCampaigns || !this.editingCampaign) {
      return;
    }

    const chargebackError = this.getChargebackDaysError(
      this.editCampaign.chargebackDays,
    );

    if (chargebackError) {
      this.errorMessage = chargebackError;
      return;
    }

    this.isEditingCampaign = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.campaignService
      .updateCampaign(this.editingCampaign.id, {
        active: this.editCampaign.active,
        loyalty: this.editCampaign.loyalty,
        chargebackDays: this.normalizeChargebackDays(
          this.editCampaign.chargebackDays,
        ),
      })
      .subscribe({
        next: (updatedCampaign) => {
          this.replaceCampaign(updatedCampaign);

          this.showEditCampaignModal = false;
          this.editingCampaign = null;
          this.successMessage = 'Campanha atualizada com sucesso.';
          this.clearSuccessMessage();
        },
        error: (error) => {
          this.errorMessage =
            error.error?.message || 'Não foi possível atualizar a campanha.';
        },
        complete: () => {
          this.isEditingCampaign = false;
        },
      });
  }

  openCampaignArticle(campaign: Campaign): void {
    if (!campaign.knowledgeBaseArticleId) {
      this.toast.info('O artigo desta campanha ainda não está disponível.');
      return;
    }

    void this.router.navigate(
      ['/home/knowledge-base/articles', campaign.knowledgeBaseArticleId],
      {
        queryParams: this.campaignArticleQueryParams(campaign),
      },
    );
  }

  openCampaignArticleFromKeyboard(
    campaign: Campaign,
    event: Event,
  ): void {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    this.openCampaignArticle(campaign);
  }

  private campaignArticleQueryParams(
    campaign: Campaign,
  ): Record<string, string> {
    return {
      name: campaign.name,
      supplier: this.supplierName,
      companyId: campaign.companyId || this.companyId,
    };
  }

  private replaceCampaign(updatedCampaign: Campaign): void {
    this.campaigns = this.campaigns.map((item) =>
      item.id === updatedCampaign.id
        ? {
            ...item,
            ...updatedCampaign,
            knowledgeBaseArticleId:
              updatedCampaign.knowledgeBaseArticleId ??
              item.knowledgeBaseArticleId,
          }
        : item,
    );
  }

  get newCampaignChargebackError(): string {
    return this.getChargebackDaysError(this.newCampaign.chargebackDays);
  }

  get editCampaignChargebackError(): string {
    return this.getChargebackDaysError(this.editCampaign.chargebackDays);
  }

  formatChargebackDays(chargebackDays?: number | null): string {
    return chargebackDays == null
      ? 'Não configurado'
      : `${chargebackDays} ${chargebackDays === 1 ? 'dia' : 'dias'}`;
  }

  formatDate(date?: string | null): string {
    if (!date) {
      return '—';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsedDate);
  }

  private getChargebackDaysError(
    rawValue: number | string | null | undefined,
  ): string {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return '';
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return 'Introduza um número inteiro de dias.';
    }

    if (value < 0) {
      return 'O número de dias não pode ser negativo.';
    }

    return '';
  }

  private normalizeChargebackDays(
    rawValue: number | string | null | undefined,
  ): number | null {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }

    return Number(rawValue);
  }

  private clearSuccessMessage(): void {
    setTimeout(() => {
      this.successMessage = '';
    }, 2500);
  }

  deleteCampaign(campaign: Campaign): void {
    this.closeActionsMenu();

    if (!this.canManageCampaigns) {
      return;
    }

    const confirmed = confirm(
      `Tens a certeza que pretendes eliminar a campanha "${campaign.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    this.deletingCampaignId = campaign.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.campaignService.deleteCampaign(campaign.id).subscribe({
      next: () => {
        this.campaigns = this.campaigns.filter((item) => item.id !== campaign.id);

        this.successMessage = 'Campanha eliminada com sucesso.';
        this.clearSuccessMessage();
      },
      error: () => {
        this.errorMessage = 'Não foi possível eliminar a campanha.';
      },
      complete: () => {
        this.deletingCampaignId = null;
      },
    });
  }
}
