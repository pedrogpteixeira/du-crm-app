import {
  canManageQualityControl as canManageQualityControlRole,
  QUALITY_CONTROL_BACKOFFICE_OPTIONS,
} from '../../../core/config/quality-control';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, map, of, switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  mergeContractActivitySocketPayload,
  mergeContractStateSocketPayload,
  preserveContractActivity,
} from '../../../core/models/contract-activity';
import { Auth } from '../../../core/services/auth';
import { FileAccessService } from '../../../core/services/file-access';
import {
  GALP_SOLAR_PANEL_SUGGESTIONS,
  GALP_SOLAR_PAYMENT_METHOD_SUGGESTIONS,
  GALP_SOLAR_STATUSES,
  GalpSolarContract,
  GalpSolarContractDocument,
  GalpSolarContractService,
  GalpSolarContractStatus,
  UpdateGalpSolarContractRequest,
} from '../../../core/services/galp-solar-contract';
import { PreferencesService } from '../../../core/services/preferences';
import { SocketService } from '../../../core/services/socket';
import { ProfileUser, UserService } from '../../../core/services/user';

interface EditableContractForm {
  nomeClienteEmpresa: string;
  nif: number | null;
  telefone: number | null;
  email: string;
  cae: string;
  crc: string;

  tipoSegmento: string;
  tipoProduto: string;
  contratacao: string;
  numeroLead: string;
  offer: string;

  controleQualidade: string;
  codigoRegistoCE: string;
  nomeRegistoCE: string;
  estado: GalpSolarContractStatus;

  agendamento: string;
  dataAssinatura: string;
  dataContrato: string;
  dataRegisto: string;
  dataPrevistaInstalacao: string;
  dataInstalacao: string;
  dataAtivacao: string;
  dataBaixa: string;

  moradaInstalacao: string;
  moradaFaturacao: string;

  faturaEletronica: boolean;
  debitoDireto: boolean;
  nib: string;

  tipoPainel: string;
  microinversor: boolean;
  baterias: boolean;
  numeroPaineisSolares: number;
  metodoPagamento: string;
}

interface AuthenticatedUserLike {
  id?: string;
  _id?: string;
  role?: string;
  name?: string;
  username?: string;
}
import { appendObservationHistory } from '../../../core/utils/observation-history';
import { ContractActivityPanel } from '../../../shared/components/contract-activity-panel/contract-activity-panel';
import { ObservationsThread } from '../../../shared/components/observations-thread/observations-thread';

import { getContractFormValidationError } from '../../../core/utils/contract-field-formatting';
import { VisibleAttachmentsPipe } from '../../../shared/pipes/visible-attachments.pipe';
import { ContractFieldMaskDirective } from '../../../shared/directives/contract-field-mask.directive';
import { FileDropzone } from '../../../shared/components/file-dropzone/file-dropzone';

@Component({
  selector: 'app-galp-solar-contract-detail',
  imports: [
    CommonModule,
    FormsModule,
    ContractFieldMaskDirective,
    VisibleAttachmentsPipe,
    RouterLink,
    ContractActivityPanel,
    ObservationsThread,
    FileDropzone,
  ],
  templateUrl: './galp-solar-contract-detail.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './galp-solar-contract-detail.scss',
})
export class GalpSolarContractDetail implements OnInit {
  readonly qualityControlBackofficeOptions = QUALITY_CONTROL_BACKOFFICE_OPTIONS;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly fileAccess = inject(FileAccessService);
  private readonly galpSolarContractService = inject(GalpSolarContractService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly socketService = inject(SocketService);
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  private currentUserId = '';
  currentUserName = '';
  private suppressNextOwnSocketUpdate = false;
  private ownSocketSuppressionTimer: ReturnType<typeof setTimeout> | null = null;

  contract: GalpSolarContract | null = null;

  observationDraft = '';
  internalObservationDraft = '';
  isSubmittingObservation = false;
  isSubmittingInternalObservation = false;
  selectedFiles: File[] = [];
  deletingAttachmentFileNames = new Set<string>();

  editForm = this.buildEmptyEditForm();
  originalEditForm = this.buildEmptyEditForm();

  collapsedSections = this.buildCollapsedSections(false);

  isLoading = false;
  isSaving = false;
  isEditing = false;
  isSuperAdmin = false;
  canAccessInternalObservations = false;

  errorMessage = '';
  successMessage = '';
  socketMessage = '';

  contractId = '';
  lastSocketUpdate = '';

  readonly tipoSegmentoOptions = ['Residencial', 'Empresarial', 'Condomínios'];

  readonly tipoProdutoOptions = ['Painéis Solares'];

  readonly contratacaoOptions = ['Contratação Papel', 'Contratação Digital'];

  readonly estadoOptions = GALP_SOLAR_STATUSES;
  readonly panelSuggestions = GALP_SOLAR_PANEL_SUGGESTIONS;
  readonly paymentMethodSuggestions = GALP_SOLAR_PAYMENT_METHOD_SUGGESTIONS;

  ngOnInit(): void {
    this.resolvePermissions();

    const collapseByDefault =
      this.preferencesService.getPreferences().contractDetailsCollapsedByDefault;

    this.collapsedSections = this.buildCollapsedSections(collapseByDefault);

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.contractId = params.get('id') ?? '';

      if (this.contractId) {
        this.loadContract(this.contractId);
      }
    });

