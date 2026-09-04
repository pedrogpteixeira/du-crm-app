import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  map,
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
  UpdateIberdrolaContractRequest,
  IBERDROLA_CONTRACT_STATUSES,
  IBERDROLA_GAS_LEVEL_SUGGESTIONS,
  IBERDROLA_POWER_SUGGESTIONS,
  IberdrolaCicloHorario,
  IberdrolaContractDetail as IberdrolaContractDetailModel,
  IberdrolaContractDocument,
  IberdrolaContractService,
  IberdrolaContractStatus,
  IberdrolaContratacao,
  IberdrolaNivelTensao,
  IberdrolaTipoContratacao,
  IberdrolaTipoProduto,
  IberdrolaTipoSegmento,
} from '../../../core/services/iberdrola-contract';

type CampaignSelectionMode =
  | 'existing'
  | 'other';

interface EditableContractForm {
  nomeClienteEmpresa: string;
  nif: number | null;
  cartaoCidadao: string;
  telefone: number | null;
  email: string;
  cae: string;
  crc: string;

  tipoSegmento: IberdrolaTipoSegmento;
  tipoProduto: IberdrolaTipoProduto;
  contratacao: IberdrolaContratacao;

  tipoContratacaoLuz:
    | IberdrolaTipoContratacao
    | '';

  tipoContratacaoGas:
    | IberdrolaTipoContratacao
    | '';

  controleQualidade: string;
  codigoRegistoCE: string;
  nomeRegistoCE: string;

  estado: IberdrolaContractStatus;
  idVenda: string;

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
  potencia: string;
  escalao: string;

  cicloHorario:
    | IberdrolaCicloHorario
    | '';

  nivelTensao:
    | IberdrolaNivelTensao
    | '';

  campaignId: string;
  customCampaign: string;
}

