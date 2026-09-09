import {
  canManageQualityControl as canManageQualityControlRole,
  QUALITY_CONTROL_BACKOFFICE_OPTIONS,
} from '../../../core/config/quality-control';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  EMPTY,
  catchError,
  finalize,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  DEFAULT_CPE_PREFIX,
  DEFAULT_CUI_PREFIX,
} from '../../../core/constants/contract-energy-options';

import { getContractEnergyValidationError } from '../../../core/utils/contract-energy-validation';

import {
  Client,
  ClientService,
} from '../../../core/services/client';

import {
  Campaign,
  CampaignService,
} from '../../../core/services/campaign';

import {
  GALP_POWER_GAS_STATUSES,
  CreateGalpPowerGasContractRequest,
  GalpPowerGasContractDetail,
  GalpPowerGasContractService,
  GalpPowerGasContractStatus,
  GalpPowerGasContractTeamVisibility,
} from '../../../core/services/galp-power-gas-contract';

import { Auth } from '../../../core/services/auth';

import {
  ProfileUser,
  UserService,
} from '../../../core/services/user';

import {
  ContractLayout,
  PreferencesService,
} from '../../../core/services/preferences';

import {
  ELECTRICITY_POWERS,
  GAS_LEVELS,
  OTHER_GAS_LEVEL,
  OTHER_POWER,
} from '../../../core/constants/energy';

type TipoSegmento =
  | 'Residencial'
  | 'Empresarial'
  | 'Condomínios';

type TipoProduto =
  | 'Luz'
  | 'Luz + Gás'
  | 'Gás';

type Contratacao =
  | 'Contratação Papel'
  | 'Contratação Digital';

type TipoContratacao =
  | 'Mudança de Comercializadora'
  | 'Mudança de Comercializadora & AT'
  | 'Entrada Direta';

type MoradaFaturacaoSelecao =
  | 'Igual à de Instalação'
  | 'Outra';

type ContractPowerSelection =
  | string
  | typeof OTHER_POWER;

interface AssignableContractTeam {
  id: string;
  name: string;
  registrationNumber: number | null;
  positionIndex: number;
  position: string;
  active?: boolean;
}

interface ProfileUserWithTeamPositions extends ProfileUser {
  teams: AssignableContractTeam[];
  defaultTeam: AssignableContractTeam | null;
}

import { FileDropzone } from '../../../shared/components/file-dropzone/file-dropzone';

@Component({
  selector: 'app-galp-power-gas-contract-create',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    FileDropzone,
  ],
  templateUrl: './galp-power-gas-contract-create.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './galp-power-gas-contract-create.scss',
})
export class GalpPowerGasContractCreate implements OnInit {
  readonly qualityControlBackofficeOptions =
    QUALITY_CONTROL_BACKOFFICE_OPTIONS;
  private readonly clientService =
    inject(ClientService);

  private readonly campaignService =
    inject(CampaignService);

  private readonly galpPowerGasContractService =
    inject(GalpPowerGasContractService);

  private readonly preferencesService =
    inject(PreferencesService);

  private readonly userService =
    inject(UserService);

  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

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
  isUploadingDocuments = false;

  clientChecked = false;
  clientNotFound = false;

  errorMessage = '';
  successMessage = '';

  readonly availablePowers =
    ELECTRICITY_POWERS;

  readonly otherPowerValue =
    OTHER_POWER;

  readonly availableGasLevels =
    GAS_LEVELS;

  readonly otherGasLevelValue =
    OTHER_GAS_LEVEL;

  customGasLevel: number | null = null;
  customPower: number | null = null;

  campaignSelectionMode:
    | 'existing'
    | 'other' = 'existing';

  customCampaign = '';

  tipoSegmentoOptions: TipoSegmento[] = [
    'Residencial',
    'Empresarial',
    'Condomínios',
  ];

  tipoProdutoOptions: TipoProduto[] = [
    'Luz',
    'Luz + Gás',
    'Gás',
  ];

  contratacaoOptions: Contratacao[] = [
    'Contratação Papel',
    'Contratação Digital',
  ];

