import {
  canManageQualityControl as canManageQualityControlRole,
  QUALITY_CONTROL_BACKOFFICE_OPTIONS,
} from '../../../core/config/quality-control';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, map, of, switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';

import { ELECTRICITY_POWERS, GAS_LEVELS } from '../../../core/constants/energy';
import { getContractEnergyValidationError } from '../../../core/utils/contract-energy-validation';
import { getContractFormValidationError } from '../../../core/utils/contract-field-formatting';
import { appendObservationHistory } from '../../../core/utils/observation-history';

import {
  mergeContractActivitySocketPayload,
  mergeContractStateSocketPayload,
  preserveContractActivity,
} from '../../../core/models/contract-activity';
import { Auth } from '../../../core/services/auth';
import { FileAccessService } from '../../../core/services/file-access';
import { Campaign, CampaignService } from '../../../core/services/campaign';
import {
  GALP_POWER_GAS_STATUSES,
  GalpPowerGasContractDetail as GalpPowerGasContractDetailModel,
  GalpPowerGasContractDocument,
  GalpPowerGasContractService,
  GalpPowerGasContractStatus,
  UpdateGalpPowerGasContractRequest,
} from '../../../core/services/galp-power-gas-contract';
import { PreferencesService } from '../../../core/services/preferences';
import { SocketService } from '../../../core/services/socket';
import { ProfileUser, UserService } from '../../../core/services/user';

type CampaignSelectionMode = 'existing' | 'other';

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
  tipoContratacaoLuz: string;
  tipoContratacaoGas: string;

  controleQualidade: string;
  codigoRegistoCE: string;
  nomeRegistoCE: string;
  estado: GalpPowerGasContractStatus;

  agendamento: string;
  dataAssinatura: string;
  dataContrato: string;
  dataRegisto: string;
  dataAtivacaoCPE: string;
  dataBaixaCPE: string;
  dataAtivacaoCUI: string;
  dataBaixaCUI: string;

  moradaInstalacao: string;
  moradaFaturacao: string;

  faturaEletronica: boolean;
  sva: boolean;
  debitoDireto: boolean;
  iban: string;

  antigaComercializadora: string;
  cpe: string;
  cui: string;
  potencia: string | number | null;
  escalao: number | null;
  cicloHorario: string;
  nivelTensao: string;

  campaignId: string;
  customCampaign: string;
}

interface AuthenticatedUserLike {
  id?: string;
  _id?: string;
  role?: string;
  name?: string;
  username?: string;
}

interface GalpPowerGasContractApiShape extends GalpPowerGasContractDetailModel {
  campanha?: string | null;
}
import {
  ANTIGA_COMERCIALIZADORA_SUGGESTIONS,
  DEFAULT_CPE_PREFIX,
  DEFAULT_CUI_PREFIX,
} from '../../../core/constants/contract-energy-options';
import { ContractActivityPanel } from '../../../shared/components/contract-activity-panel/contract-activity-panel';
import { ObservationsThread } from '../../../shared/components/observations-thread/observations-thread';

import { VisibleAttachmentsPipe } from '../../../shared/pipes/visible-attachments.pipe';
import { ContractFieldMaskDirective } from '../../../shared/directives/contract-field-mask.directive';
import { FileDropzone } from '../../../shared/components/file-dropzone/file-dropzone';