interface SaveContractResult {
  contract: IberdrolaContractDetailModel;
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

interface IberdrolaContractApiShape
  extends IberdrolaContractDetailModel {
  campanha?: string | null;
}

@Component({
  selector: 'app-iberdrola-contract-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl:
    './iberdrola-contract-detail.html',
  changeDetection:
    ChangeDetectionStrategy.Eager,
  styleUrl:
    './iberdrola-contract-detail.scss',
})
export class IberdrolaContractDetail
  implements OnInit
{
  private readonly destroyRef =
    inject(DestroyRef);

  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly auth =
    inject(Auth);

  private readonly campaignService =
    inject(CampaignService);

  private readonly iberdrolaContractService =
    inject(IberdrolaContractService);

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
    IberdrolaContractDetailModel | null =
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
    IberdrolaTipoSegmento[] = [
      'Residencial',
      'Empresarial',
      'Condomínios',
    ];

  readonly tipoProdutoOptions:
    IberdrolaTipoProduto[] = [
      'Luz',
      'Luz + Gás',
      'Gás',
    ];

  readonly contratacaoOptions:
    IberdrolaContratacao[] = [
      'Contratação Digital',
      'Contratação Papel',
    ];

  readonly tipoContratacaoOptions:
    IberdrolaTipoContratacao[] = [
      'Mudança de Comercializadora',
      'Mudança de Comercializadora & AT',
      'Entrada Direta',
    ];

  readonly estadoOptions:
    readonly IberdrolaContractStatus[] =
      IBERDROLA_CONTRACT_STATUSES;

  readonly cicloHorarioOptions:
    IberdrolaCicloHorario[] = [
      'Simples',
      'Bi-Horário Diário',
      'Bi-Horário Semanal',
      'Tri-Horário Diário',
      'Tri-Horário Semanal',
      'Tetra-Horário',
    ];

  readonly nivelTensaoOptions:
    IberdrolaNivelTensao[] = [
      'Monofásico',
      'Trifásico',
    ];

  readonly powerSuggestions =
    IBERDROLA_POWER_SUGGESTIONS;

  readonly gasLevelSuggestions =
    IBERDROLA_GAS_LEVEL_SUGGESTIONS;

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

    this.route.paramMap
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe((params) => {
        this.contractId =
          params.get('id') ?? '';

        if (this.contractId) {
          this.loadContract(
            this.contractId,
          );
        }
      });

    this.socketService
      .listenIberdrolaContractUpdated()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
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

    this.iberdrolaContractService
      .getIberdrolaContractById(
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
            'Não foi possível carregar o contrato Iberdrola.',
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

  onTipoProdutoChange(): void {
    if (!this.shouldShowLuzFields()) {
      this.clearElectricityFields();
    }

    if (!this.shouldShowGasFields()) {
      this.clearGasFields();
    }
  }

  shouldShowLuzFields(): boolean {
    const product =
      this.isEditing
        ? this.editForm.tipoProduto
        : this.contract?.tipoProduto;

    return (
      product === 'Luz' ||
      product === 'Luz + Gás'
    );
  }

  shouldShowGasFields(): boolean {
    const product =
      this.isEditing
        ? this.editForm.tipoProduto
        : this.contract?.tipoProduto;

    return (
      product === 'Gás' ||
      product === 'Luz + Gás'
    );
  }

  saveChanges(): void {
    if (
      !this.isSuperAdmin ||
      !this.contract ||
      !this.contractId
    ) {
      return;
    }

    if (
      !this.editForm
        .nomeClienteEmpresa
        .trim()
    ) {
      this.showError(
        'O nome do cliente é obrigatório.',
      );

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

    if (
      this.editForm.email.trim() &&
      !this.isValidEmail(
        this.editForm.email,
      )
    ) {
      this.showError(
        'Indica um email válido.',
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
      Observable<IberdrolaContractDetailModel> =
      hasContractChanges
        ? this.iberdrolaContractService
            .updateIberdrolaContract(
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
                .iberdrolaContractService
                .getIberdrolaContractById(
                  this.contractId,
                )
                .pipe(
                  map(
                    (
                      contract,
                    ): SaveContractResult => ({
                      contract,
                      uploadFailed: false,
                      uploadError: null,
                    }),
                  ),
                );
            }

            return this
              .iberdrolaContractService
              .uploadAttachments(
                this.contractId,
                this.selectedFiles,
              )
              .pipe(
                switchMap(() =>
                  this
                    .iberdrolaContractService
                    .getIberdrolaContractById(
                      this.contractId,
                    )
                    .pipe(
                      map(
                        (
                          contract,
                        ): SaveContractResult => ({
                          contract,
                          uploadFailed: false,
                          uploadError: null,
                        }),
                      ),
                    ),
                ),

                catchError(
                  (
                    uploadError:
                      unknown,
                  ) =>
                    this
                      .iberdrolaContractService
                      .getIberdrolaContractById(
                        this.contractId,
                      )
                      .pipe(
                        map(
                          (
                            contract,
                          ): SaveContractResult => ({
                            contract,
                            uploadFailed: true,
                            uploadError,
                          }),
                        ),

                        catchError(() =>
                          of<SaveContractResult>({
                            contract:
                              this.contract!,
                            uploadFailed:
                              true,
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
          contract:
            updatedContract,
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

        error: (
          error:
            HttpErrorResponse,
        ) => {
          this.clearOwnSocketSuppression();

          this.showError(
            error?.error?.details
              ?.join(' ') ||
              error?.error?.message ||
              'Não foi possível atualizar o contrato Iberdrola.',
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

    const files =
      input.files
        ? Array.from(
            input.files,
          )
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
      IberdrolaContractDocument,
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

    this.iberdrolaContractService
      .deleteAttachment(
        this.contractId,
        document.fileName,
      )
      .pipe(
        switchMap(() =>
          this
            .iberdrolaContractService
            .getIberdrolaContractById(
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

        error: (
          error:
            HttpErrorResponse,
        ) => {
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
      IberdrolaContractDocument,
  ): boolean {
    return this
      .deletingAttachmentFileNames
      .has(document.fileName);
  }

  downloadDocument(
    file:
      IberdrolaContractDocument,
  ): void {
    if (!this.contract?.id) {
      return;
    }

    this.iberdrolaContractService
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
      IberdrolaContractStatus,
  ): string {
    const classes:
      Record<
        IberdrolaContractStatus,
        string
      > = {
        'Pedido de Contratação': 'status-contract-request',
        'Pedido de Simulação': 'status-simulation',
        'Pendente Validação Comercial': 'status-commercial-validation',
        'Pedido SMS (RGPD)': 'status-rgpd',
        'Pedido VTV': 'status-vtv',
        'Pendente SMS "Cond Contratuais"': 'status-contractual-sms',
        'Não Conformidade': 'status-non-compliance',
        BackOffice: 'status-backoffice',
        Controle: 'status-control',
        'Pedido de Fornecimento': 'status-supply-request',
        'Em fornecimento': 'status-supply',
        Ativo: 'status-active',
        'Parcialmente Baixa': 'status-partial-low',
        Cancelada: 'status-cancelled',
        Baixa: 'status-low',
      };

    return classes[status];
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

  formatDateTime(
    value:
      | string
      | null
      | undefined,
  ): string {
    if (!value) {
      return '—';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return value;
    }

    return new Intl
      .DateTimeFormat(
        'pt-PT',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        },
      )
      .format(date);
  }

  formatDateOnly(
    value:
      | string
      | null
      | undefined,
  ): string {
    if (!value) {
      return '—';
    }

    const normalized =
      value.slice(0, 10);

    const [
      year,
      month,
      day,
    ] =
      normalized.split('-');

    if (
      year &&
      month &&
      day
    ) {
      return `${day}/${month}/${year}`;
    }

    return value;
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
      return '—';
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

    const selectedFiles = [
      ...this.selectedFiles,
    ];

    this.iberdrolaContractService
      .getIberdrolaContractById(
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

          this.selectedFiles =
            selectedFiles;

          if (
            result.conflicts > 0
          ) {
            this.socketMessage =
              `Este contrato foi atualizado por outro utilizador às ${currentTime}. ` +
              `${result.updated} campo(s) não alterado(s) por si foram atualizados automaticamente. ` +
              `${result.conflicts} campo(s) que também estava a editar foram preservados com os seus valores. ` +
              'Ao guardar, os seus valores nesses campos irão prevalecer.';

            return;
          }

          this.socketMessage =
            `Este contrato foi atualizado por outro utilizador às ${currentTime}. ` +
            `${result.updated} campo(s) foram sincronizados automaticamente sem perder os seus rascunhos nem os ficheiros selecionados.`;
        },

        error: () => {
          this.socketMessage =
            `Este contrato foi atualizado por outro utilizador às ${currentTime}, ` +
            'mas não foi possível sincronizar os dados automaticamente. Atualize a página antes de guardar.';
        },
      });
  }

  private mergeExternalContract(
    latestContract:
      IberdrolaContractDetailModel,
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
    mode:
      CampaignSelectionMode,
    form:
      EditableContractForm,
  ): {
    mode: CampaignSelectionMode;
    value: string;
  } {
    return {
      mode,

      value:
        mode === 'other'
          ? form
              .customCampaign
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
    form:
      EditableContractForm,
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
      IberdrolaContractDetailModel,
  ): boolean {
    if (this.isSuperAdmin) {
      return true;
    }

    return (
      contract.followers ?? []
    ).some((follower) => {
      return (
        follower.id ===
        this.currentUserId
      );
    });
  }

  private normalizeContractResponse(
    contract:
      IberdrolaContractDetailModel,
  ): IberdrolaContractDetailModel {
    const apiContract =
      contract as
        IberdrolaContractApiShape;

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
      IberdrolaContractDetailModel,
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
      IberdrolaContractDetailModel,
  ): {
    form:
      EditableContractForm;
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

        cartaoCidadao:
          contract
            .cartaoCidadao ??
          '',

        telefone:
          contract.telefone ??
          null,

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

        tipoContratacaoLuz:
          contract
            .tipoContratacaoLuz ??
          '',

        tipoContratacaoGas:
          contract
            .tipoContratacaoGas ??
          '',

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

        idVenda:
          contract.idVenda ?? '',

        agendamento:
          this.toDateTimeLocal(
            contract.agendamento,
          ),

        dataAssinatura:
          this.toDateInput(
            contract
              .dataAssinatura,
          ),

        dataContrato:
          this.toDateInput(
            contract.dataContrato,
          ),

        dataRegisto:
          this.toDateInput(
            contract.dataRegisto,
          ),

        dataAtivacaoCPE:
          this.toDateInput(
            contract
              .dataAtivacaoCPE,
          ),

        dataBaixaCPE:
          this.toDateInput(
            contract.dataBaixaCPE,
          ),

        dataAtivacaoCUI:
          this.toDateInput(
            contract
              .dataAtivacaoCUI,
          ),

        dataBaixaCUI:
          this.toDateInput(
            contract.dataBaixaCUI,
          ),

        moradaInstalacao:
          contract
            .moradaInstalacao ??
          '',

        moradaFaturacao:
          contract
            .moradaFaturacao ??
          '',

        faturaEletronica:
          Boolean(
            contract
              .faturaEletronica,
          ),

        sva:
          Boolean(
            contract.sva,
          ),

        debitoDireto:
          Boolean(
            contract
              .debitoDireto,
          ),

        iban:
          contract.iban ?? '',

        antigaComercializadora:
          contract
            .antigaComercializadora ??
          '',

        cpe:
          contract.cpe ?? '',

        cui:
          contract.cui ?? '',

        potencia:
          contract.potencia ??
          '',

        escalao:
          contract.escalao ?? '',

        cicloHorario:
          contract
            .cicloHorario ??
          '',

        nivelTensao:
          contract
            .nivelTensao ??
          '',

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
      IberdrolaContractDetailModel[
        'campaign'
      ],
  ): {
    mode:
      CampaignSelectionMode;
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
    UpdateIberdrolaContractRequest {
    const payload:
      UpdateIberdrolaContractRequest =
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
      'cartaoCidadao',
      this.editForm
        .cartaoCidadao,
      this.originalEditForm
        .cartaoCidadao,
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
      'tipoProduto',
      this.editForm
        .tipoProduto,
      this.originalEditForm
        .tipoProduto,
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
      'tipoContratacaoLuz',
      this.editForm
        .tipoContratacaoLuz,
      this.originalEditForm
        .tipoContratacaoLuz,
    );

    this.assignChangedValue(
      payload,
      'tipoContratacaoGas',
      this.editForm
        .tipoContratacaoGas,
      this.originalEditForm
        .tipoContratacaoGas,
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
      'idVenda',
      this.editForm.idVenda,
      this.originalEditForm.idVenda,
    );

    this.assignChangedValue(
      payload,
      'agendamento',
      this.editForm
        .agendamento,
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
      this.editForm
        .dataRegisto,
      this.originalEditForm
        .dataRegisto,
    );

    this.assignChangedValue(
      payload,
      'dataAtivacaoCPE',
      this.editForm
        .dataAtivacaoCPE,
      this.originalEditForm
        .dataAtivacaoCPE,
    );

    this.assignChangedValue(
      payload,
      'dataBaixaCPE',
      this.editForm
        .dataBaixaCPE,
      this.originalEditForm
        .dataBaixaCPE,
    );

    this.assignChangedValue(
      payload,
      'dataAtivacaoCUI',
      this.editForm
        .dataAtivacaoCUI,
      this.originalEditForm
        .dataAtivacaoCUI,
    );

    this.assignChangedValue(
      payload,
      'dataBaixaCUI',
      this.editForm
        .dataBaixaCUI,
      this.originalEditForm
        .dataBaixaCUI,
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
      'sva',
      this.editForm.sva,
      this.originalEditForm.sva,
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
      'iban',
      this.editForm.iban,
      this.originalEditForm.iban,
    );

    this.assignChangedValue(
      payload,
      'antigaComercializadora',
      this.editForm
        .antigaComercializadora,
      this.originalEditForm
        .antigaComercializadora,
    );

    this.assignChangedValue(
      payload,
      'cpe',
      this.editForm.cpe,
      this.originalEditForm.cpe,
    );

    this.assignChangedValue(
      payload,
      'cui',
      this.editForm.cui,
      this.originalEditForm.cui,
    );

    this.assignChangedValue(
      payload,
      'potencia',
      this.editForm.potencia,
      this.originalEditForm
        .potencia,
    );

    this.assignChangedValue(
      payload,
      'escalao',
      this.editForm.escalao,
      this.originalEditForm
        .escalao,
    );

    this.assignChangedValue(
      payload,
      'cicloHorario',
      this.editForm
        .cicloHorario,
      this.originalEditForm
        .cicloHorario,
    );

    this.assignChangedValue(
      payload,
      'nivelTensao',
      this.editForm
        .nivelTensao,
      this.originalEditForm
        .nivelTensao,
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
      UpdateIberdrolaContractRequest,
    key:
      keyof UpdateIberdrolaContractRequest,
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

  private clearElectricityFields():
    void {
    this.editForm
      .tipoContratacaoLuz = '';

    this.editForm.cpe = '';
    this.editForm.potencia = '';
    this.editForm
      .cicloHorario = '';
    this.editForm
      .nivelTensao = '';

    this.editForm
      .dataAtivacaoCPE = '';

    this.editForm
      .dataBaixaCPE = '';
  }

  private clearGasFields(): void {
    this.editForm
      .tipoContratacaoGas = '';

    this.editForm.cui = '';
    this.editForm.escalao = '';

    this.editForm
      .dataAtivacaoCUI = '';

    this.editForm
      .dataBaixaCUI = '';
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

    return value.slice(0, 10);
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

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return value.slice(0, 16);
    }

    const timezoneOffset =
      date.getTimezoneOffset() *
      60_000;

    return new Date(
      date.getTime() -
        timezoneOffset,
    )
      .toISOString()
      .slice(0, 16);
  }

  private buildEmptyEditForm():
    EditableContractForm {
    return {
      nomeClienteEmpresa: '',
      nif: null,
      cartaoCidadao: '',
      telefone: null,
      email: '',
      cae: '',
      crc: '',

      tipoSegmento:
        'Residencial',

      tipoProduto:
        'Luz + Gás',

      contratacao:
        'Contratação Digital',

      tipoContratacaoLuz: '',
      tipoContratacaoGas: '',

      controleQualidade: '',
      codigoRegistoCE: '',
      nomeRegistoCE: '',

      estado:
        'Pedido de Contratação',

      idVenda: '',

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
      potencia: '',
      escalao: '',
      cicloHorario: '',
      nivelTensao: '',

      campaignId: '',
      customCampaign: '',
    };
  }

  private buildCollapsedSections(
    value: boolean,
  ) {
    return {
      client: value,
      contract: value,
      dates: value,
      billing: value,
      campaign: value,
      energy: value,
      attachments: value,
      observations: value,
      internalObservations:
        value,
    };
  }

  private getFileKey(
    file: File,
  ): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  private isValidEmail(
    value: string,
  ): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(value.trim());
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
