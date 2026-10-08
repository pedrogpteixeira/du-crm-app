import { ToastService } from '../../../core/services/toast';

import {
  canManageQualityControl as canManageQualityControlRole,
  QUALITY_CONTROL_BACKOFFICE_OPTIONS,
} from '../../../core/config/quality-control';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, catchError, finalize, map, of, switchMap, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  DEFAULT_CPE_PREFIX,
  DEFAULT_CUI_PREFIX,
} from '../../../core/constants/contract-energy-options';

import { getContractEnergyValidationError } from '../../../core/utils/contract-energy-validation';
import { getContractFormValidationError } from '../../../core/utils/contract-field-formatting';
import { resolveLightContractRegistration } from '../../../core/utils/contract-light-registration';

import { Auth } from '../../../core/services/auth';

import { Campaign, CampaignService } from '../../../core/services/campaign';

import {
  buildContractPreflightRequest,
  ContractPreflightError,
  getNewSupplyPointReentryWarnings,
  ContractPreflightService,
  SupplyPointReentryWarning,
} from '../../../core/services/contract-preflight';

import { Client, ClientService } from '../../../core/services/client';

import { ContractLayout, PreferencesService } from '../../../core/services/preferences';

import { ProfileUser, UserService } from '../../../core/services/user';

import {
  CreateMeoEnergiasContractRequest,
  MEO_ENERGIAS_COMPANY_ID,
  MEO_ENERGIAS_CONTRACT_STATUSES,
  MEO_ENERGIAS_GAS_LEVEL_SUGGESTIONS,
  MEO_ENERGIAS_POWER_SUGGESTIONS,
  MeoEnergiasCicloHorario,
  MeoEnergiasContractDetail,
  MeoEnergiasContractService,
  MeoEnergiasContractStatus,
  MeoEnergiasContractTeamVisibility,
  MeoEnergiasContratacao,
  MeoEnergiasNivelTensao,
  MeoEnergiasTipoContratacao,
  MeoEnergiasTipoProduto,
  MeoEnergiasTipoSegmento,
} from '../../../core/services/meo-energias-contract';

type MoradaFaturacaoSelecao = 'Igual à de Instalação' | 'Outra';

interface AssignableContractTeam {
  id: string;
  name: string;
  registrationNumber: number | null;
  positionIndex: number;
  position: string;
  active?: boolean;
}

interface MeoEnergiasContractCreateForm {
  companyId: typeof MEO_ENERGIAS_COMPANY_ID;

  tipoSegmento: MeoEnergiasTipoSegmento;
  tipoProduto: MeoEnergiasTipoProduto;
  contratacao: MeoEnergiasContratacao;

  tipoContratacaoLuz: MeoEnergiasTipoContratacao | '';

  tipoContratacaoGas: MeoEnergiasTipoContratacao | '';

  controleQualidade: string;
  nomeRegistoCE: string;
  codigoRegistoCE: string;

  estado: MeoEnergiasContractStatus;

  agendamento: string;
  dataAssinatura: string;
  dataContrato: string;
  dataRegisto: string;
  dataAtivacaoCPE: string;
  dataBaixaCPE: string;
  dataAtivacaoCUI: string;
  dataBaixaCUI: string;

  telefone: number | null;
  email: string;
  cae: string;
  crc: string;

  moradaFaturacaoSelecao: MoradaFaturacaoSelecao;

  moradaInstalacaoRua: string;
  moradaInstalacaoCidade: string;
  moradaInstalacaoDistrito: string;
  moradaInstalacaoCodigoPostal: string;
  moradaInstalacaoPais: string;

  moradaFaturacaoRua: string;
  moradaFaturacaoCidade: string;
  moradaFaturacaoDistrito: string;
  moradaFaturacaoCodigoPostal: string;
  moradaFaturacaoPais: string;

  faturaEletronica: boolean;
  debitoDireto: boolean;
  tarifaSocial: boolean;
  iban: string;

  campanha: string;

  antigaComercializadora: string;
  cpe: string;
  cui: string;
  potencia: string;
  escalao: string;

  cicloHorario: MeoEnergiasCicloHorario | '';

  nivelTensao: MeoEnergiasNivelTensao | '';

  observacoes: string;
  observacoesInternas: string;
}

interface ProfileUserWithTeamPositions extends ProfileUser {
  teams: AssignableContractTeam[];
  defaultTeam: AssignableContractTeam | null;
}

import { EditableSelectCombobox } from '../../../shared/components/editable-select-combobox/editable-select-combobox';
import { ContractFieldMaskDirective } from '../../../shared/directives/contract-field-mask.directive';
import { FileDropzone } from '../../../shared/components/file-dropzone/file-dropzone';
import { ContractPreflightModal } from '../../../shared/components/contract-preflight-modal/contract-preflight-modal';

