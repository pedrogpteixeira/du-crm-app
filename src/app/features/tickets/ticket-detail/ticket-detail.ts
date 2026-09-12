import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, map, Observable, of, switchMap } from 'rxjs';

import {
  getContractCompanyName,
  getContractDetailRoute,
} from '../../../core/config/contract-detail-route';
import { Auth } from '../../../core/services/auth';
import { FileAccessService } from '../../../core/services/file-access';
import { SocketService, TicketSocketEvent } from '../../../core/services/socket';
import {
  hasRequiredDocuments,
  isDocumentConfirmationApiError,
  prepareTicketUpdatePayload,
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
  TREATMENT_TICKET_TYPE,
  TicketApiModel,
  TicketDetail as TicketDetailModel,
  TicketDocument,
  TicketEstado,
  TicketPrioridade,
  TicketService,
  UpdateTicketRequest,
} from '../../../core/services/ticket';
import { appendObservationHistory } from '../../../core/utils/observation-history';
import { FileDropzone } from '../../../shared/components/file-dropzone/file-dropzone';
import { ObservationsThread } from '../../../shared/components/observations-thread/observations-thread';
import { VisibleAttachmentsPipe } from '../../../shared/pipes/visible-attachments.pipe';

interface AuthenticatedUserLike {
  id?: string;
  _id?: string;
  role?: string;
  name?: string;
  username?: string;
}

interface TicketEditSnapshot {
  estado: TicketEstado;
  prioridade: TicketPrioridade;
  agendamento: string | null;
  descricao: string;
}

interface SaveTicketResult {
  ticket: TicketDetailModel;
  uploadFailed: boolean;
  uploadError: unknown;
}

