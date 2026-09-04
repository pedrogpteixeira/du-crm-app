import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  switchMap,
} from 'rxjs';

import { environment } from '../../../../environments/environment';

import { Auth } from '../../../core/services/auth';
import {
  Campaign,
  CampaignService,
} from '../../../core/services/campaign';
import { PreferencesService } from '../../../core/services/preferences';
import { SocketService } from '../../../core/services/socket';
import {
  ProfileUser,
  UserService,
} from '../../../core/services/user';
import {
  UpdateWallboxContractRequest,
  WallboxContractDetail as WallboxContractDetailModel,
  WallboxContractDocument,
  WallboxContractService,
  WallboxContractStatus,
  WallboxMetodoPagamento,
  WallboxNivelTensao,
  WallboxTipoLocalInstalacao,
  WallboxTipoProduto,
  WallboxTipoSegmento,
} from '../../../core/services/wallbox-contract';

type CampaignSelectionMode =
  | 'existing'
  | 'other';

interface SegmentOption {
  value: WallboxTipoSegmento;
  label: string;
}

interface EditableContractForm {
  nomeClienteEmpresa: string;
  nif: number | null;
  telefone: number | null;
  email: string;

  tipoSegmento: WallboxTipoSegmento;
  tipoProduto: WallboxTipoProduto;

  controleQualidade: string;
  codigoRegistoCE: string;
  nomeRegistoCE: string;

  estado: WallboxContractStatus;

  agendamento: string;
  dataAssinatura: string;
  dataContrato: string;
  dataRegisto: string;
  dataInstalacao: string;
  dataAtivacao: string;
  dataBaixa: string;

  numeroLead: string;
  offer: string;

  moradaInstalacao: string;
  moradaFaturacao: string;

  nivelTensao: WallboxNivelTensao | '';
  tipoLocalInstalacao:
    | WallboxTipoLocalInstalacao
    | '';
  metodoPagamento:
    | WallboxMetodoPagamento
    | '';

  comDeslocacao: boolean;
  balanceamentoPotencia: boolean;

  campaignId: string;
  customCampaign: string;
}


interface SaveContractResult {
  contract: WallboxContractDetailModel;
  uploadFailed: boolean;
  uploadError: unknown;
}

interface AuthenticatedUserLike {
  id?: string;
  _id?: string;
  role?: string;
  name?: string;
  username?: string;
}

interface WallboxContractApiShape
  extends WallboxContractDetailModel {
  campanha?: string | null;
}

