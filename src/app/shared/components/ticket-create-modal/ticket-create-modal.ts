import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, map, of, switchMap } from 'rxjs';

import { Auth } from '../../../core/services/auth';
import {
  CONTRACT_CANCELLATION_REASONS,
  isContractCancellationReason,
} from '../../../core/constants/contract-cancellation-reasons';
import {
  CANCELLATION_TICKET_TYPE,
  CreateTicketRequest,
  CreatedTicket,
  hasRequiredDocuments,
  isDocumentConfirmationApiError,
  prepareTicketCreatePayload,
  TICKET_PRIORITY_OPTIONS,
  TICKET_TYPE_OPTIONS,
  TREATMENT_TICKET_TYPE,
  TicketPrioridade,
  TicketService,
  TicketTipo,
} from '../../../core/services/ticket';
import {
  ProfileUser,
  UserService,
} from '../../../core/services/user';

export interface TicketCreateModalResult {
  ticket: CreatedTicket;
  attachmentsUploaded: boolean;
  attachmentUploadFailed: boolean;
}

import { FileDropzone } from '../file-dropzone/file-dropzone';

@Component({
  selector: 'app-ticket-create-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FileDropzone,
  ],
  templateUrl: './ticket-create-modal.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './ticket-create-modal.scss',
})
export class TicketCreateModal implements OnInit {
  private readonly auth = inject(Auth);
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ticketService = inject(TicketService);

  @Input({ required: true }) contractId = '';
  @Input({ required: true }) companyId = '';

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<TicketCreateModalResult>();

  currentUser: ProfileUser | null = null;
  assignableUsers: ProfileUser[] = [];
  selectedFiles: File[] = [];

  isLoadingAssignment = false;
  isCreatingTicket = false;
  isUploadingAttachments = false;
  errorMessage = '';

  private createdTicketPendingAttachments: CreatedTicket | null = null;

  readonly ticketTypeOptions = TICKET_TYPE_OPTIONS;
  readonly priorityOptions = TICKET_PRIORITY_OPTIONS;
  readonly cancellationReasonOptions = CONTRACT_CANCELLATION_REASONS;

  readonly ticketForm = this.fb.group({
    tipo: this.fb.nonNullable.control<TicketTipo | ''>(
      '',
      Validators.required,
    ),
    prioridade: this.fb.nonNullable.control<TicketPrioridade>('Normal'),
    assignedUserId: this.fb.nonNullable.control(
      { value: '', disabled: true },
      Validators.required,
    ),
    agendamento: this.fb.nonNullable.control(''),
    descricao: this.fb.nonNullable.control(''),
    observacoes: this.fb.nonNullable.control(''),
    motivoAnulacao: this.fb.nonNullable.control(''),
    motivoAnulacaoOutras: this.fb.nonNullable.control(''),
  });

  get tipo(): TicketTipo | '' {
    return this.ticketForm.controls.tipo.value;
  }

  get prioridade(): TicketPrioridade {
    return this.ticketForm.controls.prioridade.value;
  }

  get assignedUserId(): string {
    return this.ticketForm.controls.assignedUserId.value;
  }

  get agendamento(): string {
    return this.ticketForm.controls.agendamento.value;
  }

  get descricao(): string {
    return this.ticketForm.controls.descricao.value;
  }

  get observacoes(): string {
    return this.ticketForm.controls.observacoes.value;
  }

  get isTreatmentSelected(): boolean {
    return this.tipo === TREATMENT_TICKET_TYPE;
  }

  get isCancellationSelected(): boolean {
    return this.tipo === CANCELLATION_TICKET_TYPE;
  }

  get isDescriptionRequired(): boolean {
    return (
      this.tipo === 'Novo Pedido de Chamada' ||
      this.tipo === TREATMENT_TICKET_TYPE
    );
  }

  get motivoAnulacao(): string {
    return this.ticketForm.controls.motivoAnulacao.value;
  }

  get motivoAnulacaoOutras(): string {
    return this.ticketForm.controls.motivoAnulacaoOutras.value;
  }

  get isCancellationReasonOther(): boolean {
    return this.motivoAnulacao === 'Outras';
  }