@Component({
  selector: 'app-meo-energias-contract-create',
  imports: [
    EditableSelectCombobox,CommonModule, FormsModule, ContractFieldMaskDirective, FileDropzone, ContractPreflightModal],
  templateUrl: './meo-energias-contract-create.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './meo-energias-contract-create.scss',
})
export class MeoEnergiasContractCreate implements OnInit {
  readonly qualityControlBackofficeOptions = QUALITY_CONTROL_BACKOFFICE_OPTIONS;
  private readonly clientService = inject(ClientService);

  private readonly campaignService = inject(CampaignService);

  private readonly meoEnergiasContractService = inject(MeoEnergiasContractService);

  private readonly contractPreflightService = inject(ContractPreflightService);

  private readonly preferencesService = inject(PreferencesService);

  private readonly userService = inject(UserService);

  private readonly destroyRef = inject(DestroyRef);

  private readonly auth = inject(Auth);

  private readonly router = inject(Router);

  readonly meoEnergiasCompanyId = MEO_ENERGIAS_COMPANY_ID;

  contractLayout: ContractLayout = 'light';

  nif: number | null = null;
  clientName = '';
  client: Client | null = null;

  campaigns: Campaign[] = [];

  currentUser: ProfileUser | null = null;

  assignableUsers: ProfileUser[] = [];

  availableTeams: AssignableContractTeam[] = [];

  assignedUserId = '';
  selectedTeamIds: string[] = [];
  teamToAddId = '';

  selectedRegistrationTeamId = '';

  isLoadingAssignment = false;
  assignmentErrorMessage = '';

  canAccessInternalObservations = false;

  selectedFiles: File[] = [];

  isCheckingClient = false;
  isCreatingClient = false;
  isCreatingContract = false;
  isPreflightLoading = false;
  isPreflightModalOpen = false;
  isPostCreateWarningModalOpen = false;
  preflightCanProceed = true;
  preflightWarnings: SupplyPointReentryWarning[] = [];
  preflightErrors: ContractPreflightError[] = [];
  postCreateWarnings: SupplyPointReentryWarning[] = [];

  private pendingCreatePayload: CreateMeoEnergiasContractRequest | null = null;
  private pendingCreatedContractId: string | null = null;
  private navigateAfterPostCreateWarning = false;
  isUploadingDocuments = false;

  clientChecked = false;
  clientNotFound = false;
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

  campaignSelectionMode: 'existing' | 'other' = 'existing';

  customCampaign = '';

  readonly tipoSegmentoOptions: MeoEnergiasTipoSegmento[] = ['Residencial', 'Empresarial'];

  readonly tipoProdutoOptions: MeoEnergiasTipoProduto[] = ['Luz', 'Luz + Gás', 'Gás'];

  readonly contratacaoOptions: MeoEnergiasContratacao[] = [
    'Contratação Digital',
    'Contratação Papel',
  ];

  readonly tipoContratacaoOptions: MeoEnergiasTipoContratacao[] = [
    'Mudança de Comercializadora',
    'Mudança de Comercializadora & AT',
    'Entrada Direta',
  ];

  readonly estadoOptions: readonly MeoEnergiasContractStatus[] = MEO_ENERGIAS_CONTRACT_STATUSES;

  readonly cicloHorarioOptions: MeoEnergiasCicloHorario[] = [
    'Simples',
    'Bi-Horário Diário',
    'Bi-Horário Semanal',
    'Tri-Horário Diário',
    'Tri-Horário Semanal',
    'Tetra-Horário',
  ];

  readonly nivelTensaoOptions: MeoEnergiasNivelTensao[] = ['Monofásico', 'Trifásico'];

  readonly powerSuggestions = MEO_ENERGIAS_POWER_SUGGESTIONS;

  readonly gasLevelSuggestions = MEO_ENERGIAS_GAS_LEVEL_SUGGESTIONS;

  readonly moradaFaturacaoOptions: MoradaFaturacaoSelecao[] = ['Igual à de Instalação', 'Outra'];