@Component({
  selector: 'app-wallbox-contract-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl:
    './wallbox-contract-detail.html',
  changeDetection:
    ChangeDetectionStrategy.Eager,
  styleUrl:
    './wallbox-contract-detail.scss',
})
export class WallboxContractDetail
  implements OnInit
{
  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly auth =
    inject(Auth);

  private readonly campaignService =
    inject(CampaignService);

  private readonly wallboxContractService =
    inject(WallboxContractService);

  private readonly preferencesService =
    inject(PreferencesService);

  private readonly socketService =
    inject(SocketService);

  private readonly userService =
    inject(UserService);

  private currentUserId = '';
  private currentUserName = '';

  private suppressNextOwnSocketUpdate =
    false;

  private ownSocketSuppressionTimer:
    ReturnType<typeof setTimeout> | null =
    null;

  contract:
    WallboxContractDetailModel | null =
    null;

  campaigns: Campaign[] = [];

  observationDraft = '';
  internalObservationDraft = '';

  selectedFiles: File[] = [];

  deletingAttachmentFileNames =
    new Set<string>();

  editForm =
    this.buildEmptyEditForm();

  originalEditForm =
    this.buildEmptyEditForm();

  campaignSelectionMode:
    CampaignSelectionMode =
    'existing';

  originalCampaignSelectionMode:
    CampaignSelectionMode =
    'existing';

  collapsedSections =
    this.buildCollapsedSections(false);

  isLoading = false;
  isSaving = false;
  isEditing = false;
  isSuperAdmin = false;

  canAccessInternalObservations =
    false;

  errorMessage = '';
  successMessage = '';
  socketMessage = '';

  contractId = '';
  lastSocketUpdate = '';

  readonly tipoSegmentoOptions:
    SegmentOption[] = [
      {
        value: 'Residencial',
        label: 'Residencial',
      },
      {
        value: 'Empresarial',
        label: 'Empresarial',
      },
    ];

  readonly tipoProdutoOptions:
    WallboxTipoProduto[] = [
      'Luz',
      'Luz + Gás',
      'Gás',
    ];

  readonly estadoOptions:
    WallboxContractStatus[] = [
      'Pedido de Chamada',
      'Registo Plataforma Galp',
      'Não conformidade',
      'Em Ativação',
      'Ativo',
      'Anulado',
    ];

  readonly nivelTensaoOptions:
    WallboxNivelTensao[] = [
      'Manter',
      'Monofásico',
      'Trifásico',
    ];

  readonly tipoLocalInstalacaoOptions:
    WallboxTipoLocalInstalacao[] = [
      'Moradia',
      'Condomínio Ligação a QE comum',
      'Condomínio Ligação a QE cliente',
    ];

  readonly metodoPagamentoOptions:
    WallboxMetodoPagamento[] = [
      'Pronto Pagamento',
      'Pagamento em Prestações',
    ];

  ngOnInit(): void {
    this.resolvePermissions();

    const collapseByDefault =
      this.preferencesService
        .getPreferences()
        .contractDetailsCollapsedByDefault;

    this.collapsedSections =
      this.buildCollapsedSections(
        collapseByDefault,
      );

    this.route.paramMap.subscribe(
      (params) => {
        this.contractId =
          params.get('id') ?? '';

        if (this.contractId) {
          this.loadContract(
            this.contractId,
          );
        }
      },
    );

    this.socketService
      .listenWallboxContractUpdated()
      .subscribe((event) => {
        if (
          event.contractId !==
          this.contractId
        ) {
          return;
        }

        const eventUserId =
          this.getSocketEventUserId(
            event,
          );

        if (
          eventUserId &&
          this.currentUserId &&
          eventUserId ===
            this.currentUserId
        ) {
          return;
        }

        if (
          !eventUserId &&
          this.suppressNextOwnSocketUpdate
        ) {
          return;
        }

        const currentTime =
          new Date()
            .toLocaleTimeString(
              'pt-PT',
            );

        this.lastSocketUpdate =
          currentTime;

        if (this.isEditing) {
          this.synchronizeExternalUpdate(
            currentTime,
          );

          return;
        }

        this.socketMessage =
          `Este contrato foi atualizado por outro utilizador às ${currentTime}.`;

        this.loadContract(
          this.contractId,
        );
      });
  }

  loadContract(
    contractId: string,
  ): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.wallboxContractService
      .getWallboxContractById(
        contractId,
      )
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (contract) => {
          if (
            !this.hasContractAccess(
              contract,
            )
          ) {
            this.contract = null;
            this.isLoading = false;

            this.showError(
              'Não tem permissão para aceder a este contrato.',
            );

            this.router.navigateByUrl(
              '/error',
              {
                replaceUrl: true,
              },
            );

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
          this.showError(
            'Não foi possível carregar o contrato Wallbox.',
          );
        },
      });
  }

  startEditing(): void {
    if (
      !this.isSuperAdmin ||
      !this.contract
    ) {
      return;
    }

    this.initializeEditForm(
      this.contract,
    );

    this.observationDraft = '';
    this.internalObservationDraft =
      '';

    this.selectedFiles = [];

    this.isEditing = true;

    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEditing(): void {
    if (this.contract) {
      this.initializeEditForm(
        this.contract,
      );
    }

    this.observationDraft = '';
    this.internalObservationDraft =
      '';

    this.selectedFiles = [];

    this.isEditing = false;

    this.errorMessage = '';
    this.successMessage = '';
  }

  saveChanges(): void {
    if (
      !this.isSuperAdmin ||
      !this.contract ||
      !this.contractId
    ) {
      return;
    }

    if (!this.editForm.nif) {
      this.showError(
        'O NIF é obrigatório.',
      );

      return;
    }

    if (!this.editForm.telefone) {
      this.showError(
        'O telefone é obrigatório.',
      );

      return;
    }

    const campaignValue =
      this.getCurrentCampaignValue();

    if (!campaignValue) {
      this.showError(
        this.campaignSelectionMode ===
          'other'
          ? 'O nome da campanha é obrigatório.'
          : 'É obrigatório selecionar uma campanha.',
      );

      return;
    }

    const payload =
      this.buildPatchPayload();

    const hasContractChanges =
      Object.keys(payload).length > 0;

    const hasFiles =
      this.selectedFiles.length > 0;

    if (
      !hasContractChanges &&
      !hasFiles
    ) {
      this.showSuccess(
        'Não existem alterações para guardar.',
      );

      this.isEditing = false;

      return;
    }

    this.isSaving = true;

    this.errorMessage = '';
    this.successMessage = '';

    this.prepareOwnSocketSuppression();

    const updateRequest:
      Observable<WallboxContractDetailModel> =
      hasContractChanges
        ? this.wallboxContractService
            .updateWallboxContract(
              this.contractId,
              payload,
            )
        : of(this.contract);

    updateRequest
      .pipe(
        switchMap(
          (): Observable<SaveContractResult> => {
            if (!hasFiles) {
              return this
                .wallboxContractService
                .getWallboxContractById(
                  this.contractId,
                )
                .pipe(
                  map(
                    (contract): SaveContractResult => ({
                      contract,
                      uploadFailed: false,
                      uploadError: null,
                    }),
                  ),
                );
            }

            return this
              .wallboxContractService
              .uploadAttachments(
                this.contractId,
                this.selectedFiles,
              )
              .pipe(
                switchMap(() =>
                  this
                    .wallboxContractService
                    .getWallboxContractById(
                      this.contractId,
                    )
                    .pipe(
                      map(
                        (contract): SaveContractResult => ({
                          contract,
                          uploadFailed: false,
                          uploadError: null,
                        }),
                      ),
                    ),
                ),
                catchError((uploadError: unknown) =>
                  this
                    .wallboxContractService
                    .getWallboxContractById(
                      this.contractId,
                    )
                    .pipe(
                      map(
                        (contract): SaveContractResult => ({
                          contract,
                          uploadFailed: true,
                          uploadError,
                        }),
                      ),
                      catchError(() =>
                        of<SaveContractResult>({
                          contract: this.contract!,
                          uploadFailed: true,
                          uploadError,
                        }),
                      ),
                    ),
                ),
              );
          },
        ),
        finalize(() => {
          this.isSaving = false;
        }),
      )
      .subscribe({
        next: ({
          contract: updatedContract,
          uploadFailed,
          uploadError,
        }: SaveContractResult) => {
          const normalizedContract =
            this.normalizeContractResponse(
              updatedContract,
            );

          this.contract =
            normalizedContract;

          this.initializeEditForm(
            normalizedContract,
          );

          this.observationDraft = '';
          this.internalObservationDraft =
            '';

          if (uploadFailed) {
            this.isEditing = true;

            this.showError(
              (
                uploadError as {
                  error?: {
                    message?: string;
                  };
                } | null
              )?.error?.message ||
                'As alterações foram guardadas, mas não foi possível carregar os ficheiros. Pode tentar novamente sem perder a seleção.',
            );

            return;
          }

          const uploadedFiles =
            this.selectedFiles.length;

          this.selectedFiles = [];
          this.isEditing = false;

          this.showSuccess(
            uploadedFiles
              ? 'Contrato e ficheiros atualizados com sucesso.'
              : 'Contrato atualizado com sucesso.',
          );
        },

        error: (error: HttpErrorResponse) => {
          this.clearOwnSocketSuppression();

          this.showError(
            error?.error?.details?.join(
              ' ',
            ) ||
              error?.error?.message ||
              'Não foi possível atualizar o contrato Wallbox.',
          );
        },
      });
  }

  onCampaignModeChange(): void {
    if (
      this.campaignSelectionMode ===
      'other'
    ) {
      this.editForm.campaignId = '';

      return;
    }

    this.editForm.customCampaign = '';
  }

  onFilesSelected(
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    const files = input.files
      ? Array.from(input.files)
      : [];

    if (!files.length) {
      return;
    }

    const existingFileKeys =
      new Set(
        this.selectedFiles.map(
          (file) =>
            this.getFileKey(file),
        ),
      );

    const newFiles =
      files.filter(
        (file) =>
          !existingFileKeys.has(
            this.getFileKey(file),
          ),
      );

    this.selectedFiles = [
      ...this.selectedFiles,
      ...newFiles,
    ];

    input.value = '';
  }

  removeSelectedFile(
    index: number,
  ): void {
    this.selectedFiles =
      this.selectedFiles.filter(
        (_, fileIndex) =>
          fileIndex !== index,
      );
  }

  clearSelectedFiles(): void {
    this.selectedFiles = [];
  }

  deleteAttachment(
    document:
      WallboxContractDocument,
  ): void {
    if (
      !this.isSuperAdmin ||
      !this.isEditing ||
      !this.contract ||
      !this.contractId ||
      this.deletingAttachmentFileNames
        .has(document.fileName)
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Pretende remover o ficheiro "${document.originalName}"?`,
      );

    if (!confirmed) {
      return;
    }

    const previousContract =
      this.contract;

    this.deletingAttachmentFileNames
      .add(document.fileName);

    this.deletingAttachmentFileNames =
      new Set(
        this.deletingAttachmentFileNames,
      );

    this.contract = {
      ...previousContract,

      documentos:
        previousContract.documentos
          .filter(
            (
              existingDocument,
            ) =>
              existingDocument
                .fileName !==
              document.fileName,
          ),
    };

    this.errorMessage = '';
    this.successMessage = '';

    this.prepareOwnSocketSuppression();

    this.wallboxContractService
      .deleteAttachment(
        this.contractId,
        document.fileName,
      )
      .pipe(
        switchMap(() =>
          this.wallboxContractService
            .getWallboxContractById(
              this.contractId,
            ),
        ),
        finalize(() => {
          this.deletingAttachmentFileNames
            .delete(
              document.fileName,
            );

          this.deletingAttachmentFileNames =
            new Set(
              this.deletingAttachmentFileNames,
            );
        }),
      )
      .subscribe({
        next: (
          updatedContract,
        ) => {
          this.contract =
            this.normalizeContractResponse(
              updatedContract,
            );

          this.showSuccess(
            `O ficheiro "${document.originalName}" foi removido com sucesso.`,
          );
        },

        error: (error) => {
          this.clearOwnSocketSuppression();

          this.contract =
            previousContract;

          this.showError(
            error?.error?.message ||
              `Não foi possível remover o ficheiro "${document.originalName}".`,
          );
        },
      });
  }

  isDeletingAttachment(
    document:
      WallboxContractDocument,
  ): boolean {
    return this
      .deletingAttachmentFileNames
      .has(document.fileName);
  }

  private getFileKey(
    file: File,
  ): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  private resolvePermissions(): void {
    const currentUser =
      this.auth
        .getCurrentUser() as
        | AuthenticatedUserLike
        | null;

    const role =
      currentUser?.role
        ?.toLowerCase() ?? '';

    this.currentUserId =
      currentUser?.id ??
      currentUser?._id ??
      '';

    this.currentUserName =
      currentUser?.name ??
      currentUser?.username ??
      'Utilizador';

    this.isSuperAdmin =
      role.includes(
        'super admin',
      );

    if (!this.currentUserId) {
      return;
    }

    this.userService
      .getUserById(
        this.currentUserId,
      )
      .subscribe({
        next: (user) => {
          const teamIds =
            (
              user as ProfileUser & {
                teams?: Array<{
                  id?: string;
                }>;
              }
            ).teams
              ?.map(
                (team) =>
                  team.id ?? '',
              )
              .filter(Boolean) ??
            [];

          const authorizedTeamIds =
            [
              environment
                .EQUIPA_CRM_ID,
              environment
                .EQUIPA_DU_ID,
            ].filter(
              (
                teamId,
              ): teamId is string =>
                Boolean(teamId),
            );

          this.canAccessInternalObservations =
            teamIds.some(
              (teamId) =>
                authorizedTeamIds
                  .includes(
                    teamId,
                  ),
            );

          if (
            !this
              .canAccessInternalObservations
          ) {
            this.internalObservationDraft =
              '';
          }
        },
      });
  }

  private getSocketEventUserId(
    event: unknown,
  ): string {
    const socketEvent =
      event as {
        updatedBy?: string;
        userId?: string;
        updatedByUserId?: string;
      };

    return (
      socketEvent.updatedBy ??
      socketEvent.userId ??
      socketEvent
        .updatedByUserId ??
      ''
    );
  }

  private synchronizeExternalUpdate(
    currentTime: string,
  ): void {
    const observationDraft =
      this.observationDraft;

    const internalObservationDraft =
      this.internalObservationDraft;

    this.wallboxContractService
      .getWallboxContractById(
        this.contractId,
      )
      .subscribe({
        next: (
          latestContract,
        ) => {
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

          this.observationDraft =
            observationDraft;

          this.internalObservationDraft =
            internalObservationDraft;

          if (
            result.conflicts > 0
          ) {
            this.socketMessage =
              `Este contrato foi atualizado por outro utilizador às ${currentTime}. ` +
              `${result.updated} campo(s) não alterado(s) por si foram atualizados automaticamente. ` +
              `${result.conflicts} campo(s) que também estava a editar foram preservados com os seus valores. ` +
              'Os históricos de observações foram sincronizados sem perder os seus rascunhos. ' +
              'Ao guardar, os seus valores nesses campos irão prevalecer.';

            return;
          }

          const observationsMessage =
            this
              .canAccessInternalObservations
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
    latestContract:
      WallboxContractDetailModel,
  ): {
    updated: number;
    conflicts: number;
  } {
    const latestState =
      this.buildEditableState(
        latestContract,
      );

    const nextEditForm =
      structuredClone(
        this.editForm,
      );

    const nextOriginalForm =
      structuredClone(
        this.originalEditForm,
      );

    let updated = 0;
    let conflicts = 0;

    const campaignKeys:
      Array<
        keyof EditableContractForm
      > = [
        'campaignId',
        'customCampaign',
      ];

    const keys =
      Object.keys(
        latestState.form,
      ) as Array<
        keyof EditableContractForm
      >;

    keys.forEach((key) => {
      if (
        campaignKeys.includes(
          key,
        )
      ) {
        return;
      }

      const currentValue =
        this.editForm[key];

      const originalValue =
        this.originalEditForm[
          key
        ];

      const latestValue =
        latestState.form[key];

      const userChanged =
        !this.areValuesEqual(
          currentValue,
          originalValue,
        );

      const serverChanged =
        !this.areValuesEqual(
          latestValue,
          originalValue,
        );

      if (!serverChanged) {
        return;
      }

      if (!userChanged) {
        this.setFormValue(
          nextEditForm,
          key,
          latestValue,
        );

        updated += 1;
      } else if (
        !this.areValuesEqual(
          currentValue,
          latestValue,
        )
      ) {
        conflicts += 1;
      }

      this.setFormValue(
        nextOriginalForm,
        key,
        latestValue,
      );
    });

    const currentCampaign =
      this.getCampaignSnapshot(
        this.campaignSelectionMode,
        this.editForm,
      );

    const originalCampaign =
      this.getCampaignSnapshot(
        this
          .originalCampaignSelectionMode,
        this.originalEditForm,
      );

    const latestCampaign =
      this.getCampaignSnapshot(
        latestState.campaignMode,
        latestState.form,
      );

    const userChangedCampaign =
      !this.areValuesEqual(
        currentCampaign,
        originalCampaign,
      );

    const serverChangedCampaign =
      !this.areValuesEqual(
        latestCampaign,
        originalCampaign,
      );

    if (serverChangedCampaign) {
      if (!userChangedCampaign) {
        this.campaignSelectionMode =
          latestState.campaignMode;

        nextEditForm.campaignId =
          latestState.form
            .campaignId;

        nextEditForm.customCampaign =
          latestState.form
            .customCampaign;

        updated += 1;
      } else if (
        !this.areValuesEqual(
          currentCampaign,
          latestCampaign,
        )
      ) {
        conflicts += 1;
      }

      this.originalCampaignSelectionMode =
        latestState.campaignMode;

      nextOriginalForm.campaignId =
        latestState.form
          .campaignId;

      nextOriginalForm.customCampaign =
        latestState.form
          .customCampaign;
    }

    this.editForm =
      nextEditForm;

    this.originalEditForm =
      nextOriginalForm;

    return {
      updated,
      conflicts,
    };
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

      value:
        mode === 'other'
          ? form.customCampaign
              .trim()
          : form.campaignId,
    };
  }

  private areValuesEqual(
    firstValue: unknown,
    secondValue: unknown,
  ): boolean {
    return (
      JSON.stringify(
        this.normalizeValue(
          firstValue,
        ),
      ) ===
      JSON.stringify(
        this.normalizeValue(
          secondValue,
        ),
      )
    );
  }

  private setFormValue<
    Key extends
      keyof EditableContractForm,
  >(
    form: EditableContractForm,
    key: Key,
    value:
      EditableContractForm[Key],
  ): void {
    form[key] = value;
  }

  private prepareOwnSocketSuppression():
    void {
    this.clearOwnSocketSuppression();

    this.suppressNextOwnSocketUpdate =
      true;

    this.ownSocketSuppressionTimer =
      setTimeout(() => {
        this.clearOwnSocketSuppression();
      }, 10000);
  }

  private clearOwnSocketSuppression():
    void {
    this.suppressNextOwnSocketUpdate =
      false;

    if (
      this
        .ownSocketSuppressionTimer
    ) {
      clearTimeout(
        this
          .ownSocketSuppressionTimer,
      );

      this.ownSocketSuppressionTimer =
        null;
    }
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

          if (this.contract) {
            this.contract =
              this.normalizeContractResponse(
                this.contract,
              );

            if (!this.isEditing) {
              this.initializeEditForm(
                this.contract,
              );
            }
          }
        },

        error: () => {
          this.showError(
            'Não foi possível carregar as campanhas.',
          );
        },
      });
  }

  private hasContractAccess(
    contract:
      WallboxContractDetailModel,
  ): boolean {
    if (this.isSuperAdmin) {
      return true;
    }

    return (
      contract.followers ?? []
    ).some((follower: any) => {
      const followerId =
        typeof follower === 'string'
          ? follower
          : follower.id ??
            follower._id ??
            follower.userId ??
            '';

      return (
        followerId ===
        this.currentUserId
      );
    });
  }

  private normalizeContractResponse(
    contract:
      WallboxContractDetailModel,
  ): WallboxContractDetailModel {
    const apiContract =
      contract as
        WallboxContractApiShape;

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

    const currentCampaign =
      this.contract?.campaign
        ?.id === rawCampaign
        ? this.contract
            .campaign
        : null;

    return {
      ...contract,

      campaign: {
        id: rawCampaign,

        name:
          matchedCampaign?.name ??
          currentCampaign?.name ??
          rawCampaign,
      },
    };
  }

  private initializeEditForm(
    contract:
      WallboxContractDetailModel,
  ): void {
    const state =
      this.buildEditableState(
        contract,
      );

    this.editForm =
      structuredClone(
        state.form,
      );

    this.originalEditForm =
      structuredClone(
        state.form,
      );

    this.campaignSelectionMode =
      state.campaignMode;

    this.originalCampaignSelectionMode =
      state.campaignMode;
  }

  private buildEditableState(
    contract:
      WallboxContractDetailModel,
  ): {
    form: EditableContractForm;
    campaignMode:
      CampaignSelectionMode;
  } {
    const resolvedCampaign =
      this.resolveCampaignSelection(
        contract.campaign,
      );

    return {
      campaignMode:
        resolvedCampaign.mode,

      form: {
        nomeClienteEmpresa:
          contract
            .nomeClienteEmpresa ??
          '',

        nif:
          contract.nif ?? null,

        telefone:
          contract.telefone ??
          null,

        email:
          contract.email ?? '',

        tipoSegmento:
          contract.tipoSegmento,

        tipoProduto:
          contract.tipoProduto,

        controleQualidade:
          contract
            .controleQualidade ??
          '',

        codigoRegistoCE:
          contract
            .codigoRegistoCE ??
          '',

        nomeRegistoCE:
          contract
            .nomeRegistoCE ??
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

        numeroLead:
          contract.numeroLead ?? '',

        offer:
          contract.offer ?? '',

        moradaInstalacao:
          contract
            .moradaInstalacao ??
          '',

        moradaFaturacao:
          contract
            .moradaFaturacao ??
          '',

        nivelTensao:
          contract.nivelTensao ??
          '',

        tipoLocalInstalacao:
          contract
            .tipoLocalInstalacao ??
          '',

        metodoPagamento:
          contract
            .metodoPagamento ??
          '',

        comDeslocacao:
          Boolean(
            contract
              .comDeslocacao,
          ),

        balanceamentoPotencia:
          Boolean(
            contract
              .balanceamentoPotencia,
          ),

        campaignId:
          resolvedCampaign
            .campaignId,

        customCampaign:
          resolvedCampaign
            .customCampaign,
      },
    };
  }

  private resolveCampaignSelection(
    campaign:
      WallboxContractDetailModel[
        'campaign'
      ],
  ): {
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

    const campaignId =
      campaign.id?.trim() ?? '';

    const normalizedName =
      this.normalizeCampaignName(
        campaign.name,
      );

    const campaignById =
      campaignId
        ? this.campaigns.find(
            (
              availableCampaign,
            ) =>
              availableCampaign
                .id ===
              campaignId,
          )
        : undefined;

    const campaignByName =
      normalizedName
        ? this.campaigns.find(
            (
              availableCampaign,
            ) =>
              this
                .normalizeCampaignName(
                  availableCampaign
                    .name,
                ) ===
              normalizedName,
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
        campaign.name
          ?.trim() ?? '',
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

  private buildPatchPayload():
    UpdateWallboxContractRequest {
    const payload:
      UpdateWallboxContractRequest =
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
      this.editForm.nif,
      this.originalEditForm.nif,
    );

    this.assignChangedValue(
      payload,
      'telefone',
      this.editForm.telefone,
      this.originalEditForm
        .telefone,
    );

    this.assignChangedValue(
      payload,
      'email',
      this.editForm.email,
      this.originalEditForm.email,
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
      'tipoProduto',
      this.editForm
        .tipoProduto,
      this.originalEditForm
        .tipoProduto,
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
      this.editForm.dataAssinatura,
      this.originalEditForm
        .dataAssinatura,
    );

    this.assignChangedValue(
      payload,
      'dataContrato',
      this.editForm.dataContrato,
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
      this.editForm.dataInstalacao,
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
      'nivelTensao',
      this.editForm
        .nivelTensao,
      this.originalEditForm
        .nivelTensao,
    );

    this.assignChangedValue(
      payload,
      'tipoLocalInstalacao',
      this.editForm
        .tipoLocalInstalacao,
      this.originalEditForm
        .tipoLocalInstalacao,
    );

    this.assignChangedValue(
      payload,
      'metodoPagamento',
      this.editForm
        .metodoPagamento,
      this.originalEditForm
        .metodoPagamento,
    );

    this.assignChangedValue(
      payload,
      'comDeslocacao',
      this.editForm
        .comDeslocacao,
      this.originalEditForm
        .comDeslocacao,
    );

    this.assignChangedValue(
      payload,
      'balanceamentoPotencia',
      this.editForm
        .balanceamentoPotencia,
      this.originalEditForm
        .balanceamentoPotencia,
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

    const currentCampaign =
      this.getCurrentCampaignValue();

    const originalCampaign =
      this.getOriginalCampaignValue();

    if (
      currentCampaign !==
      originalCampaign
    ) {
      payload.campanha =
        currentCampaign;
    }

    return payload;
  }

  private assignChangedValue(
    payload:
      UpdateWallboxContractRequest,
    key:
      keyof UpdateWallboxContractRequest,
    currentValue: unknown,
    originalValue: unknown,
  ): void {
    const normalizedCurrent =
      this.normalizeValue(
        currentValue,
      );

    const normalizedOriginal =
      this.normalizeValue(
        originalValue,
      );

    if (
      JSON.stringify(
        normalizedCurrent,
      ) !==
      JSON.stringify(
        normalizedOriginal,
      )
    ) {
      (
        payload as unknown as Record<
          string,
          unknown
        >
      )[key] =
        normalizedCurrent;
    }
  }

  private buildObservationValue():
    string | null {
    return this
      .buildObservationHistoryValue(
        this.contract
          ?.observacoes,
        this.observationDraft,
      );
  }

  private buildInternalObservationValue():
    string | null {
    return this
      .buildObservationHistoryValue(
        this.contract
          ?.observacoesInternas,
        this
          .internalObservationDraft,
      );
  }

  private buildObservationHistoryValue(
    currentValue:
      | string
      | null
      | undefined,
    draftValue: string,
  ): string | null {
    const draft =
      this.normalizeObservationText(
        draftValue,
      );

    if (!draft) {
      return null;
    }

    const currentHistory =
      this.getObservationLines(
        currentValue,
      ).join('\n');

    const timestamp =
      this.formatObservationTimestamp(
        new Date(),
      );

    const entry =
      `${this.currentUserName} - ${timestamp} - ${draft}`;

    return currentHistory
      ? `${currentHistory}\n${entry}`
      : entry;
  }

  getObservationLines(
    value:
      | string
      | null
      | undefined,
  ): string[] {
    if (!value) {
      return [];
    }

    return value
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) =>
        line.trim(),
      )
      .filter(Boolean);
  }

  private normalizeObservationText(
    value: string,
  ): string {
    return value
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) =>
        line.trim(),
      )
      .filter(Boolean)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private formatObservationTimestamp(
    date: Date,
  ): string {
    const day =
      String(
        date.getDate(),
      ).padStart(2, '0');

    const month =
      String(
        date.getMonth() + 1,
      ).padStart(2, '0');

    const year =
      date.getFullYear();

    const hours =
      String(
        date.getHours(),
      ).padStart(2, '0');

    const minutes =
      String(
        date.getMinutes(),
      ).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  private getCurrentCampaignValue():
    string {
    return (
      this.campaignSelectionMode ===
      'other'
        ? this.editForm
            .customCampaign
            .trim()
        : this.editForm
            .campaignId
    );
  }

  private getOriginalCampaignValue():
    string {
    return (
      this
        .originalCampaignSelectionMode ===
      'other'
        ? this.originalEditForm
            .customCampaign
            .trim()
        : this.originalEditForm
            .campaignId
    );
  }

  private normalizeValue(
    value: unknown,
  ): unknown {
    return typeof value ===
      'string'
      ? value.trim()
      : value;
  }

  private toDateInput(
    value:
      | string
      | null
      | undefined,
  ): string {
    if (!value) {
      return '';
    }

    return value.length >= 10
      ? value.slice(0, 10)
      : value;
  }

  private toDateTimeLocal(
    value:
      | string
      | null
      | undefined,
  ): string {
    if (!value) {
      return '';
    }

    const parsedDate =
      new Date(value);

    if (
      Number.isNaN(
        parsedDate.getTime(),
      )
    ) {
      return value.length >= 16
        ? value.slice(0, 16)
        : value;
    }

    const offset =
      parsedDate
        .getTimezoneOffset() *
      60_000;

    return new Date(
      parsedDate.getTime() -
        offset,
    )
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

      tipoSegmento:
        'Residencial',

      tipoProduto:
        'Luz',

      controleQualidade: '',
      codigoRegistoCE: '',
      nomeRegistoCE: '',

      estado:
        'Pedido de Chamada',

      agendamento: '',
      dataAssinatura: '',
      dataContrato: '',
      dataRegisto: '',
      dataInstalacao: '',
      dataAtivacao: '',
      dataBaixa: '',

      numeroLead: '',
      offer: '',

      moradaInstalacao: '',
      moradaFaturacao: '',

      nivelTensao: '',
      tipoLocalInstalacao: '',
      metodoPagamento: '',

      comDeslocacao: false,
      balanceamentoPotencia:
        false,

      campaignId: '',
      customCampaign: '',
    };
  }

  private buildCollapsedSections(
    value: boolean,
  ) {
    return {
      contract: value,
      status: value,
      client: value,
      billing: value,
      product: value,
      attachments: value,
      observations: value,
      internalObservations:
        value,
    };
  }

  toggleSection(
    section:
      keyof typeof this.collapsedSections,
  ): void {
    this.collapsedSections[
      section
    ] =
      !this.collapsedSections[
        section
      ];
  }

  getStatusClass(
    status:
      WallboxContractStatus,
  ): string {
    return {
      'Pedido de Chamada':
        'status-call-request',

      'Registo Plataforma Galp':
        'status-signature',

      'Não conformidade':
        'status-non-compliance',

      'Em Ativação':
        'status-assigned',

      Ativo:
        'status-active',

      Anulado:
        'status-cancelled',
    }[status];
  }

  getSegmentLabel(
    segment:
      WallboxTipoSegmento,
  ): string {
    return (
      this.tipoSegmentoOptions
        .find(
          (option) =>
            option.value ===
            segment,
        )
        ?.label ?? segment
    );
  }

  downloadDocument(
    file:
      WallboxContractDocument,
  ): void {
    if (!this.contract?.id) {
      return;
    }

    this.wallboxContractService
      .downloadDocument(
        this.contract.id,
        file,
      )
      .subscribe({
        next: (blob) => {
          const url =
            window.URL
              .createObjectURL(
                blob,
              );

          const link =
            window.document
              .createElement('a');

          link.href = url;

          link.download =
            file.originalName ||
            file.fileName;

          window.document.body
            .appendChild(link);

          link.click();

          window.document.body
            .removeChild(link);

          window.URL
            .revokeObjectURL(
              url,
            );
        },

        error: () => {
          this.showError(
            'Não foi possível descarregar o anexo.',
          );
        },
      });
  }

  formatBoolean(
    value:
      | boolean
      | null
      | undefined,
  ): string {
    return value
      ? 'Sim'
      : 'Não';
  }

  formatDate(
    date:
      | string
      | null
      | undefined,
  ): string {
    if (!date) {
      return '-';
    }

    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime(),
      )
    ) {
      return date;
    }

    return new Intl
      .DateTimeFormat(
        'pt-PT',
        {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        },
      )
      .format(parsedDate);
  }

  getValue(
    value:
      | string
      | number
      | null
      | undefined,
  ): string | number {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return '-';
    }

    return value;
  }

  formatFileSize(
    bytes: number,
  ): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (
      bytes <
      1024 * 1024
    ) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      1024 /
      1024
    ).toFixed(1)} MB`;
  }

  getFileIcon(
    mimetype: string,
  ): string {
    if (
      mimetype.startsWith(
        'audio/',
      )
    ) {
      return '🎧';
    }

    if (
      mimetype.includes(
        'pdf',
      )
    ) {
      return '📄';
    }

    if (
      mimetype.includes(
        'word',
      )
    ) {
      return '📝';
    }

    if (
      mimetype.startsWith(
        'image/',
      )
    ) {
      return '🖼️';
    }

    return '📎';
  }

  private showSuccess(
    message: string,
  ): void {
    this.successMessage =
      message;

    setTimeout(() => {
      if (
        this.successMessage ===
        message
      ) {
        this.successMessage = '';
      }
    }, 5000);
  }

  private showError(
    message: string,
  ): void {
    this.errorMessage =
      message;

    setTimeout(() => {
      if (
        this.errorMessage ===
        message
      ) {
        this.errorMessage = '';
      }
    }, 5000);
  }
}