  tipoContratacaoOptions: TipoContratacao[] = [
    'Mudança de Comercializadora',
    'Mudança de Comercializadora & AT',
    'Entrada Direta',
  ];

  estadoOptions: readonly GalpPowerGasContractStatus[] = GALP_POWER_GAS_STATUSES;

  cicloHorarioOptions = [
    'Simples',
    'Bi-Horário Diário',
    'Bi-Horário Semanal',
    'Tri-Horário Diário',
    'Tri-Horário Semanal',
    'Tetra-Horário',
  ];

  nivelTensaoOptions = [
    'Monofásico',
    'Trifásico',
  ];

  moradaFaturacaoOptions:
    MoradaFaturacaoSelecao[] = [
      'Igual à de Instalação',
      'Outra',
    ];

  contractForm = {
    companyId: environment.GALP_POWER_GAS_COMPANY_ID,

    tipoSegmento:
      'Empresarial' as TipoSegmento,

    tipoProduto:
      'Luz + Gás' as TipoProduto,

    contratacao:
      'Contratação Digital' as Contratacao,

    tipoContratacaoLuz:
      'Mudança de Comercializadora' as TipoContratacao,

    tipoContratacaoGas:
      'Mudança de Comercializadora' as TipoContratacao,

    controleQualidade: '',
    codigoRegistoCE: '',
    nomeRegistoCE: '',

    estado:
      'Pedido de chamada' as GalpPowerGasContractStatus,

    agendamento: '',
    dataAssinatura: '',
    dataContrato: '',
    dataRegisto: '',
    dataAtivacaoCPE: '',
    dataBaixaCPE: '',
    dataAtivacaoCUI: '',
    dataBaixaCUI: '',

    telefone: null as number | null,
    email: '',
    cae: '',
    crc: '',

    moradaFaturacaoSelecao:
      'Igual à de Instalação' as MoradaFaturacaoSelecao,

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
    sva: false,
    debitoDireto: false,
    iban: '',

    campanha: '',
    antigaComercializadora: '',
    cpe: DEFAULT_CPE_PREFIX,
    cui: DEFAULT_CUI_PREFIX,

    potencia:
      '' as ContractPowerSelection,

    escalao:
      null as number | typeof OTHER_GAS_LEVEL | null,

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
    return canManageQualityControlRole(
      this.currentUser?.role,
    );
  }

  isSuperAdmin(): boolean {
    return Boolean(
      this.currentUser?.role.includes(
        'Super Admin',
      ),
    );
  }

  canAssignOtherUsers(): boolean {
    if (this.isSuperAdmin()) {
      return true;
    }

    return (
      this.getManagedTeamIds().length > 0
    );
  }

  get selectedTeams(): AssignableContractTeam[] {
    return this.selectedTeamIds
      .map((teamId) =>
        this.availableTeams.find(
          (team) => team.id === teamId,
        ),
      )
      .filter(
        (
          team,
        ): team is AssignableContractTeam =>
          Boolean(team),
      );
  }

  get teamsAvailableToAdd(): AssignableContractTeam[] {
    return this.availableTeams.filter(
      (team) =>
        !this.selectedTeamIds.includes(
          team.id,
        ),
    );
  }

  onAssignedUserChange(): void {
    if (
      !this.canAssignOtherUsers() ||
      !this.assignedUserId
    ) {
      return;
    }

    this.clearRegistrationFields();

    this.loadAssignedUserTeams(
      this.assignedUserId,
    );
  }

  addSelectedTeam(): void {
    if (!this.teamToAddId) {
      return;
    }

    this.selectedTeamIds = [
      ...new Set([
        ...this.selectedTeamIds,
        this.teamToAddId,
      ]),
    ];

    this.teamToAddId = '';
  }

  removeSelectedTeam(teamId: string): void {
    this.selectedTeamIds =
      this.selectedTeamIds.filter(
        (selectedTeamId) =>
          selectedTeamId !== teamId,
      );
  }

  private loadContractLayout(): void {
    this.contractLayout =
      this.preferencesService.getContractLayout();

    if (this.isLightLayout()) {
      this.contractForm.estado =
        'Pedido de chamada';
    }
  }