@Component({
  selector: 'app-galp-power-gas-contract-detail',
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
  templateUrl: './galp-power-gas-contract-detail.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './galp-power-gas-contract-detail.scss',
})
export class GalpPowerGasContractDetail implements OnInit {
  readonly qualityControlBackofficeOptions = QUALITY_CONTROL_BACKOFFICE_OPTIONS;
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(Auth);
  private readonly fileAccess = inject(FileAccessService);
  private readonly campaignService = inject(CampaignService);
  private readonly galpPowerGasContractService = inject(GalpPowerGasContractService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly socketService = inject(SocketService);
  private readonly userService = inject(UserService);

  private currentUserId = '';
  currentUserName = '';
  private suppressNextOwnSocketUpdate = false;
  private ownSocketSuppressionTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly router = inject(Router);

  contract: GalpPowerGasContractDetailModel | null = null;
  campaigns: Campaign[] = [];

  observationDraft = '';
  internalObservationDraft = '';
  isSubmittingObservation = false;
  isSubmittingInternalObservation = false;
  selectedFiles: File[] = [];
  deletingAttachmentFileNames = new Set<string>();

  editForm = this.buildEmptyEditForm();
  originalEditForm = this.buildEmptyEditForm();

  campaignSelectionMode: CampaignSelectionMode = 'existing';
  originalCampaignSelectionMode: CampaignSelectionMode = 'existing';

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

  readonly tipoProdutoOptions = ['Luz', 'Luz + Gás', 'Gás'];

  readonly contratacaoOptions = ['Contratação Papel', 'Contratação Digital'];

  readonly tipoContratacaoOptions = [
    'Mudança de Comercializadora',
    'Mudança de Comercializadora & AT',
    'Entrada Direta',
  ];

  readonly estadoOptions: readonly GalpPowerGasContractStatus[] = GALP_POWER_GAS_STATUSES;

  readonly cicloHorarioOptions = [
    'Simples',
    'Bi-Horário Diário',
    'Bi-Horário Semanal',
    'Tri-Horário Diário',
    'Tri-Horário Semanal',
    'Tetra-Horário',
  ];

  readonly nivelTensaoOptions = ['Monofásico', 'Trifásico'];

  readonly powerSuggestions = ELECTRICITY_POWERS.map((power) => power.toFixed(2));

  readonly gasLevelSuggestions = GAS_LEVELS;

  readonly antigaComercializadoraSuggestions = ANTIGA_COMERCIALIZADORA_SUGGESTIONS;

  ngOnInit(): void {
    this.resolvePermissions();

    const collapseByDefault =
      this.preferencesService.getPreferences().contractDetailsCollapsedByDefault;

    this.collapsedSections = this.buildCollapsedSections(collapseByDefault);

    this.route.paramMap.subscribe((params) => {
      this.contractId = params.get('id') ?? '';

      if (this.contractId) {
        this.loadContract(this.contractId);
      }
    });

    this.socketService.listenGalpPowerGasContractUpdated().subscribe((event) => {
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

      const stateUpdate = mergeContractStateSocketPayload(this.contract, event, this.estadoOptions);

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

      this.loadContract(this.contractId);
    });
  }

  loadContract(contractId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.galpPowerGasContractService
      .getGalpPowerGasContractById(contractId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
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
          this.loadCampaigns(contract.companyId);
        },
        error: () => {
          this.showError('Não foi possível carregar o contrato Galp Power & Gás.');
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

    this.galpPowerGasContractService
      .updateGalpPowerGasContract(this.contractId, payload)
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

    this.selectedFiles = [];
    this.isEditing = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  shouldShowLuzFields(): boolean {
    const product = this.isEditing ? this.editForm.tipoProduto : this.contract?.tipoProduto;

    return product === 'Luz' || product === 'Luz + Gás';
  }

  shouldShowGasFields(): boolean {
    const product = this.isEditing ? this.editForm.tipoProduto : this.contract?.tipoProduto;

    return product === 'Gás' || product === 'Luz + Gás';
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

    const energyValidationError = getContractEnergyValidationError({
      requiresElectricity: this.shouldShowLuzFields(),
      requiresGas: this.shouldShowGasFields(),
      cpe: this.editForm.cpe,
      cui: this.editForm.cui,
      potencia: this.editForm.potencia,
      escalao: this.editForm.escalao,
      cicloHorario: this.editForm.cicloHorario,
    });

    if (energyValidationError) {
      this.showError(energyValidationError);
      return;
    }

    const campaignValue = this.getCurrentCampaignValue();

    if (!campaignValue) {
      this.showError(
        this.campaignSelectionMode === 'other'
          ? 'O nome da campanha é obrigatório.'
          : 'É obrigatório selecionar uma campanha.',
      );
      return;
    }

    const fieldValidationError = getContractFormValidationError(
      this.editForm as unknown as Record<string, unknown>,
      {
        validateCpe: this.shouldShowLuzFields(),
        validateCui: this.shouldShowGasFields(),
      },
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
      ? this.galpPowerGasContractService.updateGalpPowerGasContract(this.contractId, payload)
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

          return this.galpPowerGasContractService
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
          const normalizedContract = this.normalizeContractResponse(updatedContract);

          this.contract = normalizedContract;
          this.initializeEditForm(normalizedContract);
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
              : 'Contrato atualizado com sucesso.',
          );
        },
        error: (error) => {
          this.clearOwnSocketSuppression();
          this.showError(
            error?.error?.details?.join(' ') ||
              error?.error?.message ||
              'Não foi possível atualizar o contrato Galp Power & Gás.',
          );
        },
      });
  }