  contractForm: MeoEnergiasContractCreateForm = {
    companyId: MEO_ENERGIAS_COMPANY_ID,

    tipoSegmento: 'Residencial',
    tipoProduto: 'Luz + Gás',
    contratacao: 'Contratação Digital',

    tipoContratacaoLuz: 'Mudança de Comercializadora',

    tipoContratacaoGas: 'Mudança de Comercializadora',

    controleQualidade: '',
    nomeRegistoCE: '',
    codigoRegistoCE: '',

    estado: 'Pedido de Chamada',

    agendamento: '',
    dataAssinatura: '',
    dataContrato: '',
    dataRegisto: '',
    dataAtivacaoCPE: '',
    dataBaixaCPE: '',
    dataAtivacaoCUI: '',
    dataBaixaCUI: '',

    telefone: null,
    email: '',
    cae: '',
    crc: '',

    moradaFaturacaoSelecao: 'Igual à de Instalação',

    moradaInstalacaoRua: '',
    moradaInstalacaoCidade: '',
    moradaInstalacaoDistrito: '',
    moradaInstalacaoCodigoPostal: '',
    moradaInstalacaoPais: '',

    moradaFaturacaoRua: '',
    moradaFaturacaoCidade: '',
    moradaFaturacaoDistrito: '',
    moradaFaturacaoCodigoPostal: '',
    moradaFaturacaoPais: '',

    faturaEletronica: false,
    debitoDireto: false,
    tarifaSocial: false,
    iban: '',

    campanha: '',

    antigaComercializadora: '',
    cpe: DEFAULT_CPE_PREFIX,
    cui: DEFAULT_CUI_PREFIX,
    potencia: '',
    escalao: '',

    cicloHorario: '',
    nivelTensao: '',

    observacoes: '',
    observacoesInternas: '',
  };

  ngOnInit(): void {
    this.loadContractLayout();
    this.loadCampaigns();
    this.loadAssignmentData();
  }

  isLightLayout(): boolean {
    return this.contractLayout === 'light';
  }

  isProLayout(): boolean {
    return this.contractLayout === 'pro';
  }

  canManageQualityControl(): boolean {
    return canManageQualityControlRole(this.currentUser?.role);
  }
  canAssignOtherUsers(): boolean {
    return this.assignableUsers.length > 1;
  }


  get selectedTeams(): AssignableContractTeam[] {
    return this.selectedTeamIds
      .map((teamId) => this.availableTeams.find((team) => team.id === teamId))
      .filter((team): team is AssignableContractTeam => Boolean(team));
  }

  get teamsAvailableToAdd(): AssignableContractTeam[] {
    return this.availableTeams.filter((team) => !this.selectedTeamIds.includes(team.id));
  }

  onAssignedUserChange(): void {
    if (!this.canAssignOtherUsers() || !this.assignedUserId) {
      return;
    }

    this.clearRegistrationFields();

    this.loadAssignedUserTeams(this.assignedUserId);
  }

  onTipoProdutoChange(): void {
    if (!this.shouldShowLuzFields()) {
      this.clearElectricityFields();
    } else if (!this.contractForm.cpe.trim()) {
      this.contractForm.cpe = DEFAULT_CPE_PREFIX;
    }

    if (!this.shouldShowGasFields()) {
      this.clearGasFields();
    } else if (!this.contractForm.cui.trim()) {
      this.contractForm.cui = DEFAULT_CUI_PREFIX;
    }
  }

  shouldShowLuzFields(): boolean {
    return this.contractForm.tipoProduto === 'Luz' || this.contractForm.tipoProduto === 'Luz + Gás';
  }

  shouldShowGasFields(): boolean {
    return this.contractForm.tipoProduto === 'Gás' || this.contractForm.tipoProduto === 'Luz + Gás';
  }

  addSelectedTeam(): void {
    if (!this.teamToAddId) {
      return;
    }

    this.selectedTeamIds = [...new Set([...this.selectedTeamIds, this.teamToAddId])];

    this.teamToAddId = '';
  }

  removeSelectedTeam(teamId: string): void {
    this.selectedTeamIds = this.selectedTeamIds.filter(
      (selectedTeamId) => selectedTeamId !== teamId,
    );
  }

  isRequiredTeam(teamId: string): boolean {
    return this.getRequiredTeamIds().includes(teamId);
  }

  checkClientByNif(): void {
    if (!this.nif) {
      this.errorMessage = 'O NIF é obrigatório.';
      return;
    }

    this.isCheckingClient = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.client = null;
    this.clientChecked = false;
    this.clientNotFound = false;

    this.clientService
      .getClientByNif(this.nif)
      .pipe(
        finalize(() => {
          this.isCheckingClient = false;
        }),
      )
      .subscribe({
        next: (client) => {
          this.client = client;
          this.clientName = client.name;

          this.clientChecked = true;
          this.clientNotFound = false;

          /*  
          this.successMessage =
            'Cliente encontrado.';
            */
        },

        error: (error) => {
          this.clientChecked = true;

          if (error?.status === 404) {
            this.clientNotFound = true;

            this.client = null;
            this.clientName = '';
            return;
          }

          this.errorMessage = 'Não foi possível verificar o cliente.';
        },
      });
  }