  private loadAssignmentData(): void {
    const authenticatedUser =
      this.auth.getCurrentUser() as
        | Partial<ProfileUser>
        | null;

    if (!authenticatedUser?.id) {
      this.assignmentErrorMessage =
        'Não foi possível identificar o utilizador autenticado.';

      return;
    }

    this.isLoadingAssignment = true;
    this.assignmentErrorMessage = '';

    this.userService
      .getUserById(authenticatedUser.id)
      .pipe(
        switchMap((currentUser) => {
          this.currentUser = currentUser;
          this.resolveInternalObservationsAccess(currentUser);

          if (
            this.isSuperAdmin() ||
            this.getManagedTeamIds(
              currentUser,
            ).length > 0
          ) {
            return this.userService
              .getUsers()
              .pipe(
                map((users) => ({
                  currentUser,
                  users,
                })),
              );
          }

          return of({
            currentUser,
            users: [currentUser],
          });
        }),
        finalize(() => {
          this.isLoadingAssignment = false;
        }),
      )
      .subscribe({
        next: ({
          currentUser,
          users,
        }) => {
          this.assignableUsers =
            this.resolveAssignableUsers(
              currentUser,
              users,
            );

          this.initializeAssignment(
            currentUser,
          );
        },
        error: () => {
          this.assignmentErrorMessage =
            'Não foi possível carregar os dados de atribuição do contrato.';
        },
      });
  }

  private resolveAssignableUsers(
    currentUser: ProfileUser,
    users: ProfileUser[],
  ): ProfileUser[] {
    const activeUsers =
      users.filter(
        (user) => user.active,
      );

    if (this.isSuperAdmin()) {
      return activeUsers;
    }

    const managedTeamIds =
      this.getManagedTeamIds(
        currentUser,
      );

    if (!managedTeamIds.length) {
      return activeUsers.filter(
        (user) =>
          user.id === currentUser.id,
      );
    }

    const managedTeamIdSet =
      new Set(managedTeamIds);

    return activeUsers.filter(
      (user) => {
        if (
          user.id === currentUser.id
        ) {
          return true;
        }

        return this.getUserTeamIds(
          user,
        ).some((teamId) =>
          managedTeamIdSet.has(teamId),
        );
      },
    );
  }

  private getManagedTeamIds(
    user: ProfileUser | null =
      this.currentUser,
  ): string[] {
    if (!user) {
      return [];
    }

    const teams =
      (
        user as
          ProfileUserWithTeamPositions
      ).teams ?? [];

    return [
      ...new Set(
        teams
          .filter((team) =>
            this.isAssignmentManagerPosition(
              team.position,
            ),
          )
          .map((team) => team.id)
          .filter(Boolean),
      ),
    ];
  }

  private getUserTeamIds(
    user: ProfileUser,
  ): string[] {
    const typedUser =
      user as
        ProfileUserWithTeamPositions;

    const teamIds =
      typedUser.teams
        ?.map((team) => team.id)
        .filter(Boolean) ?? [];

    const defaultTeamId =
      typedUser.defaultTeam?.id;

    return [
      ...new Set([
        ...teamIds,
        ...(defaultTeamId
          ? [defaultTeamId]
          : []),
      ]),
    ];
  }