  onCampaignModeChange(): void {
    if (this.campaignSelectionMode === 'other') {
      this.editForm.campaignId = '';
      return;
    }

    this.editForm.customCampaign = '';
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];

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

  deleteAttachment(document: GalpPowerGasContractDocument): void {
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
      documentos: previousContract.documentos.filter(
        (existingDocument) => existingDocument.fileName !== document.fileName,
      ),
    };

    this.errorMessage = '';
    this.successMessage = '';
    this.prepareOwnSocketSuppression();

    this.galpPowerGasContractService
      .deleteAttachment(this.contractId, document.fileName)
      .pipe(
        finalize(() => {
          this.deletingAttachmentFileNames.delete(document.fileName);
          this.deletingAttachmentFileNames = new Set(this.deletingAttachmentFileNames);
        }),
      )
      .subscribe({
        next: (updatedContract) => {
          this.contract = this.normalizeContractResponse(updatedContract);
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

  isDeletingAttachment(document: GalpPowerGasContractDocument): boolean {
    return this.deletingAttachmentFileNames.has(document.fileName);
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
              teams?: Array<{
                id?: string;
              }>;
            }
          ).teams
            ?.map((team) => team.id ?? '')
            .filter(Boolean) ?? [];

        const authorizedTeamIds = [environment.EQUIPA_CRM_ID, environment.EQUIPA_DU_ID].filter(
          (teamId): teamId is string => Boolean(teamId),
        );

        this.canAccessInternalObservations = teamIds.some((teamId) =>
          authorizedTeamIds.includes(teamId),
        );

        if (!this.canAccessInternalObservations) {
          this.internalObservationDraft = '';
        }
      },
    });
  }

  private refreshContractActivity(): void {
    if (!this.contract || !this.contractId) {
      return;
    }

    this.galpPowerGasContractService.getGalpPowerGasContractById(this.contractId).subscribe({
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
    /*
     * Os dois campos de observações funcionam exatamente
     * da mesma forma durante uma atualização por socket:
     *
     * - o histórico vem novamente do backend;
     * - o rascunho local não é alterado;
     * - ao guardar, o rascunho é acrescentado ao histórico
     *   mais recente recebido do servidor.
     */
    const observationDraft = this.observationDraft;

    const internalObservationDraft = this.internalObservationDraft;

    this.galpPowerGasContractService.getGalpPowerGasContractById(this.contractId).subscribe({
      next: (latestContract) => {
        const normalizedContract = this.normalizeContractResponse(latestContract);

        const result = this.mergeExternalContract(normalizedContract);

        /*
         * Atualiza o histórico normal e o histórico
         * interno porque ambos pertencem ao contract,
         * e não ao editForm.
         */
        this.contract = normalizedContract;

        /*
         * Preserva explicitamente os dois rascunhos.
         * Desta forma um socket nunca apaga aquilo que
         * o utilizador está a escrever.
         */
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

  private mergeExternalContract(latestContract: GalpPowerGasContractDetailModel): {
    updated: number;
    conflicts: number;
  } {
    const latestState = this.buildEditableState(latestContract);
    const nextEditForm = structuredClone(this.editForm);
    const nextOriginalForm = structuredClone(this.originalEditForm);

    let updated = 0;
    let conflicts = 0;

    const campaignKeys: Array<keyof EditableContractForm> = ['campaignId', 'customCampaign'];

    const keys = Object.keys(latestState.form) as Array<keyof EditableContractForm>;

    keys.forEach((key) => {
      if (campaignKeys.includes(key)) {
        return;
      }

      const currentValue = this.editForm[key];
      const originalValue = this.originalEditForm[key];
      const latestValue = latestState.form[key];

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

    const currentCampaign = this.getCampaignSnapshot(this.campaignSelectionMode, this.editForm);
    const originalCampaign = this.getCampaignSnapshot(
      this.originalCampaignSelectionMode,
      this.originalEditForm,
    );
    const latestCampaign = this.getCampaignSnapshot(latestState.campaignMode, latestState.form);

    const userChangedCampaign = !this.areValuesEqual(currentCampaign, originalCampaign);
    const serverChangedCampaign = !this.areValuesEqual(latestCampaign, originalCampaign);

    if (serverChangedCampaign) {
      if (!userChangedCampaign) {
        this.campaignSelectionMode = latestState.campaignMode;
        nextEditForm.campaignId = latestState.form.campaignId;
        nextEditForm.customCampaign = latestState.form.customCampaign;
        updated += 1;
      } else if (!this.areValuesEqual(currentCampaign, latestCampaign)) {
        conflicts += 1;
      }

      this.originalCampaignSelectionMode = latestState.campaignMode;
      nextOriginalForm.campaignId = latestState.form.campaignId;
      nextOriginalForm.customCampaign = latestState.form.customCampaign;
    }

    this.editForm = nextEditForm;
    this.originalEditForm = nextOriginalForm;

    return { updated, conflicts };
  }

  private getCampaignSnapshot(
    mode: CampaignSelectionMode,
    form: EditableContractForm,
  ): {
    mode: CampaignSelectionMode;
    value: string;
  } {
    return {
      mode,
      value: mode === 'other' ? form.customCampaign.trim() : form.campaignId,
    };
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

  private loadCampaigns(companyId: string): void {
    this.campaignService
      .getCampaignsByCompanyId(companyId)
      .pipe(
        map((campaigns) => {
          const assignedCampaign = this.contract?.campaign;
          const assignedId = assignedCampaign?.id ?? '';
          const assignedName = this.normalizeCampaignName(assignedCampaign?.name ?? '');

          return campaigns.filter((campaign) => {
            const isAssignedById = Boolean(assignedId && campaign.id === assignedId);
            const isAssignedByName = Boolean(
              assignedName && this.normalizeCampaignName(campaign.name) === assignedName,
            );

            return campaign.active || isAssignedById || isAssignedByName;
          });
        }),
      )
      .subscribe({
        next: (campaigns) => {
          this.campaigns = campaigns;

          if (this.contract && !this.isEditing) {
            this.initializeEditForm(this.contract);
          }
        },
        error: () => {
          this.showError('Não foi possível carregar as campanhas.');
        },
      });
  }

  private hasContractAccess(contract: GalpPowerGasContractDetailModel): boolean {
    if (this.isSuperAdmin) {
      return true;
    }

    return (contract.followers ?? []).some((follower: any) => {
      const followerId =
        typeof follower === 'string'
          ? follower
          : (follower.id ?? follower._id ?? follower.userId ?? '');

      return followerId === this.currentUserId;
    });
  }

  private normalizeContractResponse(
    contract: GalpPowerGasContractDetailModel,
  ): GalpPowerGasContractDetailModel {
    contract = preserveContractActivity(contract, this.contract);

    const apiContract = contract as GalpPowerGasContractApiShape;
    const rawCampaign = apiContract.campanha?.trim() ?? '';

    if (!rawCampaign) {
      return contract;
    }

    if (!rawCampaign.startsWith('cam_')) {
      return {
        ...contract,
        campaign: {
          id: null,
          name: rawCampaign,
        },
      };
    }

    const matchedCampaign = this.campaigns.find((campaign) => campaign.id === rawCampaign);

    const currentCampaign =
      this.contract?.campaign?.id === rawCampaign ? this.contract.campaign : null;

    return {
      ...contract,
      campaign: {
        id: rawCampaign,
        name: matchedCampaign?.name ?? currentCampaign?.name ?? rawCampaign,
      },
    };
  }

  private initializeEditForm(contract: GalpPowerGasContractDetailModel): void {
    const state = this.buildEditableState(contract);

    this.editForm = structuredClone(state.form);
    this.originalEditForm = structuredClone(state.form);
    this.campaignSelectionMode = state.campaignMode;
    this.originalCampaignSelectionMode = state.campaignMode;
  }

  private buildEditableState(contract: GalpPowerGasContractDetailModel): {
    form: EditableContractForm;
    campaignMode: CampaignSelectionMode;
  } {
    const campaign = contract.campaign;
    const resolvedCampaign = this.resolveCampaignSelection(campaign);

    return {
      campaignMode: resolvedCampaign.mode,
      form: {
        nomeClienteEmpresa: contract.nomeClienteEmpresa ?? '',
        nif: contract.nif ?? null,
        telefone: contract.telefone ?? null,
        email: contract.email ?? '',
        cae: contract.cae ?? '',
        crc: contract.crc ?? '',

        tipoSegmento: contract.tipoSegmento ?? '',
        tipoProduto: contract.tipoProduto ?? '',
        contratacao: contract.contratacao ?? '',
        tipoContratacaoLuz: contract.tipoContratacaoLuz ?? '',
        tipoContratacaoGas: contract.tipoContratacaoGas ?? '',

        controleQualidade: contract.controleQualidade ?? '',
        codigoRegistoCE: contract.codigoRegistoCE ?? '',
        nomeRegistoCE: contract.nomeRegistoCE ?? '',
        estado: contract.estado,

        agendamento: this.toDateTimeLocal(contract.agendamento),
        dataAssinatura: this.toDateInput(contract.dataAssinatura),
        dataContrato: this.toDateInput(contract.dataContrato),
        dataRegisto: this.toDateInput(contract.dataRegisto),
        dataAtivacaoCPE: this.toDateInput(contract.dataAtivacaoCPE),
        dataBaixaCPE: this.toDateInput(contract.dataBaixaCPE),
        dataAtivacaoCUI: this.toDateInput(contract.dataAtivacaoCUI),
        dataBaixaCUI: this.toDateInput(contract.dataBaixaCUI),

        moradaInstalacao: contract.moradaInstalacao ?? '',
        moradaFaturacao: contract.moradaFaturacao ?? '',

        faturaEletronica: Boolean(contract.faturaEletronica),
        sva: Boolean(contract.sva),
        debitoDireto: Boolean(contract.debitoDireto),
        iban: contract.iban ?? '',

        antigaComercializadora: contract.antigaComercializadora ?? '',
        cpe: contract.cpe?.trim() || DEFAULT_CPE_PREFIX,
        cui: contract.cui?.trim() || DEFAULT_CUI_PREFIX,
        potencia: contract.potencia ?? null,
        escalao: contract.escalao ?? null,
        cicloHorario: contract.cicloHorario ?? '',
        nivelTensao: contract.nivelTensao ?? '',

        campaignId: resolvedCampaign.campaignId,
        customCampaign: resolvedCampaign.customCampaign,
      },
    };
  }

  private resolveCampaignSelection(campaign: GalpPowerGasContractDetailModel['campaign']): {
    mode: CampaignSelectionMode;
    campaignId: string;
    customCampaign: string;
  } {
    if (!campaign) {
      return {
        mode: 'existing',
        campaignId: '',
        customCampaign: '',
      };
    }

    const campaignId = campaign.id?.trim() ?? '';
    const normalizedName = this.normalizeCampaignName(campaign.name);

    const campaignById = campaignId
      ? this.campaigns.find((availableCampaign) => availableCampaign.id === campaignId)
      : undefined;

    const campaignByName = normalizedName
      ? this.campaigns.find(
          (availableCampaign) =>
            this.normalizeCampaignName(availableCampaign.name) === normalizedName,
        )
      : undefined;

    const existingCampaign = campaignById ?? campaignByName;

    if (existingCampaign) {
      return {
        mode: 'existing',
        campaignId: existingCampaign.id,
        customCampaign: '',
      };
    }

    if (campaignId) {
      return {
        mode: 'existing',
        campaignId,
        customCampaign: '',
      };
    }

    return {
      mode: 'other',
      campaignId: '',
      customCampaign: campaign.name?.trim() ?? '',
    };
  }

  private normalizeCampaignName(value: string): string {
    return value
      .trim()
      .toLocaleLowerCase('pt-PT')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private buildPatchPayload(): UpdateGalpPowerGasContractRequest {
    const payload: UpdateGalpPowerGasContractRequest = {};

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
      'tipoContratacaoLuz',
      this.editForm.tipoContratacaoLuz,
      this.originalEditForm.tipoContratacaoLuz,
    );
    this.assignChangedValue(
      payload,
      'tipoContratacaoGas',
      this.editForm.tipoContratacaoGas,
      this.originalEditForm.tipoContratacaoGas,
    );

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
      'dataAtivacaoCPE',
      this.editForm.dataAtivacaoCPE,
      this.originalEditForm.dataAtivacaoCPE,
    );
    this.assignChangedValue(
      payload,
      'dataBaixaCPE',
      this.editForm.dataBaixaCPE,
      this.originalEditForm.dataBaixaCPE,
    );
    this.assignChangedValue(
      payload,
      'dataAtivacaoCUI',
      this.editForm.dataAtivacaoCUI,
      this.originalEditForm.dataAtivacaoCUI,
    );
    this.assignChangedValue(
      payload,
      'dataBaixaCUI',
      this.editForm.dataBaixaCUI,
      this.originalEditForm.dataBaixaCUI,
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
    this.assignChangedValue(payload, 'sva', this.editForm.sva, this.originalEditForm.sva);
    this.assignChangedValue(
      payload,
      'debitoDireto',
      this.editForm.debitoDireto,
      this.originalEditForm.debitoDireto,
    );
    this.assignChangedValue(payload, 'iban', this.editForm.iban, this.originalEditForm.iban);
    this.assignChangedValue(
      payload,
      'antigaComercializadora',
      this.editForm.antigaComercializadora,
      this.originalEditForm.antigaComercializadora,
    );
    this.assignChangedValue(payload, 'cpe', this.editForm.cpe, this.originalEditForm.cpe);
    this.assignChangedValue(payload, 'cui', this.editForm.cui, this.originalEditForm.cui);
    this.assignChangedValue(
      payload,
      'potencia',
      this.editForm.potencia,
      this.originalEditForm.potencia,
    );
    this.assignChangedValue(
      payload,
      'escalao',
      this.editForm.escalao,
      this.originalEditForm.escalao,
    );
    this.assignChangedValue(
      payload,
      'cicloHorario',
      this.editForm.cicloHorario,
      this.originalEditForm.cicloHorario,
    );
    this.assignChangedValue(
      payload,
      'nivelTensao',
      this.editForm.nivelTensao,
      this.originalEditForm.nivelTensao,
    );
    const currentCampaign = this.getCurrentCampaignValue();
    const originalCampaign = this.getOriginalCampaignValue();

    if (currentCampaign !== originalCampaign) {
      payload.campanha = currentCampaign;
    }

    return payload;
  }

  private assignChangedValue<Key extends keyof UpdateGalpPowerGasContractRequest>(
    payload: UpdateGalpPowerGasContractRequest,
    key: Key,
    currentValue: UpdateGalpPowerGasContractRequest[Key],
    originalValue: UpdateGalpPowerGasContractRequest[Key],
  ): void {
    const normalizedCurrent = this.normalizeValue(currentValue);
    const normalizedOriginal = this.normalizeValue(originalValue);

    if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedOriginal)) {
      payload[key] = normalizedCurrent as UpdateGalpPowerGasContractRequest[Key];
    }
  }

  private getCurrentCampaignValue(): string {
    return this.campaignSelectionMode === 'other'
      ? this.editForm.customCampaign.trim()
      : this.editForm.campaignId;
  }

  private getOriginalCampaignValue(): string {
    return this.originalCampaignSelectionMode === 'other'
      ? this.originalEditForm.customCampaign.trim()
      : this.originalEditForm.campaignId;
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
      tipoProduto: '',
      contratacao: '',
      tipoContratacaoLuz: '',
      tipoContratacaoGas: '',

      controleQualidade: '',
      codigoRegistoCE: '',
      nomeRegistoCE: '',
      estado: 'Pedido de chamada',

      agendamento: '',
      dataAssinatura: '',
      dataContrato: '',
      dataRegisto: '',
      dataAtivacaoCPE: '',
      dataBaixaCPE: '',
      dataAtivacaoCUI: '',
      dataBaixaCUI: '',

      moradaInstalacao: '',
      moradaFaturacao: '',

      faturaEletronica: false,
      sva: false,
      debitoDireto: false,
      iban: '',

      antigaComercializadora: '',
      cpe: '',
      cui: '',
      potencia: null,
      escalao: null,
      cicloHorario: '',
      nivelTensao: '',

      campaignId: '',
      customCampaign: '',
    };
  }

  private buildCollapsedSections(value: boolean) {
    return {
      client: value,
      contract: value,
      status: value,
      billing: value,
      energy: value,
      attachments: value,
      observations: value,
      internalObservations: value,
    };
  }

  toggleSection(section: keyof typeof this.collapsedSections): void {
    this.collapsedSections[section] = !this.collapsedSections[section];
  }

  getStatusClass(status: GalpPowerGasContractStatus): string {
    const classes: Record<GalpPowerGasContractStatus, string> = {
      'Pedido de chamada': 'status-call-request',
      'Em validação': 'status-validation',
      'Não Conformidade': 'status-non-compliance',
      'Documentos Enviados': 'status-docs-sent',
      'Sem Registo': 'status-call-done',
      'Registo Plataforma Galp': 'status-signature',
      'Pendente Docs': 'status-docs',
      'Em ativação': 'status-assigned',
      Ativo: 'status-active',
      'Parcialmente Baixa': 'status-partial-low',
      Cancelado: 'status-cancelled',
      Baixa: 'status-low',
    };

    return classes[status];
  }

  downloadDocument(file: GalpPowerGasContractDocument): void {
    if (!this.fileAccess.canViewFile(file)) {
      this.showError('Não tem permissão para visualizar ficheiros de áudio.');
      return;
    }

    if (!this.contract?.id) {
      return;
    }

    this.galpPowerGasContractService.downloadDocument(this.contract.id, file).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = window.document.createElement('a');

        link.href = url;
        link.download = file.originalName || file.fileName;

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

  formatBoolean(value: boolean): string {
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
    return value || '-';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  getFileIcon(mimetype: string): string {
    if (mimetype.startsWith('audio/')) {
      return '🎧';
    }

    if (mimetype.includes('pdf')) {
      return '📄';
    }

    if (mimetype.includes('word')) {
      return '📝';
    }

    if (mimetype.startsWith('image/')) {
      return '🖼️';
    }

    return '📎';
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