@Component({
  selector: 'app-ticket-detail',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    FileDropzone,
    VisibleAttachmentsPipe,
    ObservationsThread,
  ],
  templateUrl: './ticket-detail.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './ticket-detail.scss',
})
export class TicketDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(Auth);
  private readonly fileAccess = inject(FileAccessService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly socketService = inject(SocketService);
  private readonly ticketService = inject(TicketService);

  private currentUserId = '';
  private suppressNextOwnSocketUpdate = false;
  private ownSocketSuppressionTimer: ReturnType<typeof setTimeout> | null = null;
  private originalEditSnapshot: TicketEditSnapshot | null = null;

  ticket: TicketDetailModel | null = null;
  ticketId = '';

  selectedFiles: File[] = [];
  deletingAttachmentFileNames = new Set<string>();

  isLoading = false;
  isSaving = false;
  isEditing = false;
  isUploadingAttachments = false;
  isSuperAdmin = false;
  canEditTicket = false;

  loadError = '';
  errorMessage = '';
  successMessage = '';
  socketMessage = '';
  lastSocketUpdate = '';
  observationDraft = '';
  isSubmittingObservation = false;

  readonly ticketStatusOptions = TICKET_STATUS_OPTIONS;
  readonly ticketPriorityOptions = TICKET_PRIORITY_OPTIONS;

  readonly ticketForm = this.fb.group({
    estado: this.fb.nonNullable.control<TicketEstado>('Novo', Validators.required),
    prioridade: this.fb.nonNullable.control<TicketPrioridade>('Normal', Validators.required),
    agendamento: this.fb.nonNullable.control<string>(''),
    descricao: this.fb.nonNullable.control<string>(''),
  });

  ngOnInit(): void {
    this.resolveAuthenticatedUser();

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.ticketId = params.get('id') ?? '';

      if (!this.ticketId) {
        this.loadError = 'Não foi possível identificar o Ticket.';
        return;
      }

      this.loadTicket(this.ticketId);
    });

    this.socketService
      .listenTicketUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleTicketUpdated(event));
  }

  get currentUserName(): string {
    const currentUser = this.auth.getCurrentUser() as AuthenticatedUserLike | null;
    return (currentUser?.name ?? currentUser?.username ?? 'Utilizador').trim();
  }

  get contractRoute(): string[] | null {
    if (!this.ticket) {
      return null;
    }

    return getContractDetailRoute(this.ticket.companyId, this.ticket.contractId);
  }

  get companyName(): string {
    return this.ticket ? getContractCompanyName(this.ticket.companyId) : '—';
  }

  get isTreatmentEditType(): boolean {
    return this.ticket?.tipo === TREATMENT_TICKET_TYPE;
  }

  loadTicket(ticketId: string): void {
    this.isLoading = true;
    this.loadError = '';
    this.errorMessage = '';

    this.ticketService
      .getTicketById(ticketId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (ticket) => {
          this.ticket = ticket;

          if (!this.isEditing) {
            this.initializeEditForm(ticket);
          }

          this.updateCanEditTicket();
        },
        error: (error: HttpErrorResponse) => {
          this.ticket = null;
          this.loadError =
            error.status === 404
              ? 'O Ticket indicado não existe.'
              : error.status === 403
                ? 'Não tem permissão para aceder a este Ticket.'
                : error.error?.message || 'Não foi possível carregar o Ticket.';
        },
      });
  }

  submitObservation(): void {
    if (!this.ticket || !this.canEditTicket || this.isSubmittingObservation) {
      return;
    }

    const nextHistory = appendObservationHistory(
      this.ticket.observacoes,
      this.observationDraft,
      this.currentUserName,
    );

    if (!nextHistory) {
      return;
    }

    if (this.ticket.tipo === TREATMENT_TICKET_TYPE && !hasRequiredDocuments(this.ticket.anexos)) {
      this.showError(
        'É necessário associar pelo menos um documento antes de guardar um Ticket de Tratamento de Pendência.',
      );
      return;
    }

    const payload = prepareTicketUpdatePayload(this.ticket, {
      observacoes: nextHistory,
    });

    this.isSubmittingObservation = true;
    this.errorMessage = '';
    this.prepareOwnSocketSuppression();

    this.ticketService
      .updateTicket(this.ticket.id, payload)
      .pipe(finalize(() => (this.isSubmittingObservation = false)))
      .subscribe({
        next: (updatedTicket) => {
          if (!this.ticket) {
            return;
          }

          this.ticket = {
            ...this.ticket,
            observacoes: updatedTicket.observacoes || nextHistory,
            fluxo: updatedTicket.fluxo,
            updatedAt: updatedTicket.updatedAt || this.ticket.updatedAt,
          };
          this.observationDraft = '';
          this.successMessage = 'Observação enviada com sucesso.';
        },
        error: (error: HttpErrorResponse) => {
          this.clearOwnSocketSuppression();
          this.showError(error.error?.message || 'Não foi possível enviar a observação.');
        },
      });
  }

  startEditing(): void {
    if (!this.ticket || !this.canEditTicket || this.isSaving) {
      return;
    }

    this.initializeEditForm(this.ticket);
    this.selectedFiles = [];
    this.errorMessage = '';
    this.successMessage = '';
    this.socketMessage = '';
    this.isEditing = true;
  }

  cancelEditing(): void {
    if (this.ticket) {
      this.initializeEditForm(this.ticket);
    }

    this.selectedFiles = [];
    this.isEditing = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  saveChanges(): void {
    if (!this.ticket || !this.canEditTicket || this.ticketForm.invalid || this.isSaving) {
      this.ticketForm.markAllAsTouched();

      if (this.ticketForm.invalid) {
        this.showError('Preencha os campos obrigatórios antes de guardar.');
      }

      return;
    }

    const changes = this.buildPatchPayload();
    const effectiveType = this.ticket.tipo;
    const hasChanges = Object.keys(changes).length > 0;
    const hasFiles = this.selectedFiles.length > 0;

    if (
      effectiveType === TREATMENT_TICKET_TYPE &&
      !hasRequiredDocuments(this.ticket.anexos, this.selectedFiles)
    ) {
      this.showError(
        'É necessário associar pelo menos um documento antes de guardar um Ticket de Tratamento de Pendência.',
      );
      return;
    }

    if (!hasChanges && !hasFiles) {
      this.showSuccess('Não existem alterações para guardar.');
      this.isEditing = false;
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.prepareOwnSocketSuppression();

    if (effectiveType === TREATMENT_TICKET_TYPE && hasFiles) {
      this.saveTreatmentWithAttachments(changes);
      return;
    }

    const payload = prepareTicketUpdatePayload(this.ticket, changes);
    const updateRequest: Observable<TicketDetailModel> = hasChanges
      ? this.ticketService.updateTicket(this.ticket.id, payload)
      : of(this.ticket);

    updateRequest
      .pipe(
        switchMap((updatedTicket): Observable<SaveTicketResult> => {
          if (!hasFiles) {
            return of({ ticket: updatedTicket, uploadFailed: false, uploadError: null });
          }

          this.isUploadingAttachments = true;
          return this.ticketService.uploadAttachments(updatedTicket.id, this.selectedFiles).pipe(
            map((ticket) => ({ ticket, uploadFailed: false, uploadError: null })),
            catchError((uploadError: unknown) =>
              of({ ticket: updatedTicket, uploadFailed: true, uploadError }),
            ),
            finalize(() => (this.isUploadingAttachments = false)),
          );
        }),
        finalize(() => (this.isSaving = false)),
      )
      .subscribe({
        next: ({ ticket, uploadFailed, uploadError }) => {
          this.ticket = ticket;
          this.updateCanEditTicket();
          this.initializeEditForm(ticket);

          if (uploadFailed) {
            this.isEditing = true;
            this.showError(
              this.getApiErrorMessage(
                uploadError,
                'O Ticket foi atualizado, mas não foi possível carregar os anexos. Pode tentar novamente sem perder a seleção.',
              ),
            );
            return;
          }

          const uploadedFiles = this.selectedFiles.length;
          this.selectedFiles = [];
          this.isEditing = false;
          this.showSuccess(
            uploadedFiles
              ? 'Ticket e documentos atualizados com sucesso.'
              : 'Ticket atualizado com sucesso.',
          );
        },
        error: (error: unknown) => {
          this.clearOwnSocketSuppression();
          this.showError(this.getApiErrorMessage(error, 'Não foi possível atualizar o Ticket.'));
        },
      });
  }

  private saveTreatmentWithAttachments(changes: UpdateTicketRequest): void {
    if (!this.ticket) {
      this.isSaving = false;
      return;
    }

    const currentTicket = this.ticket;
    const filesToUpload = [...this.selectedFiles];
    this.isUploadingAttachments = true;

    this.ticketService
      .uploadAttachments(currentTicket.id, filesToUpload)
      .pipe(
        map((uploadedTicket) => ({ uploadedTicket, uploadError: null as unknown })),
        catchError((uploadError: unknown) => of({ uploadedTicket: null, uploadError })),
        switchMap(({ uploadedTicket, uploadError }) => {
          if (!uploadedTicket) {
            return of({
              ticket: currentTicket,
              uploadFailed: true,
              uploadError,
            } satisfies SaveTicketResult);
          }

          this.ticket = uploadedTicket;
          this.selectedFiles = [];
          const payload = prepareTicketUpdatePayload(uploadedTicket, changes);

          return this.ticketService.updateTicket(uploadedTicket.id, payload).pipe(
            map(
              (ticket) =>
                ({ ticket, uploadFailed: false, uploadError: null }) satisfies SaveTicketResult,
            ),
          );
        }),
        finalize(() => {
          this.isUploadingAttachments = false;
          this.isSaving = false;
        }),
      )
      .subscribe({
        next: ({ ticket, uploadFailed, uploadError }) => {
          this.ticket = ticket;
          this.updateCanEditTicket();

          if (uploadFailed) {
            this.showError(
              this.getApiErrorMessage(
                uploadError,
                'Não foi possível carregar os documentos. As alterações do Ticket não foram aplicadas; pode tentar novamente sem perder a seleção.',
              ),
            );
            return;
          }

          this.initializeEditForm(ticket);
          this.isEditing = false;
          this.showSuccess('Ticket e documentos atualizados com sucesso.');
        },
        error: (error: unknown) => {
          this.clearOwnSocketSuppression();
          this.isEditing = true;
          this.showError(
            this.getApiErrorMessage(
              error,
              'Os documentos foram carregados, mas não foi possível guardar as restantes alterações do Ticket. Tente guardar novamente.',
            ),
          );
        },
      });
  }

  deleteAttachment(document: TicketDocument): void {
    if (
      !this.ticket ||
      !this.canEditTicket ||
      !this.isEditing ||
      this.deletingAttachmentFileNames.has(document.fileName)
    ) {
      return;
    }

    if (this.ticket.tipo === TREATMENT_TICKET_TYPE && this.ticket.anexos.length <= 1) {
      this.showError(
        'Um ticket de Tratamento de Pendência deve manter pelo menos um documento associado.',
      );
      return;
    }

    const confirmed = window.confirm(
      `Tem a certeza que pretende remover o documento "${document.originalName}"?`,
    );

    if (!confirmed) {
      return;
    }

    this.deletingAttachmentFileNames.add(document.fileName);
    this.deletingAttachmentFileNames = new Set(this.deletingAttachmentFileNames);
    this.errorMessage = '';
    this.successMessage = '';
    this.prepareOwnSocketSuppression();

    this.ticketService
      .deleteAttachment(this.ticket.id, document.fileName)
      .pipe(
        finalize(() => {
          this.deletingAttachmentFileNames.delete(document.fileName);
          this.deletingAttachmentFileNames = new Set(this.deletingAttachmentFileNames);
        }),
      )
      .subscribe({
        next: (updatedTicket) => {
          this.ticket = updatedTicket;
          this.updateCanEditTicket();
          this.showSuccess(`O documento "${document.originalName}" foi removido com sucesso.`);
        },
        error: (error: unknown) => {
          this.clearOwnSocketSuppression();
          this.showError(
            this.getApiErrorMessage(
              error,
              `Não foi possível remover o documento "${document.originalName}".`,
            ),
          );
        },
      });
  }

  isDeletingAttachment(document: TicketDocument): boolean {
    return this.deletingAttachmentFileNames.has(document.fileName);
  }

  downloadDocument(document: TicketDocument): void {
    if (!this.fileAccess.canViewFile(document)) {
      this.showError('Não tem permissão para visualizar ficheiros de áudio.');
      return;
    }

    if (!this.ticket) {
      return;
    }

    this.ticketService.downloadDocument(this.ticket.id, document.fileName).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = document.originalName || document.fileName;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: () => this.showError('Não foi possível descarregar o documento.'),
    });
  }

  getTicketStatusClass(status: TicketEstado): string {
    return {
      Novo: 'ticket-status-new',
      'Em Tratamento': 'ticket-status-progress',
      Concluído: 'ticket-status-completed',
    }[status];
  }

  getTicketPriorityClass(priority: TicketPrioridade): string {
    return {
      Baixo: 'ticket-priority-low',
      Normal: 'ticket-priority-normal',
      Alto: 'ticket-priority-high',
      Urgente: 'ticket-priority-urgent',
    }[priority];
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  formatFileSize(bytes: number | null | undefined): string {
    if (!bytes || bytes <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** unitIndex;
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  getFileIcon(mimetype: string | null | undefined): string {
    const type = (mimetype ?? '').toLowerCase();
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('image')) return 'IMG';
    if (type.includes('word')) return 'DOC';
    if (type.includes('sheet') || type.includes('excel')) return 'XLS';
    return 'FILE';
  }

  private resolveAuthenticatedUser(): void {
    const currentUser = this.auth.getCurrentUser() as AuthenticatedUserLike | null;
    const role = currentUser?.role?.toLowerCase() ?? '';
    this.currentUserId = currentUser?.id ?? currentUser?._id ?? '';
    this.isSuperAdmin = role.includes('super admin');
  }

  private updateCanEditTicket(): void {
    if (!this.ticket) {
      this.canEditTicket = false;
      return;
    }

    if (this.isSuperAdmin) {
      this.canEditTicket = true;
      return;
    }

    if (!this.currentUserId) {
      this.canEditTicket = false;
      return;
    }

    this.canEditTicket =
      this.ticket.userId === this.currentUserId ||
      this.ticket.followers.some((follower) => follower.id === this.currentUserId);
  }

  private initializeEditForm(ticket: TicketDetailModel): void {
    const snapshot = this.buildSnapshotFromTicket(ticket);

    this.ticketForm.setValue({
      estado: snapshot.estado,
      prioridade: snapshot.prioridade,
      agendamento: this.toDateTimeLocal(snapshot.agendamento),
      descricao: snapshot.descricao,
    });

    this.ticketForm.markAsPristine();
    this.ticketForm.markAsUntouched();
    this.originalEditSnapshot = snapshot;
  }

  private buildSnapshotFromTicket(ticket: TicketDetailModel): TicketEditSnapshot {
    return {
      estado: ticket.estado,
      prioridade: ticket.prioridade,
      agendamento: ticket.agendamento,
      descricao: ticket.descricao ?? '',
    };
  }

  private buildSnapshotFromForm(): TicketEditSnapshot {
    const value = this.ticketForm.getRawValue();
    return {
      estado: value.estado,
      prioridade: value.prioridade,
      agendamento: value.agendamento ? new Date(value.agendamento).toISOString() : null,
      descricao: value.descricao,
    };
  }

  private buildPatchPayload(): UpdateTicketRequest {
    if (!this.originalEditSnapshot) {
      return {};
    }

    const current = this.buildSnapshotFromForm();
    const original = this.originalEditSnapshot;
    const payload: UpdateTicketRequest = {};

    if (current.estado !== original.estado) payload.estado = current.estado;
    if (current.prioridade !== original.prioridade) payload.prioridade = current.prioridade;
    if (current.agendamento !== original.agendamento) payload.agendamento = current.agendamento;
    if (current.descricao !== original.descricao) payload.descricao = current.descricao;

    return payload;
  }

  private handleTicketUpdated(event: TicketSocketEvent): void {
    const eventTicketId = this.getSocketTicketId(event);
    if (!eventTicketId || eventTicketId !== this.ticketId) {
      return;
    }

    const currentTime = new Date().toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });
    this.lastSocketUpdate = currentTime;
    const payload = event.ticket ?? event;

    if (this.ticket && payload.observacoes !== undefined) {
      this.ticket = {
        ...this.ticket,
        observacoes: payload.observacoes ?? '',
        updatedAt: payload.updatedAt ?? this.ticket.updatedAt,
      };
    }

    if (this.suppressNextOwnSocketUpdate) {
      this.clearOwnSocketSuppression();
      return;
    }

    if (this.isEditing) {
      this.synchronizeExternalUpdate(currentTime);
      return;
    }

    if (this.isCompleteSocketTicketPayload(payload)) {
      this.ticket = this.ticketService.normalizeSocketTicket(payload, this.ticketId);
      this.updateCanEditTicket();
      this.initializeEditForm(this.ticket);
      this.socketMessage = `Este Ticket foi atualizado às ${currentTime}.`;
      return;
    }

    this.refreshTicketFromSocket(currentTime);
  }

  private synchronizeExternalUpdate(currentTime: string): void {
    if (!this.ticketId || !this.ticket || !this.originalEditSnapshot) {
      return;
    }

    const currentSnapshot = this.buildSnapshotFromForm();
    const originalSnapshot = this.originalEditSnapshot;

    this.ticketService.getTicketById(this.ticketId).subscribe({
      next: (latestTicket) => {
        const latestSnapshot = this.buildSnapshotFromTicket(latestTicket);
        let updated = 0;
        let conflicts = 0;
        const keys: Array<keyof TicketEditSnapshot> = [
          'estado',
          'prioridade',
          'agendamento',
          'descricao',
        ];

        keys.forEach((key) => {
          const userChanged = currentSnapshot[key] !== originalSnapshot[key];
          const serverChanged = latestSnapshot[key] !== originalSnapshot[key];
          if (!serverChanged) return;

          if (!userChanged) {
            this.setFormSnapshotValue(key, latestSnapshot[key]);
            updated += 1;
          } else if (currentSnapshot[key] !== latestSnapshot[key]) {
            conflicts += 1;
          }
        });

        this.ticket = latestTicket;
        this.originalEditSnapshot = latestSnapshot;
        this.updateCanEditTicket();
        this.socketMessage = conflicts
          ? `Este Ticket foi atualizado por outro utilizador às ${currentTime}. ${updated} campo(s) foram sincronizados automaticamente e ${conflicts} alteração(ões) em conflito foram preservadas com os seus valores locais.`
          : `Este Ticket foi atualizado por outro utilizador às ${currentTime}. ${updated} campo(s) foram sincronizados automaticamente sem perder as suas alterações locais.`;
      },
      error: () => {
        this.socketMessage =
          `Este Ticket foi atualizado por outro utilizador às ${currentTime}, ` +
          'mas não foi possível sincronizar os dados automaticamente. Os seus valores locais foram preservados.';
      },
    });
  }

  private refreshTicketFromSocket(currentTime: string): void {
    this.ticketService.getTicketById(this.ticketId).subscribe({
      next: (ticket) => {
        this.ticket = ticket;
        this.updateCanEditTicket();
        this.initializeEditForm(ticket);
        this.socketMessage = `Este Ticket foi atualizado às ${currentTime}.`;
      },
      error: () => {
        this.socketMessage =
          `Foi recebida uma atualização deste Ticket às ${currentTime}, ` +
          'mas não foi possível sincronizar os dados automaticamente.';
      },
    });
  }

  private getSocketTicketId(event: TicketSocketEvent): string {
    return (
      event.ticketId ??
      event.id ??
      event._id ??
      event.ticket?.ticketId ??
      event.ticket?.id ??
      event.ticket?._id ??
      ''
    );
  }

  private isCompleteSocketTicketPayload(payload: TicketApiModel): boolean {
    const hasId = Boolean(payload.id ?? payload._id ?? payload.ticketId);
    const hasUser = Boolean(payload.userId ?? payload.user?.id ?? payload.user?._id);

    return Boolean(
      hasId &&
        payload.contractId &&
        payload.companyId &&
        payload.tipo &&
        payload.estado &&
        payload.prioridade &&
        hasUser &&
        Array.isArray(payload.followers) &&
        Array.isArray(payload.anexos ?? payload.documentos),
    );
  }

  private setFormSnapshotValue(
    key: keyof TicketEditSnapshot,
    value: TicketEditSnapshot[typeof key],
  ): void {
    switch (key) {
      case 'estado':
        this.ticketForm.controls.estado.setValue(value as TicketEstado);
        break;
      case 'prioridade':
        this.ticketForm.controls.prioridade.setValue(value as TicketPrioridade);
        break;
      case 'agendamento':
        this.ticketForm.controls.agendamento.setValue(this.toDateTimeLocal(value as string | null));
        break;
      case 'descricao':
        this.ticketForm.controls.descricao.setValue(value as string);
        break;
    }
  }

  private prepareOwnSocketSuppression(): void {
    this.clearOwnSocketSuppression();
    this.suppressNextOwnSocketUpdate = true;
    this.ownSocketSuppressionTimer = setTimeout(() => this.clearOwnSocketSuppression(), 10000);
  }

  private clearOwnSocketSuppression(): void {
    this.suppressNextOwnSocketUpdate = false;
    if (this.ownSocketSuppressionTimer) {
      clearTimeout(this.ownSocketSuppressionTimer);
      this.ownSocketSuppressionTimer = null;
    }
  }

  private toDateTimeLocal(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (part: number): string => String(part).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  }

  private getApiErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage =
        typeof error.error === 'object' &&
        error.error !== null &&
        'message' in error.error &&
        typeof error.error.message === 'string'
          ? error.error.message
          : '';

      if (isDocumentConfirmationApiError(apiMessage)) {
        return 'É necessário confirmar a existência de documentação para um Tratamento de Pendência.';
      }

      return apiMessage || fallback;
    }

    if (error instanceof Error && error.message) {
      if (isDocumentConfirmationApiError(error.message)) {
        return 'É necessário confirmar a existência de documentação para um Tratamento de Pendência.';
      }
      return error.message;
    }

    return fallback;
  }

  private showError(message: string): void {
    this.errorMessage = message;
    this.successMessage = '';
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    this.errorMessage = '';
  }
}