  private isAssignmentManagerPosition(
    position:
      string |
      null |
      undefined,
  ): boolean {
    const normalizedPosition =
      (position ?? '')
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          '',
        )
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    return (
      normalizedPosition.includes(
        'admin',
      ) ||
      normalizedPosition.includes(
        'backoffice',
      ) ||
      normalizedPosition.includes(
        'coordenador',
      )
    );
  }

  private resolveInternalObservationsAccess(
    user: ProfileUser,
  ): void {
    const authorizedTeamIds =
      this.getRequiredTeamIds();

    const userTeamIds =
      (
        user as ProfileUserWithTeamPositions
      ).teams
        ?.map((team) => team.id)
        .filter(Boolean) ?? [];

    this.canAccessInternalObservations =
      userTeamIds.some((teamId) =>
        authorizedTeamIds.includes(teamId),
      );

    if (!this.canAccessInternalObservations) {
      this.contractForm.observacoesInternas = '';
    }
  }

  private loadAssignedUserTeams(
    userId: string,
  ): void {
    this.isLoadingAssignment = true;
    this.assignmentErrorMessage = '';
    this.availableTeams = [];
    this.selectedTeamIds = [];
    this.teamToAddId = '';
    this.selectedRegistrationTeamId = '';
    this.clearRegistrationFields();

    this.userService
      .getUserById(userId)
      .pipe(
        finalize(() => {
          this.isLoadingAssignment = false;
        }),
      )
      .subscribe({
        next: (selectedUser) => {
          this.initializeAssignment(
            selectedUser,
            false,
          );
        },
        error: () => {
          this.assignmentErrorMessage =
            'Não foi possível carregar as equipas e posições do utilizador selecionado.';
        },
      });
  }

  private initializeAssignment(
    user: ProfileUser,
    updateAssignedUser = true,
  ): void {
    if (updateAssignedUser) {
      this.assignedUserId = user.id;
    }

    this.availableTeams =
      this.resolveAssignableTeams(user);

    this.selectedTeamIds =
      this.resolveInitialTeamIds(user);

    this.syncRegistrationFields(user);

    this.teamToAddId = '';
  }

  private resolveAssignableTeams(
    user: ProfileUser,
  ): AssignableContractTeam[] {
    const rawTeams =
      (
        user as ProfileUserWithTeamPositions
      ).teams ?? [];

    return rawTeams
      .filter((team) => {
        return (
          Boolean(team?.id) &&
          Number.isInteger(
            team.positionIndex,
          ) &&
          team.positionIndex >= 0 &&
          team.active !== false
        );
      })
      .map((team) => ({
        id: team.id,
        name: team.name,
        registrationNumber:
          team.registrationNumber ??
          null,
        positionIndex:
          team.positionIndex,
        position:
          team.position?.trim() ||
          `Posição ${team.positionIndex}`,
        active: team.active,
      }));
  }

  onRegistrationTeamChange(
    teamId: string,
  ): void {
    this.selectedRegistrationTeamId =
      teamId;

    const team =
      this.availableTeams.find(
        (availableTeam) =>
          availableTeam.id === teamId,
      );

    if (!team) {
      this.clearRegistrationFields();
      return;
    }

    this.contractForm.codigoRegistoCE =
      team.registrationNumber !== null &&
      team.registrationNumber !== undefined
        ? String(team.registrationNumber)
        : '';

    this.contractForm.nomeRegistoCE =
      team.name?.trim() ?? '';
  }

  private syncRegistrationFields(
    user: ProfileUser,
  ): void {
    const userWithTeams =
      user as ProfileUserWithTeamPositions;

    const defaultTeamId =
      userWithTeams.defaultTeam?.id;

    const initialTeamId =
      defaultTeamId &&
      this.availableTeams.some(
        (team) =>
          team.id === defaultTeamId,
      )
        ? defaultTeamId
        : this.availableTeams[0]?.id ?? '';

    if (!initialTeamId) {
      this.clearRegistrationFields();
      return;
    }

    this.onRegistrationTeamChange(
      initialTeamId,
    );
  }

  private clearRegistrationFields(): void {
    this.selectedRegistrationTeamId = '';

    this.contractForm.codigoRegistoCE =
      '';

    this.contractForm.nomeRegistoCE =
      '';
  }

  private resolveInitialTeamIds(
    user: ProfileUser,
  ): string[] {
    const defaultTeamId =
      (
        user as ProfileUserWithTeamPositions
      ).defaultTeam?.id;

    const initialTeamId =
      defaultTeamId &&
      this.availableTeams.some(
        (team) =>
          team.id === defaultTeamId,
      )
        ? defaultTeamId
        : this.availableTeams[0]?.id;

    return initialTeamId
      ? [initialTeamId]
      : [];
  }

  private getRequiredTeamIds(): string[] {
    return [
      environment.EQUIPA_CRM_ID,
      environment.EQUIPA_DU_ID,
    ].filter(
      (teamId): teamId is string =>
        Boolean(teamId),
    );
  }

  isRequiredTeam(
    teamId: string,
  ): boolean {
    return this.getRequiredTeamIds()
      .includes(teamId);
  }

  private validateSelectedTeams():
    string | null {
    const invalidTeamId =
      this.selectedTeamIds.find(
        (teamId) => {
          const team =
            this.availableTeams.find(
              (availableTeam) =>
                availableTeam.id ===
                teamId,
            );

          return (
            !team ||
            !Number.isInteger(
              team.positionIndex,
            ) ||
            team.positionIndex < 0
          );
        },
      );

    if (invalidTeamId) {
      return (
        'Uma das equipas selecionadas não possui uma posição hierárquica válida para o utilizador atribuído.'
      );
    }

    return null;
  }

  private resolveContractTeams():
    GalpPowerGasContractTeamVisibility[] {
    const userTeams =
      this.selectedTeamIds
        .map((teamId) =>
          this.availableTeams.find(
            (team) =>
              team.id === teamId,
          ),
        )
        .filter(
          (
            team,
          ): team is AssignableContractTeam => {
            if (!team) {
              return false;
            }

            return (
              Number.isInteger(
                team.positionIndex,
              ) &&
              team.positionIndex >= 0
            );
          },
        )
        .map((team) => ({
          teamId: team.id,
          minimumPositionIndex:
            team.positionIndex,
        }));

    const existingTeamIds = new Set(
      userTeams.map(
        (team) => team.teamId,
      ),
    );

    const requiredTeams =
      this.getRequiredTeamIds()
        .filter(
          (teamId) =>
            !existingTeamIds.has(teamId),
        )
        .map((teamId) => ({
          teamId,
          minimumPositionIndex: 0,
        }));

    return [
      ...userTeams,
      ...requiredTeams,
    ];
  }

  private loadCampaigns(): void {
    this.campaignService
      .getCampaignsByCompanyId(
        environment.GALP_POWER_GAS_COMPANY_ID,
      )
      .pipe(
        map((campaigns) =>
          campaigns.filter(
            (campaign) =>
              campaign.active,
          ),
        ),
      )
      .subscribe({
        next: (campaigns) => {
          this.campaigns = campaigns;
        },

        error: () => {
          this.errorMessage =
            'Não foi possível carregar as campanhas.';
        },
      });
  }

  checkClientByNif(): void {
    if (!this.nif) {
      this.errorMessage =
        'O NIF é obrigatório.';

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

          this.errorMessage =
            'Não foi possível verificar o cliente.';
        },
      });
  }

  createClient(): void {
    if (
      !this.nif ||
      !this.clientName.trim()
    ) {
      this.errorMessage =
        'O NIF e o nome do cliente são obrigatórios.';

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

          this.successMessage =
            'Cliente criado com sucesso.';
        },

        error: () => {
          this.errorMessage =
            'Não foi possível criar o cliente.';
        },
      });
  }

  onFilesSelected(
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    const files =
      input.files
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

  formatFileSize(
    size: number,
  ): string {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(
        size / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      size /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  createContract(): void {
    if (!this.client) {
      this.errorMessage =
        'É necessário identificar ou criar o cliente.';

      return;
    }

    if (!this.currentUser?.id) {
      this.errorMessage =
        'Não foi possível identificar o utilizador autenticado.';

      return;
    }

    if (!this.assignedUserId) {
      this.errorMessage =
        'É obrigatório selecionar o utilizador atribuído.';

      return;
    }

    if (!this.contractForm.telefone) {
      this.errorMessage =
        'O telefone é obrigatório.';

      return;
    }


    if (this.isProLayout()) {
      const energyValidationError =
        getContractEnergyValidationError({
          requiresElectricity:
            this.shouldShowLuzFields(),
          requiresGas:
            this.shouldShowGasFields(),
          cpe: this.contractForm.cpe,
          cui: this.contractForm.cui,
          potencia:
            this.getContractPowerValue(),
          escalao:
            this.contractForm.escalao ===
            OTHER_GAS_LEVEL
              ? this.customGasLevel
              : this.contractForm.escalao,
          cicloHorario:
            this.contractForm.cicloHorario,
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
      this.errorMessage =
        'É obrigatório selecionar ou indicar uma campanha.';

      return;
    }

    const teamValidationError =
      this.validateSelectedTeams();

    if (teamValidationError) {
      this.errorMessage =
        teamValidationError;

      return;
    }

    if (this.isLightLayout()) {
      this.contractForm.estado =
        'Pedido de chamada';
    }

    const payload =
      this.buildContractPayload();

    this.isCreatingContract = true;
    this.isUploadingDocuments = false;
    this.errorMessage = '';
    this.successMessage = '';

    let createdContract:
      GalpPowerGasContractDetail | null = null;

    this.galpPowerGasContractService
      .createGalpPowerGasContract(payload)
      .pipe(
        tap((contract) => {
          createdContract = contract;
        }),

        switchMap((contract) => {
          if (
            !this.selectedFiles.length
          ) {
            return of(contract);
          }

          this.isUploadingDocuments =
            true;

          return this.galpPowerGasContractService
            .uploadAttachments(
              contract.id,
              this.selectedFiles,
            )
            .pipe(
              tap(() => {
                this.isUploadingDocuments =
                  false;
              }),

              catchError((error) => {
                this.isUploadingDocuments =
                  false;

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
          this.successMessage =
            this.selectedFiles.length
              ? 'Contrato e documentos criados com sucesso.'
              : 'Contrato criado com sucesso.';

          this.router.navigate([
            '/home/contracts/galp-power-gas',
            contract.id,
          ]);
        },

        error: (error) => {
          this.errorMessage =
            error?.error?.details?.join(
              ' ',
            ) ||
            error?.error?.message ||
            'Não foi possível criar o contrato Galp Power & Gás.';
        },

        complete: () => {
          if (
            createdContract &&
            this.errorMessage.includes(
              'O contrato foi criado',
            )
          ) {
            this.successMessage =
              `Contrato ${createdContract.id} criado com sucesso.`;
          }
        },
      });
  }

  onTipoProdutoChange(): void {
    if (this.shouldShowLuzFields()) {
      if (!this.contractForm.cpe.trim()) {
        this.contractForm.cpe = DEFAULT_CPE_PREFIX;
      }
    } else {
      this.contractForm.cpe = '';
      this.contractForm.potencia = '';
      this.contractForm.cicloHorario = '';
      this.contractForm.nivelTensao = '';
      this.customPower = null;
    }

    if (this.shouldShowGasFields()) {
      if (!this.contractForm.cui.trim()) {
        this.contractForm.cui = DEFAULT_CUI_PREFIX;
      }
    } else {
      this.contractForm.cui = '';
      this.contractForm.escalao = null;
      this.customGasLevel = null;
    }
  }

  shouldShowLuzFields(): boolean {
    return (
      this.contractForm
        .tipoProduto === 'Luz' ||
      this.contractForm
        .tipoProduto === 'Luz + Gás'
    );
  }

  shouldShowGasFields(): boolean {
    return (
      this.contractForm
        .tipoProduto === 'Gás' ||
      this.contractForm
        .tipoProduto === 'Luz + Gás'
    );
  }

  shouldShowBillingAddress(): boolean {
    return (
      this.contractForm
        .moradaFaturacaoSelecao ===
      'Outra'
    );
  }

  formatPowerValue(
    power: number,
  ): string {
    return power.toFixed(2);
  }

  private buildContractPayload():
    CreateGalpPowerGasContractRequest {
    if (!this.client) {
      throw new Error(
        'Cliente não identificado.',
      );
    }


    const estado:
      GalpPowerGasContractStatus =
        this.isLightLayout()
          ? 'Pedido de chamada'
          : this.contractForm.estado;

    const payload:
      CreateGalpPowerGasContractRequest = {
        clientId: this.client.id,
        companyId:
          this.contractForm.companyId,

        nomeClienteEmpresa:
          this.client.name,

        nif: this.client.nif,

        userId: this.assignedUserId,

        teams:
          this.resolveContractTeams(),

        estado,
      };

    this.addSharedFields(payload);

    if (this.isProLayout()) {
      this.addProFields(payload);
    }

    return payload;
  }

  private addSharedFields(
    payload:
      CreateGalpPowerGasContractRequest,
  ): void {
    this.addIfFilled(
      payload,
      'tipoSegmento',
      this.contractForm
        .tipoSegmento,
    );

    this.addIfFilled(
      payload,
      'tipoProduto',
      this.contractForm
        .tipoProduto,
    );

    this.addIfFilled(
      payload,
      'contratacao',
      this.contractForm
        .contratacao,
    );

    this.addIfFilled(
      payload,
      'agendamento',
      this.contractForm
        .agendamento,
    );

    this.addIfFilled(
      payload,
      'dataAssinatura',
      this.contractForm
        .dataAssinatura,
    );

    this.addIfFilled(
      payload,
      'telefone',
      this.contractForm.telefone,
    );

    this.addBoolean(
      payload,
      'faturaEletronica',
      this.contractForm
        .faturaEletronica,
    );

    this.addBoolean(
      payload,
      'sva',
      this.contractForm.sva,
    );

    this.addBoolean(
      payload,
      'debitoDireto',
      this.contractForm
        .debitoDireto,
    );

    this.addIfFilled(
      payload,
      'iban',
      this.contractForm.iban
        .trim(),
    );

    const campaign =
      this.campaignSelectionMode ===
      'other'
        ? this.customCampaign.trim()
        : this.contractForm
            .campanha;

    this.addIfFilled(
      payload,
      'campanha',
      campaign,
    );

    this.addIfFilled(
      payload,
      'observacoes',
      this.buildInitialObservation(),
    );

    if (this.canAccessInternalObservations) {
      this.addIfFilled(
        payload,
        'observacoesInternas',
        this.buildInitialInternalObservation(),
      );
    }
  }

  private buildInitialObservation(): string {
    return this.buildFormattedObservation(
      this.contractForm.observacoes,
    );
  }

  private buildInitialInternalObservation(): string {
    return this.buildFormattedObservation(
      this.contractForm.observacoesInternas,
    );
  }

  private buildFormattedObservation(
    value: string,
  ): string {
    const message =
      value
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    if (!message) {
      return '';
    }

    const userName =
      this.currentUser?.name?.trim() ||
      'Utilizador';

    const formattedDate =
      this.formatObservationDate(
        new Date(),
      );

    return `${userName} - ${formattedDate} - ${message}`;
  }

  private formatObservationDate(
    date: Date,
  ): string {
    const day =
      String(date.getDate()).padStart(
        2,
        '0',
      );

    const month =
      String(date.getMonth() + 1).padStart(
        2,
        '0',
      );

    const year = date.getFullYear();

    const hours =
      String(date.getHours()).padStart(
        2,
        '0',
      );

    const minutes =
      String(date.getMinutes()).padStart(
        2,
        '0',
      );

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  private addProFields(
    payload:
      CreateGalpPowerGasContractRequest,
  ): void {
    if (
      this.shouldShowLuzFields()
    ) {
      this.addIfFilled(
        payload,
        'tipoContratacaoLuz',
        this.contractForm
          .tipoContratacaoLuz,
      );
    }

    if (
      this.shouldShowGasFields()
    ) {
      this.addIfFilled(
        payload,
        'tipoContratacaoGas',
        this.contractForm
          .tipoContratacaoGas,
      );
    }


    if (this.canManageQualityControl()) {
      this.addIfFilled(
        payload,
        'controleQualidade',
        this.contractForm
          .controleQualidade,
      );
    }

    this.addIfFilled(
      payload,
      'codigoRegistoCE',
      this.contractForm
        .codigoRegistoCE,
    );

    this.addIfFilled(
      payload,
      'nomeRegistoCE',
      this.contractForm
        .nomeRegistoCE,
    );

    this.addIfFilled(
      payload,
      'dataContrato',
      this.contractForm
        .dataContrato,
    );

    this.addIfFilled(
      payload,
      'dataRegisto',
      this.contractForm
        .dataRegisto,
    );

    this.addIfFilled(
      payload,
      'dataAtivacaoCPE',
      this.contractForm
        .dataAtivacaoCPE,
    );

    this.addIfFilled(
      payload,
      'dataBaixaCPE',
      this.contractForm
        .dataBaixaCPE,
    );

    this.addIfFilled(
      payload,
      'dataAtivacaoCUI',
      this.contractForm
        .dataAtivacaoCUI,
    );

    this.addIfFilled(
      payload,
      'dataBaixaCUI',
      this.contractForm
        .dataBaixaCUI,
    );

    this.addIfFilled(
      payload,
      'email',
      this.contractForm.email,
    );

    this.addIfFilled(
      payload,
      'cae',
      this.contractForm.cae,
    );

    this.addIfFilled(
      payload,
      'crc',
      this.contractForm.crc,
    );

    this.addIfFilled(
      payload,
      'moradaInstalacao',
      this.getMoradaInstalacao(),
    );

    this.addIfFilled(
      payload,
      'moradaFaturacao',
      this.getMoradaFaturacao(),
    );

    this.addIfFilled(
      payload,
      'antigaComercializadora',
      this.contractForm
        .antigaComercializadora,
    );

    this.addIfFilled(
      payload,
      'cpe',
      this.contractForm.cpe,
    );

    this.addIfFilled(
      payload,
      'cui',
      this.contractForm.cui,
    );

    this.addIfFilled(
      payload,
      'potencia',
      this.getContractPowerValue(),
    );

    const gasLevel =
      this.contractForm.escalao ===
      OTHER_GAS_LEVEL
        ? this.customGasLevel
        : this.contractForm
            .escalao;

    this.addIfFilled(
      payload,
      'escalao',
      gasLevel,
    );

    this.addIfFilled(
      payload,
      'cicloHorario',
      this.contractForm
        .cicloHorario,
    );

    this.addIfFilled(
      payload,
      'nivelTensao',
      this.contractForm
        .nivelTensao,
    );
  }

  private getContractPowerValue():
    | string
    | number
    | null {
    if (
      this.contractForm.potencia ===
      OTHER_POWER
    ) {
      return this.customPower;
    }

    return this.contractForm
      .potencia;
  }

  private buildAddress(
    rua: string,
    cidade: string,
    distrito: string,
    codigoPostal: string,
    pais: string,
  ): string {
    return [
      rua,
      cidade,
      distrito,
      codigoPostal,
      pais,
    ]
      .map((value) =>
        value.trim(),
      )
      .filter(Boolean)
      .join(', ');
  }

  private getMoradaInstalacao():
    string {
    return this.buildAddress(
      this.contractForm
        .moradaInstalacaoRua,

      this.contractForm
        .moradaInstalacaoCidade,

      this.contractForm
        .moradaInstalacaoDistrito,

      this.contractForm
        .moradaInstalacaoCodigoPostal,

      this.contractForm
        .moradaInstalacaoPais,
    );
  }

  private getMoradaFaturacao():
    string {
    if (
      this.contractForm
        .moradaFaturacaoSelecao ===
      'Igual à de Instalação'
    ) {
      return this.getMoradaInstalacao();
    }

    return this.buildAddress(
      this.contractForm
        .moradaFaturacaoRua,

      this.contractForm
        .moradaFaturacaoCidade,

      this.contractForm
        .moradaFaturacaoDistrito,

      this.contractForm
        .moradaFaturacaoCodigoPostal,

      this.contractForm
        .moradaFaturacaoPais,
    );
  }

  private addIfFilled<
    T extends object,
  >(
    payload: T,
    key: keyof T,
    value: unknown,
  ): void {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return;
    }

    (
      payload as Record<
        string,
        unknown
      >
    )[key as string] = value;
  }

  private addBoolean<
    T extends object,
  >(
    payload: T,
    key: keyof T,
    value: boolean,
  ): void {
    (
      payload as Record<
        string,
        unknown
      >
    )[key as string] = value;
  }

  private getFileKey(
    file: File,
  ): string {
    return [
      file.name,
      file.size,
      file.lastModified,
    ].join('-');
  }
}