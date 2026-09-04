import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, map, of, switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Auth } from '../../../core/services/auth';
import {
  Campaign,
  CampaignService,
} from '../../../core/services/campaign';
import {
  IBERDROLA_SOLAR_CONTRACT_STATUSES,
  IBERDROLA_SOLAR_PAYMENT_METHODS,
  IberdrolaSolarContract,
  IberdrolaSolarContractDocument,
  IberdrolaSolarContractService,
  IberdrolaSolarContractStatus,
  IberdrolaSolarContratacao,
  IberdrolaSolarMetodoPagamento,
  IberdrolaSolarTipoProduto,
  IberdrolaSolarTipoSegmento,
  UpdateIberdrolaSolarContractRequest,
} from '../../../core/services/iberdrola-solar-contract';
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

  tipoSegmento: IberdrolaSolarTipoSegmento;
  tipoProduto: IberdrolaSolarTipoProduto;
  contratacao: IberdrolaSolarContratacao;
  numeroLead: string;
  offer: string;

  controleQualidade: string;
  codigoRegistoCE: string;
  nomeRegistoCE: string;
  estado: IberdrolaSolarContractStatus;

  agendamento: string;
  dataAssinatura: string;
  dataContrato: string;
  dataRegisto: string;
  dataInstalacao: string;
  dataAtivacao: string;
  dataBaixa: string;

  moradaInstalacao: string;
  moradaFaturacao: string;

  faturaEletronica: boolean;
  debitoDireto: boolean;
  nib: string;

  microinversor: boolean;
  baterias: boolean;
  numeroPaineisSolares: number;
  metodoPagamento:
    IberdrolaSolarMetodoPagamento;
}

interface IberdrolaSolarContractApiShape
  extends IberdrolaSolarContract {
  campanha?: string | null;
}

interface AuthenticatedUserLike {
  id?: string;
  _id?: string;
  role?: string;
  name?: string;
  username?: string;
}