  createClient(): void {
    if (!this.nif || !this.clientName.trim()) {
      this.errorMessage = 'O NIF e o nome do cliente são obrigatórios.';
      return;
    }

    if (this.isCreatingClient) {
      return;
    }

    this.isCreatingClient = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.clientService
      .createClient({
        name: this.clientName.trim(),
        nif: this.nif,
      })
      .pipe(
        finalize(() => {
          this.isCreatingClient = false;
        }),
      )
      .subscribe({
        next: (client) => {
          this.client = client;

          this.clientName = client.name;

          this.clientNotFound = false;

          this.clientChecked = true;

          this.successMessage = 'Cliente criado com sucesso.';
        },

        error: () => {
          this.errorMessage = 'Não foi possível criar o cliente.';
        },
      });
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

  formatFileSize(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  cancel(): void {
    if (this.isCreatingContract || this.isPreflightLoading) {
      return;
    }

    this.router.navigate(['/home/contracts/meo-energias']);
  }

  createContract(): void {
    if (this.isPreflightLoading || this.isCreatingContract) {
      return;
    }

    this.contractForm.estado = this.estadoOptions[0];

    if (!this.client) {
      this.errorMessage = 'É necessário identificar ou criar o cliente.';
      return;
    }

    if (!this.currentUser?.id) {
      this.errorMessage = 'Não foi possível identificar o utilizador autenticado.';
      return;
    }

    if (!this.assignedUserId) {
      this.errorMessage = 'É obrigatório selecionar o utilizador atribuído.';
      return;
    }

    if (!this.contractForm.tipoSegmento) {
      this.errorMessage = 'O tipo de segmento é obrigatório.';
      return;
    }

    if (!this.contractForm.tipoProduto) {
      this.errorMessage = 'O tipo de produto é obrigatório.';
      return;
    }

    if (!this.contractForm.contratacao) {
      this.errorMessage = 'O tipo de contratação é obrigatório.';
      return;
    }

    if (!this.contractForm.telefone) {
      this.errorMessage = 'O telefone é obrigatório.';
      return;
    }

    if (this.contractForm.email.trim() && !this.isValidEmail(this.contractForm.email)) {
      this.errorMessage = 'Indica um email válido.';
      return;
    }

    if (this.isProLayout()) {
      const energyValidationError = getContractEnergyValidationError({
        requiresElectricity: this.shouldShowLuzFields(),
        requiresGas: this.shouldShowGasFields(),
        cpe: this.contractForm.cpe,
        cui: this.contractForm.cui,
        potencia: this.contractForm.potencia,
        escalao: this.contractForm.escalao,
        cicloHorario: this.contractForm.cicloHorario,
      });

      if (energyValidationError) {
        this.errorMessage = energyValidationError;
        return;
      }
    }

    const campaignIsMissing =
      this.campaignSelectionMode === 'existing'
        ? !this.contractForm.campanha
        : !this.customCampaign.trim();

    if (campaignIsMissing) {
      this.errorMessage = 'É obrigatório selecionar ou indicar uma campanha.';
      return;
    }

    const teamValidationError = this.validateSelectedTeams();

    if (teamValidationError) {
      this.errorMessage = teamValidationError;
      return;
    }

    if (this.isLightLayout()) {
      this.contractForm.estado = 'Pedido de Chamada';
    }

    const fieldValidationError = getContractFormValidationError(
      this.contractForm as unknown as Record<string, unknown>,
      {
        validateCpe: this.isProLayout() && this.shouldShowLuzFields(),
        validateCui: this.isProLayout() && this.shouldShowGasFields(),
        ibanMode: 'international',
      },
    );

    if (fieldValidationError) {
      this.errorMessage = fieldValidationError;
      return;
    }

    const payload = this.buildContractPayload();

    this.runPreflight(payload);
  }

  private runPreflight(payload: CreateMeoEnergiasContractRequest): void {
    const preflightPayload = buildContractPreflightRequest({
      companyId: this.contractForm.companyId,
      tipoProduto: this.contractForm.tipoProduto,
      cpe: this.contractForm.cpe,
      cui: this.contractForm.cui,
    });

    this.isPreflightLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.contractPreflightService
      .preflightContract('meo-energias', preflightPayload)
      .pipe(
        finalize(() => {
          this.isPreflightLoading = false;
        }),
      )
      .subscribe({
        next: (result) => {
          const canProceed = result.canProceed && result.errors.length === 0;

          if (!canProceed || result.warnings.length > 0 || result.errors.length > 0) {
            this.preflightCanProceed = canProceed;
            this.preflightWarnings = result.warnings;
            this.preflightErrors = result.errors;
            this.pendingCreatePayload = canProceed ? payload : null;
            this.isPreflightModalOpen = true;
            return;
          }

          this.createContractAfterPreflight(payload, []);
        },
        error: () => {
          this.errorMessage =
            'Não foi possível validar o CPE/CUI neste momento. Tente novamente.';
        },
      });
  }

  closePreflightModal(): void {
    this.isPreflightModalOpen = false;
    this.preflightCanProceed = true;
    this.preflightWarnings = [];
    this.preflightErrors = [];
    this.pendingCreatePayload = null;
  }

  confirmPreflightCreation(): void {
    if (!this.preflightCanProceed || !this.pendingCreatePayload) {
      return;
    }

    const payload = this.pendingCreatePayload;
    const acceptedWarnings = [...this.preflightWarnings];

    this.closePreflightModal();
    this.createContractAfterPreflight(payload, acceptedWarnings);
  }

  acknowledgePostCreateWarnings(): void {
    const contractId = this.pendingCreatedContractId;
    const shouldNavigate = this.navigateAfterPostCreateWarning;

    this.isPostCreateWarningModalOpen = false;
    this.postCreateWarnings = [];
    this.pendingCreatedContractId = null;
    this.navigateAfterPostCreateWarning = false;

    if (contractId && shouldNavigate) {
      this.router.navigate(['/home/contracts/meo-energias', contractId]);
    }
  }

  private openPostCreateWarningModal(
    contractId: string,
    warnings: SupplyPointReentryWarning[],
    navigateAfterClose: boolean,
  ): void {
    this.pendingCreatedContractId = contractId;
    this.postCreateWarnings = warnings;
    this.navigateAfterPostCreateWarning = navigateAfterClose;
    this.isPostCreateWarningModalOpen = true;
  }

  private createContractAfterPreflight(
    payload: CreateMeoEnergiasContractRequest,
    preflightWarnings: SupplyPointReentryWarning[],
  ): void {
    this.isCreatingContract = true;

    this.isUploadingDocuments = false;

    this.errorMessage = '';
    this.successMessage = '';

    let createdContract: MeoEnergiasContractDetail | null = null;
    let creationWarnings: SupplyPointReentryWarning[] = [];

    this.meoEnergiasContractService
      .createMeoEnergiasContract(payload)
      .pipe(
        tap((contract) => {
          createdContract = contract;
          creationWarnings = getNewSupplyPointReentryWarnings(
            contract.warnings ?? [],
            preflightWarnings,
          );
        }),

        switchMap((contract) => {
          if (!this.selectedFiles.length) {
            return of(contract);
          }

          this.isUploadingDocuments = true;

          return this.meoEnergiasContractService
            .uploadAttachments(contract.id, this.selectedFiles)
            .pipe(
              tap(() => {
                this.isUploadingDocuments = false;
              }),

              catchError((error: HttpErrorResponse) => {
                this.isUploadingDocuments = false;

                this.errorMessage =
                  error?.error?.message ||
                  'O contrato foi criado, mas não foi possível carregar os documentos.';

                return EMPTY;
              }),
            );
        }),

        finalize(() => {
          this.isCreatingContract = false;

          this.isUploadingDocuments = false;
        }),
      )
      .subscribe({
        next: (contract) => {
          this.successMessage = this.selectedFiles.length
            ? 'Contrato e documentos criados com sucesso.'
            : 'Contrato criado com sucesso.';

          if (creationWarnings.length) {
            this.openPostCreateWarningModal(contract.id, creationWarnings, true);
            return;
          }

          this.router.navigate(['/home/contracts/meo-energias', contract.id]);
        },

        error: (error: HttpErrorResponse) => {
          this.errorMessage =
            error?.error?.details?.join(' ') ||
            error?.error?.message ||
            'Não foi possível criar o contrato Meo Energias.';
        },

        complete: () => {
          if (createdContract && this.errorMessage.includes('O contrato foi criado')) {
            this.successMessage = `Contrato ${createdContract.id} criado com sucesso.`;

            if (creationWarnings.length) {
              this.openPostCreateWarningModal(createdContract.id, creationWarnings, false);
            }
          }
        },
      });
  }

  private loadContractLayout(): void {
    this.contractLayout = this.preferencesService.getContractLayout();

    if (this.isLightLayout()) {
      this.contractForm.estado = 'Pedido de Chamada';
    }
  }

  private loadCampaigns(): void {
    this.campaignService
      .getCampaignsByCompanyId(MEO_ENERGIAS_COMPANY_ID)
      .pipe(map((campaigns) => campaigns.filter((campaign) => campaign.active)))
      .subscribe({
        next: (campaigns) => {
          this.campaigns = campaigns;
        },

        error: () => {
          this.errorMessage = 'Não foi possível carregar as campanhas.';
        },
      });
  }
  private loadAssignmentData(): void {
    const authenticatedUser = this.auth.getCurrentUser() as Partial<ProfileUser> | null;

    if (!authenticatedUser?.id) {
      this.assignmentErrorMessage = 'Não foi possível identificar o utilizador autenticado.';
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
            this.assignmentErrorMessage =
              'Não foi possível carregar os dados de atribuição do contrato.';
          }
          return;
        }

        this.assignmentErrorMessage = '';
        this.assignableUsers = state.users;

        const currentUser =
          state.users.find((user) => user.id === authenticatedUser.id) ?? null;

        if (!currentUser) {
          this.currentUser = null;
          this.assignmentErrorMessage =
            'Não foi possível localizar o utilizador autenticado entre os utilizadores atribuíveis.';
          return;
        }

        this.currentUser = currentUser;
        this.resolveInternalObservationsAccess(currentUser);

        if (!this.assignedUserId) {
          this.initializeAssignment(currentUser);
          return;
        }

        const selectedUser =
          state.users.find((user) => user.id === this.assignedUserId) ?? null;

        if (!selectedUser) {
          this.assignmentErrorMessage =
            'O responsável selecionado deixou de estar disponível. Foi reposto o utilizador atual.';
          this.initializeAssignment(currentUser);
          return;
        }

        this.refreshAssignmentFromCache(selectedUser);
      });
  }

  private refreshAssignmentFromCache(user: ProfileUser): void {
    const previousSelectedTeamIds = [...this.selectedTeamIds];
    const previousRegistrationTeamId = this.selectedRegistrationTeamId;

    this.availableTeams = this.resolveAssignableTeams(user);

    const availableTeamIds = new Set(this.availableTeams.map((team) => team.id));
    this.selectedTeamIds = previousSelectedTeamIds.filter((teamId) =>
      availableTeamIds.has(teamId),
    );

    if (!this.selectedTeamIds.length) {
      this.selectedTeamIds = this.resolveInitialTeamIds(user);
    }

    if (
      previousRegistrationTeamId &&
      availableTeamIds.has(previousRegistrationTeamId)
    ) {
      this.onRegistrationTeamChange(previousRegistrationTeamId);
    } else {
      this.syncRegistrationFields(user);
    }

    if (this.teamToAddId && !availableTeamIds.has(this.teamToAddId)) {
      this.teamToAddId = '';
    }
  }

  private resolveInternalObservationsAccess(user: ProfileUser): void {
    const authorizedTeamIds = this.getRequiredTeamIds();

    const userTeamIds =
      (user as ProfileUserWithTeamPositions).teams?.map((team) => team.id).filter(Boolean) ?? [];

    this.canAccessInternalObservations = userTeamIds.some((teamId) =>
      authorizedTeamIds.includes(teamId),
    );

    if (!this.canAccessInternalObservations) {
      this.contractForm.observacoesInternas = '';
    }
  }
  private loadAssignedUserTeams(userId: string): void {
    this.assignmentErrorMessage = '';
    this.availableTeams = [];
    this.selectedTeamIds = [];
    this.teamToAddId = '';
    this.selectedRegistrationTeamId = '';
    this.clearRegistrationFields();

    const selectedUser = this.assignableUsers.find((user) => user.id === userId) ?? null;

    if (!selectedUser) {
      this.assignmentErrorMessage =
        'O utilizador selecionado já não está disponível para atribuição.';
      return;
    }

    this.initializeAssignment(selectedUser, false);
  }


  private initializeAssignment(user: ProfileUser, updateAssignedUser = true): void {
    if (updateAssignedUser) {
      this.assignedUserId = user.id;
    }

    this.availableTeams = this.resolveAssignableTeams(user);

    this.selectedTeamIds = this.resolveInitialTeamIds(user);

    this.syncRegistrationFields(user);

    this.teamToAddId = '';
  }

  private resolveAssignableTeams(user: ProfileUser): AssignableContractTeam[] {
    const rawTeams = (user as ProfileUserWithTeamPositions).teams ?? [];

    return rawTeams
      .filter((team) => {
        return (
          Boolean(team?.id) &&
          Number.isInteger(team.positionIndex) &&
          team.positionIndex >= 0 &&
          team.active !== false
        );
      })
      .map((team) => ({
        id: team.id,
        name: team.name,

        registrationNumber: team.registrationNumber ?? null,

        positionIndex: team.positionIndex,

        position: team.position?.trim() || `Posição ${team.positionIndex}`,

        active: team.active,
      }));
  }

  private resolveInitialTeamIds(user: ProfileUser): string[] {
    const defaultTeamId = (user as ProfileUserWithTeamPositions).defaultTeam?.id;

    const initialTeamId =
      defaultTeamId && this.availableTeams.some((team) => team.id === defaultTeamId)
        ? defaultTeamId
        : this.availableTeams[0]?.id;

    return initialTeamId ? [initialTeamId] : [];
  }

  onRegistrationTeamChange(teamId: string): void {
    this.selectedRegistrationTeamId = teamId;

    const team = this.availableTeams.find((availableTeam) => availableTeam.id === teamId);

    if (!team) {
      this.clearRegistrationFields();
      return;
    }

    this.contractForm.codigoRegistoCE =
      team.registrationNumber !== null && team.registrationNumber !== undefined
        ? String(team.registrationNumber)
        : '';

    this.contractForm.nomeRegistoCE = team.name?.trim() ?? '';
  }

  private syncRegistrationFields(user: ProfileUser): void {
    const userWithTeams = user as ProfileUserWithTeamPositions;

    const defaultTeamId = userWithTeams.defaultTeam?.id;

    const initialTeamId =
      defaultTeamId && this.availableTeams.some((team) => team.id === defaultTeamId)
        ? defaultTeamId
        : (this.availableTeams[0]?.id ?? '');

    if (!initialTeamId) {
      this.clearRegistrationFields();
      return;
    }

    this.onRegistrationTeamChange(initialTeamId);
  }

  private clearRegistrationFields(): void {
    this.selectedRegistrationTeamId = '';

    this.contractForm.codigoRegistoCE = '';

    this.contractForm.nomeRegistoCE = '';
  }

  private getRequiredTeamIds(): string[] {
    return [environment.EQUIPA_CRM_ID, environment.EQUIPA_DU_ID].filter(
      (teamId): teamId is string => Boolean(teamId),
    );
  }

  private validateSelectedTeams(): string | null {
    const invalidTeamId = this.selectedTeamIds.find((teamId) => {
      const team = this.availableTeams.find((availableTeam) => availableTeam.id === teamId);

      return !team || !Number.isInteger(team.positionIndex) || team.positionIndex < 0;
    });

    if (invalidTeamId) {
      return 'Uma das equipas selecionadas não possui uma posição hierárquica válida para o utilizador atribuído.';
    }

    return null;
  }

  private resolveContractTeams(): MeoEnergiasContractTeamVisibility[] {
    const userTeams = this.selectedTeamIds
      .map((teamId) => this.availableTeams.find((team) => team.id === teamId))
      .filter((team): team is AssignableContractTeam => {
        if (!team) {
          return false;
        }

        return Number.isInteger(team.positionIndex) && team.positionIndex >= 0;
      })
      .map((team) => ({
        teamId: team.id,

        minimumPositionIndex: team.positionIndex,
      }));

    const existingTeamIds = new Set(userTeams.map((team) => team.teamId));

    const requiredTeams = this.getRequiredTeamIds()
      .filter((teamId) => !existingTeamIds.has(teamId))
      .map((teamId) => ({
        teamId,
        minimumPositionIndex: 0,
      }));

    return [...userTeams, ...requiredTeams];
  }

  private buildContractPayload(): CreateMeoEnergiasContractRequest {
    if (!this.client) {
      throw new Error('Cliente não identificado.');
    }

    if (!this.contractForm.telefone) {
      throw new Error('Telefone não preenchido.');
    }

    const campanha =
      this.campaignSelectionMode === 'other'
        ? this.customCampaign.trim()
        : this.contractForm.campanha;

    const estado: MeoEnergiasContractStatus = this.estadoOptions[0];

    const payload: CreateMeoEnergiasContractRequest = {
      companyId: MEO_ENERGIAS_COMPANY_ID,

      clientId: this.client.id,

      tipoSegmento: this.contractForm.tipoSegmento,

      tipoProduto: this.contractForm.tipoProduto,

      contratacao: this.contractForm.contratacao,

      estado,

      nomeClienteEmpresa: this.client.name,

      nif: this.client.nif,

      telefone: this.contractForm.telefone,

      campanha,

      userId: this.assignedUserId,

      teams: this.resolveContractTeams(),

      faturaEletronica: this.contractForm.faturaEletronica,

      debitoDireto: this.contractForm.debitoDireto,

      tarifaSocial: this.contractForm.tarifaSocial,
    };

    this.addIfFilled(payload, 'email', this.contractForm.email.trim());

    this.addIfFilled(payload, 'cae', this.contractForm.cae.trim());

    this.addIfFilled(payload, 'crc', this.contractForm.crc.trim());

    if (this.canManageQualityControl()) {
      this.addIfFilled(payload, 'controleQualidade', this.contractForm.controleQualidade.trim());
    }

    if (this.isLightLayout()) {
      const registration = resolveLightContractRegistration(
        this.selectedTeamIds,
        this.availableTeams,
        this.getRequiredTeamIds(),
      );

      payload.codigoRegistoCE = registration.codigoRegistoCE;
      payload.nomeRegistoCE = registration.nomeRegistoCE;
    } else {
      this.addIfFilled(payload, 'nomeRegistoCE', this.contractForm.nomeRegistoCE.trim());
      this.addIfFilled(payload, 'codigoRegistoCE', this.contractForm.codigoRegistoCE.trim());
    }

    this.addIfFilled(payload, 'agendamento', this.contractForm.agendamento);

    this.addIfFilled(payload, 'dataAssinatura', this.contractForm.dataAssinatura);

    this.addIfFilled(payload, 'dataContrato', this.contractForm.dataContrato);

    this.addIfFilled(payload, 'dataRegisto', this.contractForm.dataRegisto);

    this.addIfFilled(payload, 'moradaInstalacao', this.getMoradaInstalacao());

    this.addIfFilled(payload, 'moradaFaturacao', this.getMoradaFaturacao());

    this.addIfFilled(payload, 'iban', this.contractForm.iban.trim());

    this.addIfFilled(
      payload,
      'antigaComercializadora',
      this.contractForm.antigaComercializadora.trim(),
    );

    if (this.shouldShowLuzFields()) {
      this.addIfFilled(payload, 'tipoContratacaoLuz', this.contractForm.tipoContratacaoLuz);

      this.addIfFilled(payload, 'cpe', this.contractForm.cpe.trim());

      this.addIfFilled(payload, 'potencia', this.contractForm.potencia.trim());

      this.addIfFilled(payload, 'cicloHorario', this.contractForm.cicloHorario);

      this.addIfFilled(payload, 'nivelTensao', this.contractForm.nivelTensao);

      this.addIfFilled(payload, 'dataAtivacaoCPE', this.contractForm.dataAtivacaoCPE);

      this.addIfFilled(payload, 'dataBaixaCPE', this.contractForm.dataBaixaCPE);
    }

    if (this.shouldShowGasFields()) {
      this.addIfFilled(payload, 'tipoContratacaoGas', this.contractForm.tipoContratacaoGas);

      this.addIfFilled(payload, 'cui', this.contractForm.cui.trim());

      this.addIfFilled(payload, 'escalao', this.contractForm.escalao.trim());

      this.addIfFilled(payload, 'dataAtivacaoCUI', this.contractForm.dataAtivacaoCUI);

      this.addIfFilled(payload, 'dataBaixaCUI', this.contractForm.dataBaixaCUI);
    }

    this.addIfFilled(payload, 'observacoes', this.buildInitialObservation());

    if (this.canAccessInternalObservations) {
      this.addIfFilled(payload, 'observacoesInternas', this.buildInitialInternalObservation());
    }

    return payload;
  }

  shouldShowBillingAddress(): boolean {
    return this.contractForm.moradaFaturacaoSelecao === 'Outra';
  }

  private buildAddress(
    rua: string,
    cidade: string,
    distrito: string,
    codigoPostal: string,
    pais: string,
  ): string {
    return [rua, cidade, distrito, codigoPostal, pais]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(', ');
  }

  private getMoradaInstalacao(): string {
    return this.buildAddress(
      this.contractForm.moradaInstalacaoRua,
      this.contractForm.moradaInstalacaoCidade,
      this.contractForm.moradaInstalacaoDistrito,
      this.contractForm.moradaInstalacaoCodigoPostal,
      this.contractForm.moradaInstalacaoPais,
    );
  }

  private getMoradaFaturacao(): string {
    if (this.contractForm.moradaFaturacaoSelecao === 'Igual à de Instalação') {
      return this.getMoradaInstalacao();
    }

    return this.buildAddress(
      this.contractForm.moradaFaturacaoRua,
      this.contractForm.moradaFaturacaoCidade,
      this.contractForm.moradaFaturacaoDistrito,
      this.contractForm.moradaFaturacaoCodigoPostal,
      this.contractForm.moradaFaturacaoPais,
    );
  }

  private clearElectricityFields(): void {
    this.contractForm.tipoContratacaoLuz = '';

    this.contractForm.cpe = '';
    this.contractForm.potencia = '';
    this.contractForm.cicloHorario = '';
    this.contractForm.nivelTensao = '';

    this.contractForm.dataAtivacaoCPE = '';

    this.contractForm.dataBaixaCPE = '';
  }

  private clearGasFields(): void {
    this.contractForm.tipoContratacaoGas = '';

    this.contractForm.cui = '';
    this.contractForm.escalao = '';

    this.contractForm.dataAtivacaoCUI = '';

    this.contractForm.dataBaixaCUI = '';
  }

  private buildInitialObservation(): string {
    return this.buildInitialObservationEntry(this.contractForm.observacoes);
  }

  private buildInitialInternalObservation(): string {
    return this.buildInitialObservationEntry(this.contractForm.observacoesInternas);
  }

  private buildInitialObservationEntry(value: string): string {
    const normalizedValue = value
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!normalizedValue) {
      return '';
    }

    const userName = this.currentUser?.name ?? this.currentUser?.username ?? 'Utilizador';

    const timestamp = this.formatObservationTimestamp(new Date());

    return `${userName} - ${timestamp} - ${normalizedValue}`;
  }

  private formatObservationTimestamp(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');

    const month = String(date.getMonth() + 1).padStart(2, '0');

    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');

    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  private addIfFilled<Key extends keyof CreateMeoEnergiasContractRequest>(
    payload: CreateMeoEnergiasContractRequest,
    key: Key,
    value: CreateMeoEnergiasContractRequest[Key] | '' | null | undefined,
  ): void {
    if (value === null || value === undefined || value === '') {
      return;
    }

    payload[key] = value as CreateMeoEnergiasContractRequest[Key];
  }

  private getFileKey(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }
}