    this.socketService
      .listenGalpSolarContractUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.contractId !== this.contractId) {
          return;
        }

        const activityUpdate = mergeContractActivitySocketPayload(this.contract, event);

        if (activityUpdate.updated) {
          this.contract = activityUpdate.contract;
        }

        if (
          this.contract &&
          (event.observacoes !== undefined || event.observacoesInternas !== undefined)
        ) {
          this.contract = {
            ...this.contract,
            ...(event.observacoes !== undefined ? { observacoes: event.observacoes ?? '' } : {}),
            ...(event.observacoesInternas !== undefined
              ? { observacoesInternas: event.observacoesInternas ?? '' }
              : {}),
          };
        }

        const stateUpdate = mergeContractStateSocketPayload(
          this.contract,
          event,
          this.estadoOptions,
        );

        if (stateUpdate.updated && stateUpdate.contract) {
          this.contract = stateUpdate.contract;

          if (
            this.isEditing &&
            stateUpdate.estado &&
            this.editForm.estado === this.originalEditForm.estado
          ) {
            this.editForm = {
              ...this.editForm,
              estado: stateUpdate.estado,
            };

            this.originalEditForm = {
              ...this.originalEditForm,
              estado: stateUpdate.estado,
            };
          }
        }

        const currentTime = new Date().toLocaleTimeString('pt-PT');

        this.lastSocketUpdate = currentTime;

        if (event.ticketEvent && Array.isArray(event.tickets)) {
          if (!Array.isArray(event.fluxo)) {
            this.refreshContractActivity();
          }

          return;
        }

        const eventUserId = this.getSocketEventUserId(event);

        const isOwnSocketUpdate = Boolean(
          eventUserId && this.currentUserId && eventUserId === this.currentUserId,
        );

        if (isOwnSocketUpdate || (!eventUserId && this.suppressNextOwnSocketUpdate)) {
          if (!Array.isArray(event.fluxo)) {
            this.refreshContractActivity();
          }

          this.clearOwnSocketSuppression();
          return;
        }

        if (this.isEditing) {
          this.synchronizeExternalUpdate(currentTime);
          return;
        }

        this.socketMessage = `Este contrato foi atualizado por outro utilizador às ${currentTime}.`;

        this.loadContract(this.contractId, false);
      });
  }

  loadContract(contractId: string, showLoading = true): void {
    if (!contractId) {
      this.showError('Contrato inválido.');
      return;
    }

    if (showLoading) {
      this.isLoading = true;
    }

    this.errorMessage = '';

    this.galpSolarContractService
      .getById(contractId)
      .pipe(
        finalize(() => {
          if (showLoading) {
            this.isLoading = false;
          }
        }),
      )
      .subscribe({
        next: (contract) => {
          if (!this.hasContractAccess(contract)) {
            this.contract = null;
            this.isLoading = false;

            this.showError('Não tem permissão para aceder a este contrato.');

            this.router.navigateByUrl('/error', {
              replaceUrl: true,
            });

            return;
          }

          this.contract = contract;
          this.initializeEditForm(contract);
        },
        error: () => {
          this.showError('Não foi possível carregar o contrato Galp Solar.');
        },
      });
  }

  submitObservation(message: string): void {
    this.submitObservationValue(message, false);
  }

  submitInternalObservation(message: string): void {
    this.submitObservationValue(message, true);
  }

  private submitObservationValue(message: string, internal: boolean): void {
    if (
      !this.contract ||
      !this.contractId ||
      !this.isSuperAdmin ||
      (internal && !this.canAccessInternalObservations) ||
      (internal ? this.isSubmittingInternalObservation : this.isSubmittingObservation)
    ) {
      return;
    }

    const currentValue = internal ? this.contract.observacoesInternas : this.contract.observacoes;

    const nextHistory = appendObservationHistory(currentValue, message, this.currentUserName);

    if (!nextHistory) {
      return;
    }

    if (internal) {
      this.isSubmittingInternalObservation = true;
    } else {
      this.isSubmittingObservation = true;
    }

    this.errorMessage = '';

    const payload = internal ? { observacoesInternas: nextHistory } : { observacoes: nextHistory };

    this.galpSolarContractService
      .update(this.contractId, payload)
      .pipe(
        finalize(() => {
          if (internal) {
            this.isSubmittingInternalObservation = false;
          } else {
            this.isSubmittingObservation = false;
          }
        }),
      )
      .subscribe({
        next: (updatedContract) => {
          if (!this.contract) {
            return;
          }

          if (internal) {
            this.contract = {
              ...this.contract,
              observacoesInternas: updatedContract.observacoesInternas ?? nextHistory,
            };
            this.internalObservationDraft = '';
          } else {
            this.contract = {
              ...this.contract,
              observacoes: updatedContract.observacoes ?? nextHistory,
            };
            this.observationDraft = '';
          }

          this.successMessage = internal
            ? 'Observação interna enviada com sucesso.'
            : 'Observação enviada com sucesso.';
        },
        error: () => {
          this.showError(
            internal
              ? 'Não foi possível enviar a observação interna.'
              : 'Não foi possível enviar a observação.',
          );
        },
      });
  }

  startEditing(): void {
    if (!this.isSuperAdmin || !this.contract) {
      return;
    }

    this.initializeEditForm(this.contract);
    this.selectedFiles = [];
    this.isEditing = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEditing(): void {
    if (this.contract) {
      this.initializeEditForm(this.contract);
    }

    this.observationDraft = '';
    this.internalObservationDraft = '';
    this.selectedFiles = [];
    this.isEditing = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 9);

    input.value = digits;
    this.editForm.telefone = digits ? Number(digits) : null;
  }

  saveChanges(): void {
    if (!this.isSuperAdmin || !this.contract || !this.contractId) {
      return;
    }

    if (!/^\d{9}$/.test(String(this.editForm.telefone ?? ''))) {
      this.showError('O telefone deve ter exatamente 9 dígitos.');
      return;
    }

    if (!this.editForm.tipoPainel.trim()) {
      this.showError('O tipo de painel é obrigatório.');
      return;
    }

    const numeroPaineis = Number(this.editForm.numeroPaineisSolares);

    if (!Number.isFinite(numeroPaineis) || numeroPaineis < 1) {
      this.showError('O número de painéis solares deve ser igual ou superior a 1.');
      return;
    }

    const fieldValidationError = getContractFormValidationError(
      this.editForm as unknown as Record<string, unknown>,
    );

    if (fieldValidationError) {
      this.showError(fieldValidationError);
      return;
    }

    const payload = this.buildPatchPayload();
    const hasContractChanges = Object.keys(payload).length > 0;
    const hasFiles = this.selectedFiles.length > 0;

    if (!hasContractChanges && !hasFiles) {
      this.showSuccess('Não existem alterações para guardar.');
      this.isEditing = false;
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.prepareOwnSocketSuppression();

    const updateRequest = hasContractChanges
      ? this.galpSolarContractService.update(this.contractId, payload)
      : of(this.contract);

    updateRequest
      .pipe(
        switchMap((updatedContract) => {
          if (!hasFiles) {
            return of({
              contract: updatedContract,
              uploadFailed: false,
              uploadError: null as unknown,
            });
          }

          return this.galpSolarContractService
            .uploadAttachments(this.contractId, this.selectedFiles)
            .pipe(
              map((contractWithFiles) => ({
                contract: contractWithFiles,
                uploadFailed: false,
                uploadError: null as unknown,
              })),
              catchError((uploadError) =>
                of({
                  contract: updatedContract,
                  uploadFailed: true,
                  uploadError,
                }),
              ),
            );
        }),
        finalize(() => {
          this.isSaving = false;
        }),
      )
      .subscribe({
        next: ({ contract: updatedContract, uploadFailed, uploadError }) => {
          const contractWithActivity = preserveContractActivity(updatedContract, this.contract);

          this.contract = contractWithActivity;
          this.initializeEditForm(contractWithActivity);
          this.observationDraft = '';
          this.internalObservationDraft = '';

          if (uploadFailed) {
            this.isEditing = true;
            this.showError(
              (
                uploadError as {
                  error?: { message?: string };
                } | null
              )?.error?.message ||
                'As alterações foram guardadas, mas não foi possível carregar os ficheiros. Pode tentar novamente sem perder a seleção.',
            );
            return;
          }

          const uploadedFiles = this.selectedFiles.length;
          this.selectedFiles = [];
          this.isEditing = false;

          this.showSuccess(
            uploadedFiles
              ? 'Contrato e ficheiros atualizados com sucesso.'
              : 'Contrato Galp Solar atualizado com sucesso.',
          );
        },
        error: (error) => {
          this.clearOwnSocketSuppression();
          this.showError(
            error?.error?.details?.join(' ') ||
              error?.error?.message ||
              'Não foi possível atualizar o contrato Galp Solar.',
          );
        },
      });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files: File[] = input.files ? Array.from(input.files) : [];

    if (!files.length) {
      return;
    }

    const existingFileKeys = new Set(this.selectedFiles.map((file) => this.getFileKey(file)));

    const newFiles = files.filter((file) => !existingFileKeys.has(this.getFileKey(file)));

    this.selectedFiles = [...this.selectedFiles, ...newFiles];
    input.value = '';
  }

  removeSelectedFile(index: number): void {
    this.selectedFiles = this.selectedFiles.filter((_, fileIndex) => fileIndex !== index);
  }

  clearSelectedFiles(): void {
    this.selectedFiles = [];
  }

  deleteAttachment(document: GalpSolarContractDocument): void {
    if (
      !this.isSuperAdmin ||
      !this.isEditing ||
      !this.contract ||
      !this.contractId ||
      this.deletingAttachmentFileNames.has(document.fileName)
    ) {
      return;
    }

    const confirmed = window.confirm(`Pretende remover o ficheiro "${document.originalName}"?`);

    if (!confirmed) {
      return;
    }

    const previousContract = this.contract;

    this.deletingAttachmentFileNames.add(document.fileName);
    this.deletingAttachmentFileNames = new Set(this.deletingAttachmentFileNames);

    this.contract = {
      ...previousContract,
      documentos: (previousContract.documentos ?? []).filter(
        (existingDocument) => existingDocument.fileName !== document.fileName,
      ),
    };

    this.errorMessage = '';
    this.successMessage = '';
    this.prepareOwnSocketSuppression();

    this.galpSolarContractService
      .deleteAttachment(this.contractId, document.fileName)
      .pipe(
        finalize(() => {
          this.deletingAttachmentFileNames.delete(document.fileName);
          this.deletingAttachmentFileNames = new Set(this.deletingAttachmentFileNames);
        }),
      )
      .subscribe({
        next: (updatedContract) => {
          this.contract = preserveContractActivity(updatedContract, this.contract);
          this.showSuccess(`O ficheiro "${document.originalName}" foi removido com sucesso.`);
        },
        error: (error) => {
          this.clearOwnSocketSuppression();
          this.contract = previousContract;

          this.showError(
            error?.error?.message ||
              `Não foi possível remover o ficheiro "${document.originalName}".`,
          );
        },
      });
  }

  isDeletingAttachment(document: GalpSolarContractDocument): boolean {
    return this.deletingAttachmentFileNames.has(document.fileName);
  }

  downloadDocument(document: GalpSolarContractDocument): void {
    if (!this.fileAccess.canViewFile(document)) {
      this.showError('Não tem permissão para visualizar ficheiros de áudio.');
      return;
    }

    if (!this.contract?.id || !document.fileName) {
      return;
    }

    this.galpSolarContractService
      .downloadAttachment(this.contract.id, document.fileName)
      .subscribe({
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
        error: () => {
          this.showError('Não foi possível descarregar o anexo.');
        },
      });
  }

  toggleSection(section: keyof typeof this.collapsedSections): void {
    this.collapsedSections[section] = !this.collapsedSections[section];
  }

  getStatusClass(status: GalpSolarContractStatus): string {
    const classes: Record<GalpSolarContractStatus, string> = {
      'Pedido de Proposta': 'status-proposal-request',
      'Proposta enviada': 'status-proposal-sent',
      'Envio Quality Check': 'status-quality-check',
      'Pendente Docs': 'status-docs-pending',
      'Documentos Enviados': 'status-docs-sent',
      'Em instalação': 'status-installation',
      Ativo: 'status-active',
      Cancelado: 'status-cancelled',
    };

    return classes[status];
  }

  formatBoolean(value: boolean | undefined): string {
    return value ? 'Sim' : 'Não';
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  canManageQualityControl(): boolean {
    return canManageQualityControlRole(this.auth.getCurrentUser()?.role);
  }

  getValue(value: string | number | null | undefined): string | number {
    return value === null || value === undefined || value === '' ? '-' : value;
  }

  formatFileSize(bytes: number | undefined): string {
    const size = bytes ?? 0;

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  getFileIcon(mimetype: string | undefined): string {
    const type = mimetype ?? '';

    if (type.startsWith('audio/')) {
      return '🎧';
    }

    if (type.includes('pdf')) {
      return '📄';
    }

    if (type.includes('word')) {
      return '📝';
    }

    if (type.startsWith('image/')) {
      return '🖼️';
    }

    return '📎';
  }

  private getFileKey(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  private resolvePermissions(): void {
    const currentUser = this.auth.getCurrentUser() as AuthenticatedUserLike | null;

    const role = currentUser?.role?.toLowerCase() ?? '';

    this.currentUserId = currentUser?.id ?? currentUser?._id ?? '';
    this.currentUserName = currentUser?.name ?? currentUser?.username ?? 'Utilizador';
    this.isSuperAdmin = role.includes('super admin');

    if (!this.currentUserId) {
      return;
    }

    this.userService.getUserById(this.currentUserId).subscribe({
      next: (user) => {
        const teamIds =
          (
            user as ProfileUser & {
              teams?: Array<{ id?: string }>;
            }
          ).teams
            ?.map((team) => team.id ?? '')
            .filter(Boolean) ?? [];

        const authorizedTeamIds = [environment.EQUIPA_CRM_ID, environment.EQUIPA_DU_ID].filter(
          (teamId): teamId is string => Boolean(teamId),
        );

        this.canAccessInternalObservations =
          this.isSuperAdmin || teamIds.some((teamId) => authorizedTeamIds.includes(teamId));

        if (!this.canAccessInternalObservations) {
          this.internalObservationDraft = '';
        }
      },
    });
  }

  private hasContractAccess(contract: GalpSolarContract): boolean {
    if (this.isSuperAdmin) {
      return true;
    }

    return (contract.followers ?? []).some((follower) => {
      const followerId = typeof follower === 'string' ? follower : (follower.id ?? '');

      return followerId === this.currentUserId;
    });
  }

  private refreshContractActivity(): void {
    if (!this.contract || !this.contractId) {
      return;
    }

    this.galpSolarContractService.getById(this.contractId).subscribe({
      next: (latestContract) => {
        if (!this.contract || latestContract.id !== this.contractId) {
          return;
        }

        const activityUpdate = mergeContractActivitySocketPayload(this.contract, {
          fluxo: latestContract.fluxo,
          tickets: latestContract.tickets,
        });

        if (activityUpdate.updated) {
          this.contract = activityUpdate.contract;
        }
      },
    });
  }

  private getSocketEventUserId(event: unknown): string {
    const socketEvent = event as {
      updatedBy?: string;
      userId?: string;
      updatedByUserId?: string;
    };

    return socketEvent.updatedBy ?? socketEvent.userId ?? socketEvent.updatedByUserId ?? '';
  }

  private synchronizeExternalUpdate(currentTime: string): void {
    const observationDraft = this.observationDraft;
    const internalObservationDraft = this.internalObservationDraft;

    this.galpSolarContractService.getById(this.contractId).subscribe({
      next: (latestContract) => {
        const result = this.mergeExternalContract(latestContract);

        this.contract = latestContract;
        this.observationDraft = observationDraft;
        this.internalObservationDraft = internalObservationDraft;

        if (result.conflicts > 0) {
          this.socketMessage =
            `Este contrato foi atualizado por outro utilizador às ${currentTime}. ` +
            `${result.updated} campo(s) não alterado(s) por si foram atualizados automaticamente. ` +
            `${result.conflicts} campo(s) que também estava a editar foram preservados com os seus valores. ` +
            'Os históricos de observações foram sincronizados sem perder os seus rascunhos. ' +
            'Ao guardar, os seus valores nesses campos irão prevalecer.';
          return;
        }

        const observationsMessage = this.canAccessInternalObservations
          ? 'incluindo os históricos de observações e observações internas, bem como os anexos'
          : 'incluindo o histórico de observações e os anexos';

        this.socketMessage =
          `Este contrato foi atualizado por outro utilizador às ${currentTime}. ` +
          `${result.updated} campo(s) não alterado(s) por si foram atualizados automaticamente, ` +
          `${observationsMessage}, sem perder os seus rascunhos nem os ficheiros selecionados.`;
      },
      error: () => {
        this.socketMessage =
          `Este contrato foi atualizado por outro utilizador às ${currentTime}, ` +
          'mas não foi possível sincronizar os dados automaticamente. ' +
          'Atualize a página antes de guardar para garantir que trabalha sobre a versão mais recente.';
      },
    });
  }

  private mergeExternalContract(latestContract: GalpSolarContract): {
    updated: number;
    conflicts: number;
  } {
    const latestForm = this.buildEditableState(latestContract);
    const nextEditForm = structuredClone(this.editForm);
    const nextOriginalForm = structuredClone(this.originalEditForm);

    let updated = 0;
    let conflicts = 0;

    const keys = Object.keys(latestForm) as Array<keyof EditableContractForm>;

    keys.forEach((key) => {
      const currentValue = this.editForm[key];
      const originalValue = this.originalEditForm[key];
      const latestValue = latestForm[key];

      const userChanged = !this.areValuesEqual(currentValue, originalValue);
      const serverChanged = !this.areValuesEqual(latestValue, originalValue);

      if (!serverChanged) {
        return;
      }

      if (!userChanged) {
        this.setFormValue(nextEditForm, key, latestValue);
        updated += 1;
      } else if (!this.areValuesEqual(currentValue, latestValue)) {
        conflicts += 1;
      }

      this.setFormValue(nextOriginalForm, key, latestValue);
    });

    this.editForm = nextEditForm;
    this.originalEditForm = nextOriginalForm;

    return { updated, conflicts };
  }

  private areValuesEqual(firstValue: unknown, secondValue: unknown): boolean {
    return (
      JSON.stringify(this.normalizeValue(firstValue)) ===
      JSON.stringify(this.normalizeValue(secondValue))
    );
  }

  private setFormValue<Key extends keyof EditableContractForm>(
    form: EditableContractForm,
    key: Key,
    value: EditableContractForm[Key],
  ): void {
    form[key] = value;
  }

  private prepareOwnSocketSuppression(): void {
    this.clearOwnSocketSuppression();
    this.suppressNextOwnSocketUpdate = true;

    this.ownSocketSuppressionTimer = setTimeout(() => {
      this.clearOwnSocketSuppression();
    }, 10000);
  }

  private clearOwnSocketSuppression(): void {
    this.suppressNextOwnSocketUpdate = false;

    if (this.ownSocketSuppressionTimer) {
      clearTimeout(this.ownSocketSuppressionTimer);
      this.ownSocketSuppressionTimer = null;
    }
  }

  private initializeEditForm(contract: GalpSolarContract): void {
    const form = this.buildEditableState(contract);
    this.editForm = structuredClone(form);
    this.originalEditForm = structuredClone(form);
  }

  private buildEditableState(contract: GalpSolarContract): EditableContractForm {
    return {
      nomeClienteEmpresa: contract.nomeClienteEmpresa ?? '',
      nif: contract.nif ?? null,
      telefone: contract.telefone ?? null,
      email: contract.email ?? '',
      cae: contract.cae ?? '',
      crc: contract.crc ?? '',

      tipoSegmento: contract.tipoSegmento ?? '',
      tipoProduto: contract.tipoProduto ?? '',
      contratacao: contract.contratacao ?? '',
      numeroLead: contract.numeroLead ?? '',
      offer: contract.offer ?? '',

      controleQualidade: contract.controleQualidade ?? '',
      codigoRegistoCE: contract.codigoRegistoCE ?? '',
      nomeRegistoCE: contract.nomeRegistoCE ?? '',
      estado: contract.estado,

      agendamento: this.toDateTimeLocal(contract.agendamento),
      dataAssinatura: this.toDateInput(contract.dataAssinatura),
      dataContrato: this.toDateInput(contract.dataContrato),
      dataRegisto: this.toDateInput(contract.dataRegisto),
      dataPrevistaInstalacao: this.toDateInput(contract.dataPrevistaInstalacao),
      dataInstalacao: this.toDateInput(contract.dataInstalacao),
      dataAtivacao: this.toDateInput(contract.dataAtivacao),
      dataBaixa: this.toDateInput(contract.dataBaixa),

      moradaInstalacao: contract.moradaInstalacao ?? '',
      moradaFaturacao: contract.moradaFaturacao ?? '',

      faturaEletronica: Boolean(contract.faturaEletronica),
      debitoDireto: Boolean(contract.debitoDireto),
      nib: contract.nib ?? '',

      tipoPainel: contract.tipoPainel ?? '',
      microinversor: Boolean(contract.microinversor),
      baterias: Boolean(contract.baterias),
      numeroPaineisSolares: contract.numeroPaineisSolares ?? 1,
      metodoPagamento: contract.metodoPagamento ?? '',
    };
  }

  private buildPatchPayload(): UpdateGalpSolarContractRequest {
    const payload: UpdateGalpSolarContractRequest = {};

    this.assignChangedValue(
      payload,
      'nomeClienteEmpresa',
      this.editForm.nomeClienteEmpresa,
      this.originalEditForm.nomeClienteEmpresa,
    );
    this.assignChangedValue(
      payload,
      'telefone',
      this.editForm.telefone,
      this.originalEditForm.telefone,
    );
    this.assignChangedValue(payload, 'email', this.editForm.email, this.originalEditForm.email);
    this.assignChangedValue(payload, 'cae', this.editForm.cae, this.originalEditForm.cae);
    this.assignChangedValue(payload, 'crc', this.editForm.crc, this.originalEditForm.crc);
    this.assignChangedValue(
      payload,
      'tipoSegmento',
      this.editForm.tipoSegmento,
      this.originalEditForm.tipoSegmento,
    );
    this.assignChangedValue(
      payload,
      'tipoProduto',
      this.editForm.tipoProduto,
      this.originalEditForm.tipoProduto,
    );
    this.assignChangedValue(
      payload,
      'contratacao',
      this.editForm.contratacao,
      this.originalEditForm.contratacao,
    );
    this.assignChangedValue(
      payload,
      'numeroLead',
      this.editForm.numeroLead,
      this.originalEditForm.numeroLead,
    );
    this.assignChangedValue(payload, 'offer', this.editForm.offer, this.originalEditForm.offer);

    if (this.canManageQualityControl()) {
      this.assignChangedValue(
        payload,
        'controleQualidade',
        this.editForm.controleQualidade,
        this.originalEditForm.controleQualidade,
      );
    }
    this.assignChangedValue(
      payload,
      'codigoRegistoCE',
      this.editForm.codigoRegistoCE,
      this.originalEditForm.codigoRegistoCE,
    );
    this.assignChangedValue(
      payload,
      'nomeRegistoCE',
      this.editForm.nomeRegistoCE,
      this.originalEditForm.nomeRegistoCE,
    );
    this.assignChangedValue(payload, 'estado', this.editForm.estado, this.originalEditForm.estado);
    this.assignChangedValue(
      payload,
      'agendamento',
      this.editForm.agendamento,
      this.originalEditForm.agendamento,
    );
    this.assignChangedValue(
      payload,
      'dataAssinatura',
      this.editForm.dataAssinatura,
      this.originalEditForm.dataAssinatura,
    );
    this.assignChangedValue(
      payload,
      'dataContrato',
      this.editForm.dataContrato,
      this.originalEditForm.dataContrato,
    );
    this.assignChangedValue(
      payload,
      'dataRegisto',
      this.editForm.dataRegisto,
      this.originalEditForm.dataRegisto,
    );
    this.assignChangedValue(
      payload,
      'dataPrevistaInstalacao',
      this.editForm.dataPrevistaInstalacao,
      this.originalEditForm.dataPrevistaInstalacao,
    );
    this.assignChangedValue(
      payload,
      'dataInstalacao',
      this.editForm.dataInstalacao,
      this.originalEditForm.dataInstalacao,
    );
    this.assignChangedValue(
      payload,
      'dataAtivacao',
      this.editForm.dataAtivacao,
      this.originalEditForm.dataAtivacao,
    );
    this.assignChangedValue(
      payload,
      'dataBaixa',
      this.editForm.dataBaixa,
      this.originalEditForm.dataBaixa,
    );
    this.assignChangedValue(
      payload,
      'moradaInstalacao',
      this.editForm.moradaInstalacao,
      this.originalEditForm.moradaInstalacao,
    );
    this.assignChangedValue(
      payload,
      'moradaFaturacao',
      this.editForm.moradaFaturacao,
      this.originalEditForm.moradaFaturacao,
    );
    this.assignChangedValue(
      payload,
      'faturaEletronica',
      this.editForm.faturaEletronica,
      this.originalEditForm.faturaEletronica,
    );
    this.assignChangedValue(
      payload,
      'debitoDireto',
      this.editForm.debitoDireto,
      this.originalEditForm.debitoDireto,
    );
    this.assignChangedValue(payload, 'nib', this.editForm.nib, this.originalEditForm.nib);
    this.assignChangedValue(
      payload,
      'tipoPainel',
      this.editForm.tipoPainel,
      this.originalEditForm.tipoPainel,
    );
    this.assignChangedValue(
      payload,
      'microinversor',
      this.editForm.microinversor,
      this.originalEditForm.microinversor,
    );
    this.assignChangedValue(
      payload,
      'baterias',
      this.editForm.baterias,
      this.originalEditForm.baterias,
    );
    this.assignChangedValue(
      payload,
      'numeroPaineisSolares',
      Number(this.editForm.numeroPaineisSolares),
      Number(this.originalEditForm.numeroPaineisSolares),
    );
    this.assignChangedValue(
      payload,
      'metodoPagamento',
      this.editForm.metodoPagamento,
      this.originalEditForm.metodoPagamento,
    );
    return payload;
  }

  private assignChangedValue<Key extends keyof UpdateGalpSolarContractRequest>(
    payload: UpdateGalpSolarContractRequest,
    key: Key,
    currentValue: UpdateGalpSolarContractRequest[Key],
    originalValue: UpdateGalpSolarContractRequest[Key],
  ): void {
    const normalizedCurrent = this.normalizeValue(currentValue);
    const normalizedOriginal = this.normalizeValue(originalValue);

    if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedOriginal)) {
      payload[key] = normalizedCurrent as UpdateGalpSolarContractRequest[Key];
    }
  }

  private normalizeValue(value: unknown): unknown {
    return typeof value === 'string' ? value.trim() : value;
  }

  private toDateInput(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 10);
    }

    return date.toISOString().slice(0, 10);
  }

  private toDateTimeLocal(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 16);
    }

    const timezoneOffset = date.getTimezoneOffset() * 60_000;

    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
  }

  private buildEmptyEditForm(): EditableContractForm {
    return {
      nomeClienteEmpresa: '',
      nif: null,
      telefone: null,
      email: '',
      cae: '',
      crc: '',

      tipoSegmento: '',
      tipoProduto: 'Solar',
      contratacao: '',
      numeroLead: '',
      offer: '',

      controleQualidade: '',
      codigoRegistoCE: '',
      nomeRegistoCE: '',
      estado: 'Pedido de Proposta',

      agendamento: '',
      dataAssinatura: '',
      dataContrato: '',
      dataRegisto: '',
      dataPrevistaInstalacao: '',
      dataInstalacao: '',
      dataAtivacao: '',
      dataBaixa: '',

      moradaInstalacao: '',
      moradaFaturacao: '',

      faturaEletronica: false,
      debitoDireto: false,
      nib: '',

      tipoPainel: '',
      microinversor: false,
      baterias: false,
      numeroPaineisSolares: 1,
      metodoPagamento: '',
    };
  }

  private buildCollapsedSections(value: boolean) {
    return {
      client: value,
      contract: value,
      status: value,
      billing: value,
      solar: value,
      attachments: value,
      observations: value,
      internalObservations: value,
    };
  }

  private showSuccess(message: string): void {
    this.successMessage = message;

    setTimeout(() => {
      if (this.successMessage === message) {
        this.successMessage = '';
      }
    }, 5000);
  }

  private showError(message: string): void {
    this.errorMessage = message;

    setTimeout(() => {
      if (this.errorMessage === message) {
        this.errorMessage = '';
      }
    }, 5000);
  }
}