  get isCancellationReasonInvalid(): boolean {
    const control = this.ticketForm.controls.motivoAnulacao;
    return (
      this.isCancellationSelected &&
      control.touched &&
      !isContractCancellationReason(control.value)
    );
  }

  get isCancellationReasonOtherInvalid(): boolean {
    const control = this.ticketForm.controls.motivoAnulacaoOutras;
    return (
      this.isCancellationSelected &&
      this.isCancellationReasonOther &&
      control.touched &&
      !control.value.trim()
    );
  }

  get hasPendingAttachmentRetry(): boolean {
    return this.createdTicketPendingAttachments !== null;
  }

  get isFormLocked(): boolean {
    return this.isCreatingTicket || this.hasPendingAttachmentRetry;
  }

  ngOnInit(): void {
    this.syncDescriptionValidation();

    this.ticketForm.controls.tipo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.syncDescriptionValidation();
        this.syncCancellationValidation();
        this.errorMessage = '';
      });

    this.ticketForm.controls.motivoAnulacao.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value !== 'Outras') {
          this.ticketForm.controls.motivoAnulacaoOutras.setValue('', { emitEvent: false });
        }
        this.syncCancellationValidation();
        this.errorMessage = '';
      });

    this.syncCancellationValidation();
    this.loadAssignmentData();
  }

  canAssignOtherUsers(): boolean {
    return this.assignableUsers.length > 1;
  }


  onAssignedUserChange(): void {
    if (!this.assignedUserId) {
      return;
    }

    const selectedUser = this.assignableUsers.find(
      (user) => user.id === this.assignedUserId,
    );

    if (!selectedUser) {
      this.errorMessage =
        'O responsável selecionado já não está disponível para atribuição.';
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    if (!files.length) {
      return;
    }

    const existingKeys = new Set(
      this.selectedFiles.map((file) =>
        this.getFileKey(file),
      ),
    );

    this.selectedFiles = [
      ...this.selectedFiles,
      ...files.filter(
        (file) => !existingKeys.has(this.getFileKey(file)),
      ),
    ];

    input.value = '';
  }

  removeSelectedFile(index: number): void {
    this.selectedFiles = this.selectedFiles.filter(
      (_, currentIndex) => currentIndex !== index,
    );
  }

  clearSelectedFiles(): void {
    this.selectedFiles = [];
  }

  formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1,
    );
    const value = bytes / 1024 ** unitIndex;

    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  submit(): void {
    if (this.isCreatingTicket || this.isUploadingAttachments) {
      return;
    }

    if (this.createdTicketPendingAttachments) {
      this.retryAttachmentUpload();
      return;
    }

    const validationError = this.validateForm();

    if (validationError) {
      this.errorMessage = validationError;
      this.ticketForm.markAllAsTouched();
      return;
    }

    if (
      this.isTreatmentSelected &&
      !hasRequiredDocuments([], this.selectedFiles)
    ) {
      this.errorMessage =
        'Para criar um ticket de Tratamento de Pendência é obrigatório adicionar pelo menos um documento.';
      return;
    }

    this.createTicket();
  }

  retryAttachmentUpload(): void {
    const ticket = this.createdTicketPendingAttachments;

    if (!ticket || this.isUploadingAttachments || this.isCreatingTicket) {
      return;
    }

    if (!this.selectedFiles.length) {
      this.errorMessage =
        ticket.tipo === TREATMENT_TICKET_TYPE
          ? 'Para concluir o envio de um Ticket de Tratamento de Pendência é obrigatório manter pelo menos um documento selecionado.'
          : 'Selecione pelo menos um documento para repetir o envio dos anexos.';
      return;
    }

    this.errorMessage = '';
    this.isUploadingAttachments = true;

    this.ticketService
      .uploadAttachments(ticket.ticketId, this.selectedFiles)
      .pipe(
        finalize(() => {
          this.isUploadingAttachments = false;
        }),
      )
      .subscribe({
        next: () => {
          this.createdTicketPendingAttachments = null;
          this.syncReactiveFormDisabledState();
          this.finishCreation({
            ticket,
            attachmentsUploaded: true,
            attachmentUploadFailed: false,
          });
        },
        error: () => {
          this.errorMessage =
            'O ticket foi criado, mas não foi possível carregar os documentos. Tente novamente o envio dos anexos.';
        },
      });
  }

  close(): void {
    if (this.isCreatingTicket || this.isUploadingAttachments) {
      return;
    }

    if (this.createdTicketPendingAttachments) {
      const ticket = this.createdTicketPendingAttachments;
      this.createdTicketPendingAttachments = null;
      this.created.emit({
        ticket,
        attachmentsUploaded: false,
        attachmentUploadFailed: true,
      });
      return;
    }

    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  private createTicket(): void {
    const payload = this.buildPayload();

    this.errorMessage = '';
    this.isCreatingTicket = true;
    this.syncReactiveFormDisabledState();

    this.ticketService
      .createTicket(payload)
      .pipe(
        switchMap((ticket) => {
          if (!this.selectedFiles.length) {
            return of({
              ticket,
              attachmentsUploaded: false,
              attachmentUploadFailed: false,
              uploadError: null,
            });
          }

          this.isUploadingAttachments = true;

          return this.ticketService
            .uploadAttachments(
              ticket.ticketId,
              this.selectedFiles,
            )
            .pipe(
              map(() => ({
                ticket,
                attachmentsUploaded: true,
                attachmentUploadFailed: false,
                uploadError: null,
              })),
              catchError((uploadError: unknown) =>
                of({
                  ticket,
                  attachmentsUploaded: false,
                  attachmentUploadFailed: true,
                  uploadError,
                }),
              ),
              finalize(() => {
                this.isUploadingAttachments = false;
              }),
            );
        }),
        finalize(() => {
          this.isCreatingTicket = false;
          this.syncReactiveFormDisabledState();
        }),
      )
      .subscribe({
        next: (result) => {
          if (result.attachmentUploadFailed) {
            this.createdTicketPendingAttachments = result.ticket;
            this.syncReactiveFormDisabledState();

            this.errorMessage =
              'O ticket foi criado, mas não foi possível carregar os documentos. Tente novamente o envio dos anexos.';
            return;
          }

          this.finishCreation(result);
        },
        error: (error: unknown) => {
          const message = this.getApiErrorMessage(error);
          this.errorMessage = message;
        },
      });
  }

  private finishCreation(result: TicketCreateModalResult): void {
    this.created.emit(result);
  }
  private syncReactiveFormDisabledState(): void {
    if (this.isFormLocked) {
      this.ticketForm.disable({ emitEvent: false });
    } else {
      this.ticketForm.enable({ emitEvent: false });

      if (!this.canAssignOtherUsers()) {
        this.ticketForm.controls.assignedUserId.disable({ emitEvent: false });
      }
    }
  }

  private loadAssignmentData(): void {
    const authenticatedUser = this.auth.getCurrentUser();

    if (!authenticatedUser?.id) {
      this.errorMessage =
        'Não foi possível identificar o utilizador autenticado.';
      return;
    }

    this.userService.assignableUsersState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.isLoadingAssignment = state.loading && !state.loaded;

        if (state.loading) {
          return;
        }

        if (!state.loaded) {
          if (state.error) {
            this.errorMessage =
              'Não foi possível carregar os utilizadores disponíveis.';
          }
          return;
        }

        this.assignableUsers = state.users;

        const currentUser =
          state.users.find((user) => user.id === authenticatedUser.id) ?? null;

        if (!currentUser) {
          this.currentUser = null;
          this.errorMessage =
            'Não foi possível localizar o utilizador autenticado entre os utilizadores atribuíveis.';
          this.syncReactiveFormDisabledState();
          return;
        }

        this.currentUser = currentUser;

        if (!this.assignedUserId) {
          this.initializeAssignment(currentUser);
        } else {
          const selectedUser =
            state.users.find((user) => user.id === this.assignedUserId) ?? null;

          if (!selectedUser) {
            this.errorMessage =
              'O responsável selecionado deixou de estar disponível. Foi reposto o utilizador atual.';
            this.initializeAssignment(currentUser);
          } else {
            this.refreshAssignmentFromCache(selectedUser);
          }
        }

        this.syncReactiveFormDisabledState();
      });
  }

  private refreshAssignmentFromCache(user: ProfileUser): void {
    if (this.assignedUserId !== user.id) {
      this.ticketForm.controls.assignedUserId.setValue(user.id);
    }
  }

  private initializeAssignment(
    user: ProfileUser,
    updateAssignedUser = true,
  ): void {
    if (updateAssignedUser) {
      this.ticketForm.controls.assignedUserId.setValue(user.id);
    }
  }

  private syncDescriptionValidation(): void {
    const control = this.ticketForm.controls.descricao;

    if (this.isDescriptionRequired) {
      control.setValidators([Validators.required]);
    } else {
      control.clearValidators();
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private syncCancellationValidation(): void {
    const reasonControl = this.ticketForm.controls.motivoAnulacao;
    const otherControl = this.ticketForm.controls.motivoAnulacaoOutras;

    if (this.isCancellationSelected) {
      reasonControl.setValidators([Validators.required]);
      if (this.isCancellationReasonOther) {
        otherControl.setValidators([Validators.required]);
      } else {
        otherControl.clearValidators();
        otherControl.setValue('', { emitEvent: false });
      }
    } else {
      reasonControl.clearValidators();
      otherControl.clearValidators();
      reasonControl.setValue('', { emitEvent: false });
      otherControl.setValue('', { emitEvent: false });
    }

    reasonControl.updateValueAndValidity({ emitEvent: false });
    otherControl.updateValueAndValidity({ emitEvent: false });
  }

  private validateForm(): string | null {
    if (!this.contractId || !this.companyId) {
      return 'Não foi possível identificar o contrato ou a comercializadora.';
    }

    if (!this.tipo) {
      return 'Selecione o tipo do Ticket.';
    }

    if (!this.assignedUserId) {
      return 'Selecione o responsável pelo Ticket.';
    }

    if (!this.assignableUsers.some((user) => user.id === this.assignedUserId)) {
      return 'O responsável selecionado já não está disponível para atribuição.';
    }

    if (this.isDescriptionRequired && !this.descricao.trim()) {
      return 'A descrição é obrigatória para este tipo de Ticket.';
    }

    if (this.isCancellationSelected) {
      if (!isContractCancellationReason(this.motivoAnulacao)) {
        this.ticketForm.controls.motivoAnulacao.markAsTouched();
        return 'Selecione um motivo de anulação válido.';
      }

      if (this.isCancellationReasonOther && !this.motivoAnulacaoOutras.trim()) {
        this.ticketForm.controls.motivoAnulacaoOutras.markAsTouched();
        return 'Descreva o motivo da anulação.';
      }
    }

    return null;
  }

  private buildPayload(): CreateTicketRequest {
    const description = this.descricao.trim();
    const observations = this.observacoes.trim();
    const finalDescription = this.isCancellationSelected ? '' : description;
    const cancellationReason = this.motivoAnulacao;

    const payload: CreateTicketRequest = {
      contractId: this.contractId,
      companyId: this.companyId,
      tipo: this.tipo as TicketTipo,
      ...(this.isCancellationSelected && isContractCancellationReason(cancellationReason)
        ? {
            motivoAnulacao: cancellationReason,
            ...(cancellationReason === 'Outras'
              ? { motivoAnulacaoOutras: this.motivoAnulacaoOutras.trim() }
              : {}),
          }
        : {}),
      ...(this.prioridade !== 'Normal'
        ? { prioridade: this.prioridade }
        : {}),
      ...(this.agendamento
        ? { agendamento: new Date(this.agendamento).toISOString() }
        : {}),
      ...(finalDescription
        ? { descricao: finalDescription }
        : {}),
      ...(observations
        ? { observacoes: observations }
        : {}),
      userId: this.assignedUserId,
    };

    return prepareTicketCreatePayload(
      payload,
      hasRequiredDocuments([], this.selectedFiles),
    );
  }

  private getApiErrorMessage(
    error: unknown,
    fallback = 'Não foi possível criar o Ticket.',
  ): string {
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

  private getFileKey(file: File): string {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }
}