@Component({
  selector: 'app-iberdrola-solar-contract-detail',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './iberdrola-solar-contract-detail.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './iberdrola-solar-contract-detail.scss',
})
export class IberdrolaSolarContractDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly campaignService =
    inject(CampaignService);
  private readonly iberdrolaSolarContractService = inject(IberdrolaSolarContractService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly socketService = inject(SocketService);
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  private currentUserId = '';
  private currentUserName = '';
  private suppressNextOwnSocketUpdate = false;
  private ownSocketSuppressionTimer: ReturnType<typeof setTimeout> | null = null;

  contract: IberdrolaSolarContract | null = null;

  campaigns: Campaign[] = [];

  observationDraft = '';
  internalObservationDraft = '';
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

  readonly tipoSegmentoOptions:
    IberdrolaSolarTipoSegmento[] = [
      'Residencial',
      'Empresarial',
    ];

  readonly tipoProdutoOptions:
    IberdrolaSolarTipoProduto[] = [
      'Painéis Solares',
    ];

  readonly contratacaoOptions:
    IberdrolaSolarContratacao[] = [
      'Contratação Papel',
      'Contratação Digital',
    ];

  readonly estadoOptions =
    IBERDROLA_SOLAR_CONTRACT_STATUSES;

  readonly paymentMethodOptions:
    readonly IberdrolaSolarMetodoPagamento[] =
      IBERDROLA_SOLAR_PAYMENT_METHODS;

  ngOnInit(): void {
    this.resolvePermissions();

    const collapseByDefault =
      this.preferencesService.getPreferences().contractDetailsCollapsedByDefault;

    this.collapsedSections = this.buildCollapsedSections(collapseByDefault);

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.contractId = params.get('id') ?? '';

        if (this.contractId) {
          this.loadContract(this.contractId);
        }
      });

    this.socketService
      .listenIberdrolaSolarContractUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.contractId !== this.contractId) {
          return;
        }

        const eventUserId = this.getSocketEventUserId(event);

        if (
          eventUserId &&
          this.currentUserId &&
          eventUserId === this.currentUserId
        ) {
          return;
        }

        if (!eventUserId && this.suppressNextOwnSocketUpdate) {
          return;
        }

        const currentTime = new Date().toLocaleTimeString('pt-PT');
        this.lastSocketUpdate = currentTime;

        if (this.isEditing) {
          this.synchronizeExternalUpdate(currentTime);
          return;
        }

        this.socketMessage =
          `Este contrato foi atualizado por outro utilizador às ${currentTime}.`;

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

    this.iberdrolaSolarContractService
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

          const normalizedContract =
            this.normalizeContractResponse(
              contract,
            );

          this.contract =
            normalizedContract;

          this.initializeEditForm(
            normalizedContract,
          );

          this.loadCampaigns(
            normalizedContract.companyId,
          );
        },
        error: () => {
          this.showError('Não foi possível carregar o contrato Iberdrola Solar.');
        },
      });
  }

  startEditing(): void {
    if (!this.isSuperAdmin || !this.contract) {
      return;
    }

    this.initializeEditForm(this.contract);
    this.observationDraft = '';
    this.internalObservationDraft = '';
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

  saveChanges(): void {
    if (!this.isSuperAdmin || !this.contract || !this.contractId) {
      return;
    }

    if (!this.editForm.telefone) {
      this.showError('O telefone é obrigatório.');
      return;
    }


    const numeroPaineis = Number(this.editForm.numeroPaineisSolares);

    if (
      !Number.isFinite(numeroPaineis) ||
      !Number.isInteger(numeroPaineis) ||
      numeroPaineis < 1
    ) {
      this.showError(
        'O número de painéis solares deve ser um número inteiro igual ou superior a 1.',
      );
      return;
    }

    if (!this.editForm.metodoPagamento) {
      this.showError(
        'O método de pagamento é obrigatório.',
      );
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
      ? this.iberdrolaSolarContractService.update(this.contractId, payload)
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

          return this.iberdrolaSolarContractService
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
          this.contract = updatedContract;
          this.initializeEditForm(updatedContract);
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
              : 'Contrato Iberdrola Solar atualizado com sucesso.',
          );
        },
        error: (error) => {
          this.clearOwnSocketSuppression();
          this.showError(
            error?.error?.details?.join(' ') ||
              error?.error?.message ||
              'Não foi possível atualizar o contrato Iberdrola Solar.',
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

    const existingFileKeys = new Set(
      this.selectedFiles.map((file) => this.getFileKey(file)),
    );

    const newFiles = files.filter(
      (file) => !existingFileKeys.has(this.getFileKey(file)),
    );

    this.selectedFiles = [...this.selectedFiles, ...newFiles];
    input.value = '';
  }

  removeSelectedFile(index: number): void {
    this.selectedFiles = this.selectedFiles.filter(
      (_, fileIndex) => fileIndex !== index,
    );
  }

  clearSelectedFiles(): void {
    this.selectedFiles = [];
  }

  deleteAttachment(document: IberdrolaSolarContractDocument): void {
    if (
      !this.isSuperAdmin ||
      !this.isEditing ||
      !this.contract ||
      !this.contractId ||
      this.deletingAttachmentFileNames.has(document.fileName)
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Pretende remover o ficheiro "${document.originalName}"?`,
    );

    if (!confirmed) {
      return;
    }

    const previousContract = this.contract;

    this.deletingAttachmentFileNames.add(document.fileName);
    this.deletingAttachmentFileNames = new Set(
      this.deletingAttachmentFileNames,
    );

    this.contract = {
      ...previousContract,
      documentos: (previousContract.documentos ?? []).filter(
        (existingDocument) =>
          existingDocument.fileName !== document.fileName,
      ),
    };

    this.errorMessage = '';
    this.successMessage = '';
    this.prepareOwnSocketSuppression();

    this.iberdrolaSolarContractService
      .deleteAttachment(this.contractId, document.fileName)
      .pipe(
        finalize(() => {
          this.deletingAttachmentFileNames.delete(document.fileName);
          this.deletingAttachmentFileNames = new Set(
            this.deletingAttachmentFileNames,
          );
        }),
      )
      .subscribe({
        next: (updatedContract) => {
          this.contract = updatedContract;
          this.showSuccess(
            `O ficheiro "${document.originalName}" foi removido com sucesso.`,
          );
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

  isDeletingAttachment(document: IberdrolaSolarContractDocument): boolean {
    return this.deletingAttachmentFileNames.has(document.fileName);
  }

  downloadDocument(document: IberdrolaSolarContractDocument): void {
    if (!this.contract?.id || !document.fileName) {
      return;
    }

    this.iberdrolaSolarContractService
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

  getObservationLines(value: string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    return value
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  toggleSection(section: keyof typeof this.collapsedSections): void {
    this.collapsedSections[section] = !this.collapsedSections[section];
  }

  getStatusClass(
    status:
      IberdrolaSolarContractStatus,
  ): string {
    const classes:
      Record<
        IberdrolaSolarContractStatus,
        string
      > = {
        'Pedido de Proposta':
          'status-proposal-request',
        'Proposta Enviada':
          'status-proposal-sent',
        'Pendente Docs':
          'status-docs',
        'Em instalação':
          'status-installation',
        Cancelado:
          'status-cancelled',
        Ativo:
          'status-active',
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

  formatDateOnly(
    value: string | null | undefined,
  ): string {
    if (!value) {
      return '—';
    }

    const normalized =
      value.slice(0, 10);

    const [year, month, day] =
      normalized.split('-');

    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }

    return value;
  }

  getValue(
    value: string | number | null | undefined,
  ): string | number {
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
    const currentUser =
      this.auth.getCurrentUser() as AuthenticatedUserLike | null;

    const role = currentUser?.role?.toLowerCase() ?? '';

    this.currentUserId = currentUser?.id ?? currentUser?._id ?? '';
    this.currentUserName =
      currentUser?.name ?? currentUser?.username ?? 'Utilizador';
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

        const authorizedTeamIds = [
          environment.EQUIPA_CRM_ID,
          environment.EQUIPA_DU_ID,
        ].filter((teamId): teamId is string => Boolean(teamId));

        this.canAccessInternalObservations =
          this.isSuperAdmin ||
          teamIds.some((teamId) => authorizedTeamIds.includes(teamId));

        if (!this.canAccessInternalObservations) {
          this.internalObservationDraft = '';
        }
      },
    });
  }

  private loadCampaigns(
    companyId: string,
  ): void {
    this.campaignService
      .getCampaignsByCompanyId(
        companyId,
      )
      .pipe(
        map((campaigns) => {
          const assignedCampaign =
            this.contract?.campaign;

          const assignedId =
            assignedCampaign?.id ??
            '';

          const assignedName =
            this.normalizeCampaignName(
              assignedCampaign?.name ??
                '',
            );

          return campaigns.filter(
            (campaign) => {
              const isAssignedById =
                Boolean(
                  assignedId &&
                    campaign.id ===
                      assignedId,
                );

              const isAssignedByName =
                Boolean(
                  assignedName &&
                    this
                      .normalizeCampaignName(
                        campaign.name,
                      ) ===
                      assignedName,
                );

              return (
                campaign.active ||
                isAssignedById ||
                isAssignedByName
              );
            },
          );
        }),
      )
      .subscribe({
        next: (campaigns) => {
          this.campaigns =
            campaigns;

          if (
            this.contract &&
            !this.isEditing
          ) {
            this.contract =
              this.normalizeContractResponse(
                this.contract,
              );

            this.initializeEditForm(
              this.contract,
            );
          }
        },

        error: () => {
          this.showError(
            'Não foi possível carregar as campanhas.',
          );
        },
      });
  }

  private normalizeContractResponse(
    contract:
      IberdrolaSolarContract,
  ): IberdrolaSolarContract {
    const apiContract =
      contract as
        IberdrolaSolarContractApiShape;

    const rawCampaign =
      apiContract.campanha
        ?.trim() ?? '';

    if (!rawCampaign) {
      return contract;
    }

    if (
      !rawCampaign.startsWith(
        'cam_',
      )
    ) {
      return {
        ...contract,
        campaign: {
          id: null,
          name: rawCampaign,
        },
      };
    }

    const matchedCampaign =
      this.campaigns.find(
        (campaign) =>
          campaign.id ===
          rawCampaign,
      );

    return {
      ...contract,
      campaign: {
        id: rawCampaign,
        name:
          matchedCampaign?.name ??
          contract.campaign?.name ??
          rawCampaign,
      },
    };
  }

  private resolveCampaignSelection(
    campaign:
      IberdrolaSolarContract[
        'campaign'
      ],
  ): {
    mode: 'existing' | 'other';
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

    const campaignId =
      campaign.id?.trim() ?? '';

    const normalizedName =
      this.normalizeCampaignName(
        campaign.name,
      );

    const campaignById =
      campaignId
        ? this.campaigns.find(
            (availableCampaign) =>
              availableCampaign.id ===
              campaignId,
          )
        : undefined;

    const campaignByName =
      normalizedName
        ? this.campaigns.find(
            (availableCampaign) =>
              this.normalizeCampaignName(
                availableCampaign.name,
              ) === normalizedName,
          )
        : undefined;

    const existingCampaign =
      campaignById ??
      campaignByName;

    if (existingCampaign) {
      return {
        mode: 'existing',
        campaignId:
          existingCampaign.id,
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
      customCampaign:
        campaign.name.trim(),
    };
  }

  private normalizeCampaignName(
    value: string,
  ): string {
    return value
      .trim()
      .toLocaleLowerCase(
        'pt-PT',
      )
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      );
  }

  private hasContractAccess(contract: IberdrolaSolarContract): boolean {
    if (this.isSuperAdmin) {
      return true;
    }

    return (contract.followers ?? []).some((follower) => {
      const followerId =
        typeof follower === 'string'
          ? follower
          : follower.id ?? '';

      return followerId === this.currentUserId;
    });
  }

  private getSocketEventUserId(event: unknown): string {
    const socketEvent = event as {
      updatedBy?: string;
      userId?: string;
      updatedByUserId?: string;
    };

    return (
      socketEvent.updatedBy ??
      socketEvent.userId ??
      socketEvent.updatedByUserId ??
      ''
    );
  }

  private synchronizeExternalUpdate(currentTime: string): void {
    const observationDraft = this.observationDraft;
    const internalObservationDraft = this.internalObservationDraft;

    this.iberdrolaSolarContractService.getById(this.contractId).subscribe({
      next: (latestContract) => {
        const normalizedContract =
          this.normalizeContractResponse(
            latestContract,
          );

        const result =
          this.mergeExternalContract(
            normalizedContract,
          );

        this.contract =
          normalizedContract;
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

  private mergeExternalContract(
    latestContract: IberdrolaSolarContract,
  ): { updated: number; conflicts: number } {
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

  private initializeEditForm(
    contract: IberdrolaSolarContract,
  ): void {
    const form =
      this.buildEditableState(
        contract,
      );

    this.editForm =
      structuredClone(form);

    this.originalEditForm =
      structuredClone(form);
  }

  private buildEditableState(
    contract: IberdrolaSolarContract,
  ): EditableContractForm {
    const campaign =
      this.resolveCampaignSelection(
        contract.campaign,
      );

    return {
      nomeClienteEmpresa:
        contract.nomeClienteEmpresa ??
        '',
      nif:
        contract.nif ?? null,
      telefone:
        contract.telefone ?? null,
      email:
        contract.email ?? '',
      cae:
        contract.cae ?? '',
      crc:
        contract.crc ?? '',

      tipoSegmento:
        contract.tipoSegmento,
      tipoProduto:
        contract.tipoProduto,
      contratacao:
        contract.contratacao,
      numeroLead:
        contract.numeroLead ?? '',
      offer:
        contract.offer ?? '',

      controleQualidade:
        contract.controleQualidade ??
        '',
      codigoRegistoCE:
        contract.codigoRegistoCE ??
        '',
      nomeRegistoCE:
        contract.nomeRegistoCE ??
        '',
      estado:
        contract.estado,

      agendamento:
        this.toDateTimeLocal(
          contract.agendamento,
        ),
      dataAssinatura:
        this.toDateInput(
          contract.dataAssinatura,
        ),
      dataContrato:
        this.toDateInput(
          contract.dataContrato,
        ),
      dataRegisto:
        this.toDateInput(
          contract.dataRegisto,
        ),
      dataInstalacao:
        this.toDateInput(
          contract.dataInstalacao,
        ),
      dataAtivacao:
        this.toDateInput(
          contract.dataAtivacao,
        ),
      dataBaixa:
        this.toDateInput(
          contract.dataBaixa,
        ),

      moradaInstalacao:
        contract.moradaInstalacao ??
        '',
      moradaFaturacao:
        contract.moradaFaturacao ??
        '',

      faturaEletronica:
        Boolean(
          contract.faturaEletronica,
        ),
      debitoDireto:
        Boolean(
          contract.debitoDireto,
        ),
      nib:
        contract.nib ?? '',

      microinversor:
        Boolean(
          contract.microinversor,
        ),
      baterias:
        Boolean(contract.baterias),
      numeroPaineisSolares:
        contract.numeroPaineisSolares ??
        1,
      metodoPagamento:
        contract.metodoPagamento,
    };
  }


  private buildPatchPayload():
    UpdateIberdrolaSolarContractRequest {
    const payload:
      UpdateIberdrolaSolarContractRequest =
        {};

    this.assignChangedValue(
      payload,
      'nomeClienteEmpresa',
      this.editForm
        .nomeClienteEmpresa,
      this.originalEditForm
        .nomeClienteEmpresa,
    );

    this.assignChangedValue(
      payload,
      'nif',
      this.editForm.nif ??
        undefined,
      this.originalEditForm.nif ??
        undefined,
    );

    this.assignChangedValue(
      payload,
      'telefone',
      this.editForm.telefone ??
        undefined,
      this.originalEditForm.telefone ??
        undefined,
    );

    this.assignChangedValue(
      payload,
      'email',
      this.editForm.email,
      this.originalEditForm.email,
    );

    this.assignChangedValue(
      payload,
      'cae',
      this.editForm.cae,
      this.originalEditForm.cae,
    );

    this.assignChangedValue(
      payload,
      'crc',
      this.editForm.crc,
      this.originalEditForm.crc,
    );

    this.assignChangedValue(
      payload,
      'tipoSegmento',
      this.editForm
        .tipoSegmento,
      this.originalEditForm
        .tipoSegmento,
    );

    this.assignChangedValue(
      payload,
      'contratacao',
      this.editForm
        .contratacao,
      this.originalEditForm
        .contratacao,
    );

    this.assignChangedValue(
      payload,
      'numeroLead',
      this.editForm.numeroLead,
      this.originalEditForm
        .numeroLead,
    );

    this.assignChangedValue(
      payload,
      'offer',
      this.editForm.offer,
      this.originalEditForm.offer,
    );

    this.assignChangedValue(
      payload,
      'controleQualidade',
      this.editForm
        .controleQualidade,
      this.originalEditForm
        .controleQualidade,
    );

    this.assignChangedValue(
      payload,
      'codigoRegistoCE',
      this.editForm
        .codigoRegistoCE,
      this.originalEditForm
        .codigoRegistoCE,
    );

    this.assignChangedValue(
      payload,
      'nomeRegistoCE',
      this.editForm
        .nomeRegistoCE,
      this.originalEditForm
        .nomeRegistoCE,
    );

    this.assignChangedValue(
      payload,
      'estado',
      this.editForm.estado,
      this.originalEditForm.estado,
    );

    this.assignChangedValue(
      payload,
      'agendamento',
      this.editForm.agendamento,
      this.originalEditForm
        .agendamento,
    );

    this.assignChangedValue(
      payload,
      'dataAssinatura',
      this.editForm
        .dataAssinatura,
      this.originalEditForm
        .dataAssinatura,
    );

    this.assignChangedValue(
      payload,
      'dataContrato',
      this.editForm
        .dataContrato,
      this.originalEditForm
        .dataContrato,
    );

    this.assignChangedValue(
      payload,
      'dataRegisto',
      this.editForm.dataRegisto,
      this.originalEditForm
        .dataRegisto,
    );

    this.assignChangedValue(
      payload,
      'dataInstalacao',
      this.editForm
        .dataInstalacao,
      this.originalEditForm
        .dataInstalacao,
    );

    this.assignChangedValue(
      payload,
      'dataAtivacao',
      this.editForm.dataAtivacao,
      this.originalEditForm
        .dataAtivacao,
    );

    this.assignChangedValue(
      payload,
      'dataBaixa',
      this.editForm.dataBaixa,
      this.originalEditForm
        .dataBaixa,
    );

    this.assignChangedValue(
      payload,
      'moradaInstalacao',
      this.editForm
        .moradaInstalacao,
      this.originalEditForm
        .moradaInstalacao,
    );

    this.assignChangedValue(
      payload,
      'moradaFaturacao',
      this.editForm
        .moradaFaturacao,
      this.originalEditForm
        .moradaFaturacao,
    );

    this.assignChangedValue(
      payload,
      'faturaEletronica',
      this.editForm
        .faturaEletronica,
      this.originalEditForm
        .faturaEletronica,
    );

    this.assignChangedValue(
      payload,
      'debitoDireto',
      this.editForm
        .debitoDireto,
      this.originalEditForm
        .debitoDireto,
    );

    this.assignChangedValue(
      payload,
      'nib',
      this.editForm.nib,
      this.originalEditForm.nib,
    );

    this.assignChangedValue(
      payload,
      'microinversor',
      this.editForm
        .microinversor,
      this.originalEditForm
        .microinversor,
    );

    this.assignChangedValue(
      payload,
      'baterias',
      this.editForm.baterias,
      this.originalEditForm
        .baterias,
    );

    this.assignChangedValue(
      payload,
      'numeroPaineisSolares',
      Number(
        this.editForm
          .numeroPaineisSolares,
      ),
      Number(
        this.originalEditForm
          .numeroPaineisSolares,
      ),
    );

    this.assignChangedValue(
      payload,
      'metodoPagamento',
      this.editForm
        .metodoPagamento,
      this.originalEditForm
        .metodoPagamento,
    );

    const observationValue =
      this.buildObservationValue();

    if (
      observationValue !== null
    ) {
      payload.observacoes =
        observationValue;
    }

    const internalObservationValue =
      this.buildInternalObservationValue();

    if (
      this
        .canAccessInternalObservations &&
      internalObservationValue !==
        null
    ) {
      payload.observacoesInternas =
        internalObservationValue;
    }

    return payload;
  }

  private assignChangedValue<
    Key extends keyof UpdateIberdrolaSolarContractRequest,
  >(
    payload: UpdateIberdrolaSolarContractRequest,
    key: Key,
    currentValue: UpdateIberdrolaSolarContractRequest[Key],
    originalValue: UpdateIberdrolaSolarContractRequest[Key],
  ): void {
    const normalizedCurrent = this.normalizeValue(currentValue);
    const normalizedOriginal = this.normalizeValue(originalValue);

    if (
      JSON.stringify(normalizedCurrent) !==
      JSON.stringify(normalizedOriginal)
    ) {
      payload[key] =
        normalizedCurrent as UpdateIberdrolaSolarContractRequest[Key];
    }
  }

  private buildObservationValue(): string | null {
    return this.buildObservationHistoryValue(
      this.contract?.observacoes,
      this.observationDraft,
    );
  }

  private buildInternalObservationValue(): string | null {
    return this.buildObservationHistoryValue(
      this.contract?.observacoesInternas,
      this.internalObservationDraft,
    );
  }

  private buildObservationHistoryValue(
    currentValue: string | null | undefined,
    draftValue: string,
  ): string | null {
    const draft = this.normalizeObservationText(draftValue);

    if (!draft) {
      return null;
    }

    const currentHistory = this.getObservationLines(currentValue).join('\n');
    const timestamp = this.formatObservationTimestamp(new Date());
    const entry = `${this.currentUserName} - ${timestamp} - ${draft}`;

    return currentHistory ? `${currentHistory}\n${entry}` : entry;
  }

  private normalizeObservationText(value: string): string {
    return value
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private formatObservationTimestamp(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
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

    return new Date(date.getTime() - timezoneOffset)
      .toISOString()
      .slice(0, 16);
  }

  private buildEmptyEditForm():
    EditableContractForm {
    return {
      nomeClienteEmpresa: '',
      nif: null,
      telefone: null,
      email: '',
      cae: '',
      crc: '',

      tipoSegmento:
        'Residencial',
      tipoProduto:
        'Painéis Solares',
      contratacao:
        'Contratação Digital',
      numeroLead: '',
      offer: '',

      controleQualidade: '',
      codigoRegistoCE: '',
      nomeRegistoCE: '',
      estado:
        'Pedido de Proposta',

      agendamento: '',
      dataAssinatura: '',
      dataContrato: '',
      dataRegisto: '',
      dataInstalacao: '',
      dataAtivacao: '',
      dataBaixa: '',

      moradaInstalacao: '',
      moradaFaturacao: '',

      faturaEletronica: false,
      debitoDireto: false,
      nib: '',

      microinversor: false,
      baterias: false,
      numeroPaineisSolares: 1,
      metodoPagamento:
        'Pronto Pagamento',
    };
  }

  private buildCollapsedSections(value: boolean) {
    return {
      client: value,
      contract: value,
      status: value,
      billing: value,
      campaign: value,
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
