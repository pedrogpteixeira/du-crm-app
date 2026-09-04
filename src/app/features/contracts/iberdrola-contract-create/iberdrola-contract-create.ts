import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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

import { Auth } from '../../../core/services/auth';

import {
  Campaign,
  CampaignService,
} from '../../../core/services/campaign';

import {
  Client,
  ClientService,
} from '../../../core/services/client';

import {
  ContractLayout,
  PreferencesService,
} from '../../../core/services/preferences';

import {
  ProfileUser,
  UserService,
} from '../../../core/services/user';

import {
  CreateIberdrolaContractRequest,
  IBERDROLA_COMPANY_ID,
  IBERDROLA_CONTRACT_STATUSES,
  IBERDROLA_GAS_LEVEL_SUGGESTIONS,
  IBERDROLA_POWER_SUGGESTIONS,
  IberdrolaCicloHorario,
  IberdrolaContractDetail,
  IberdrolaContractService,
  IberdrolaContractStatus,
  IberdrolaContractTeamVisibility,
  IberdrolaContratacao,
  IberdrolaNivelTensao,
  IberdrolaTipoContratacao,
  IberdrolaTipoProduto,
  IberdrolaTipoSegmento,
} from '../../../core/services/iberdrola-contract';

type MoradaFaturacaoSelecao =
  | 'Igual à de Instalação'
  | 'Outra';

interface AssignableContractTeam {
  id: string;
  name: string;
  registrationNumber: number | null;
  positionIndex: number;
  position: string;
  active?: boolean;
}


interface IberdrolaContractCreateForm {
  companyId: typeof IBERDROLA_COMPANY_ID;

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
  nomeRegistoCE: string;
  codigoRegistoCE: string;

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

  cartaoCidadao: string;
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
  sva: boolean;
  iban: string;

  campanha: string;

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

  observacoes: string;
  observacoesInternas: string;
}

interface ProfileUserWithTeamPositions
  extends ProfileUser {
  teams: AssignableContractTeam[];
  defaultTeam:
    | AssignableContractTeam
    | null;
}

@Component({
  selector: 'app-iberdrola-contract-create',
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl:
    './iberdrola-contract-create.html',
  changeDetection:
    ChangeDetectionStrategy.Eager,
  styleUrl:
    './iberdrola-contract-create.scss',
})
export class IberdrolaContractCreate
  implements OnInit
{
  private readonly clientService =
    inject(ClientService);

  private readonly campaignService =
    inject(CampaignService);

  private readonly iberdrolaContractService =
    inject(IberdrolaContractService);

  private readonly preferencesService =
    inject(PreferencesService);

  private readonly userService =
    inject(UserService);

  private readonly auth =
    inject(Auth);

  private readonly router =
    inject(Router);

  readonly iberdrolaCompanyId =
    IBERDROLA_COMPANY_ID;

  contractLayout:
    ContractLayout = 'light';

  nif: number | null = null;
  clientName = '';
  client: Client | null = null;

  campaigns: Campaign[] = [];

  currentUser:
    ProfileUser | null = null;

  assignableUsers:
    ProfileUser[] = [];

  availableTeams:
    AssignableContractTeam[] = [];

  assignedUserId = '';
  selectedTeamIds: string[] = [];
  teamToAddId = '';

  selectedRegistrationTeamId = '';

  isLoadingAssignment = false;
  assignmentErrorMessage = '';

  canAccessInternalObservations =
    false;

  selectedFiles: File[] = [];

  isCheckingClient = false;
  isCreatingClient = false;
  isCreatingContract = false;
  isUploadingDocuments = false;

  clientChecked = false;
  clientNotFound = false;

  errorMessage = '';
  successMessage = '';

  campaignSelectionMode:
    | 'existing'
    | 'other' = 'existing';

  customCampaign = '';

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

  readonly moradaFaturacaoOptions:
    MoradaFaturacaoSelecao[] = [
      'Igual à de Instalação',
      'Outra',
    ];

  contractForm: IberdrolaContractCreateForm = {
    companyId: IBERDROLA_COMPANY_ID,

    tipoSegmento: 'Residencial',
    tipoProduto: 'Luz + Gás',
    contratacao: 'Contratação Digital',

    tipoContratacaoLuz:
      'Mudança de Comercializadora',

    tipoContratacaoGas:
      'Mudança de Comercializadora',

    controleQualidade: '',
    nomeRegistoCE: '',
    codigoRegistoCE: '',

    estado: 'Pedido de Contratação',
    idVenda: '',

    agendamento: '',
    dataAssinatura: '',
    dataContrato: '',
    dataRegisto: '',
    dataAtivacaoCPE: '',
    dataBaixaCPE: '',
    dataAtivacaoCUI: '',
    dataBaixaCUI: '',

    cartaoCidadao: '',
    telefone: null,
    email: '',
    cae: '',
    crc: '',

    moradaFaturacaoSelecao:
      'Igual à de Instalação',

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
    sva: false,
    iban: '',

    campanha: '',

    antigaComercializadora: '',
    cpe: '',
    cui: '',
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
    return (
      this.contractLayout ===
      'light'
    );
  }

  isProLayout(): boolean {
    return (
      this.contractLayout ===
      'pro'
    );
  }

  isSuperAdmin(): boolean {
    return Boolean(
      this.currentUser?.role
        .includes('Super Admin'),
    );
  }

  canAssignOtherUsers(): boolean {
    if (this.isSuperAdmin()) {
      return true;
    }

    return (
      this.getManagedTeamIds()
        .length > 0
    );
  }

  get selectedTeams():
    AssignableContractTeam[] {
    return this.selectedTeamIds
      .map((teamId) =>
        this.availableTeams.find(
          (team) =>
            team.id === teamId,
        ),
      )
      .filter(
        (
          team,
        ): team is AssignableContractTeam =>
          Boolean(team),
      );
  }

  get teamsAvailableToAdd():
    AssignableContractTeam[] {
    return this.availableTeams
      .filter(
        (team) =>
          !this.selectedTeamIds
            .includes(team.id),
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

  onTipoProdutoChange(): void {
    if (!this.shouldShowLuzFields()) {
      this.clearElectricityFields();
    }

    if (!this.shouldShowGasFields()) {
      this.clearGasFields();
    }
  }

  shouldShowLuzFields(): boolean {
    return (
      this.contractForm
        .tipoProduto === 'Luz' ||
      this.contractForm
        .tipoProduto ===
        'Luz + Gás'
    );
  }

  shouldShowGasFields(): boolean {
    return (
      this.contractForm
        .tipoProduto === 'Gás' ||
      this.contractForm
        .tipoProduto ===
        'Luz + Gás'
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

  removeSelectedTeam(
    teamId: string,
  ): void {
    this.selectedTeamIds =
      this.selectedTeamIds.filter(
        (selectedTeamId) =>
          selectedTeamId !== teamId,
      );
  }

  isRequiredTeam(
    teamId: string,
  ): boolean {
    return this
      .getRequiredTeamIds()
      .includes(teamId);
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
          this.isCheckingClient =
            false;
        }),
      )
      .subscribe({
        next: (client) => {
          this.client = client;
          this.clientName =
            client.name;

          this.clientChecked = true;
          this.clientNotFound =
            false;

          /*
          this.successMessage =
            'Cliente encontrado.';
            */
        },

        error: (error) => {
          this.clientChecked = true;

          if (
            error?.status === 404
          ) {
            this.clientNotFound =
              true;

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

    if (this.isCreatingClient) {
      return;
    }

    this.isCreatingClient = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.clientService
      .createClient({
        name:
          this.clientName.trim(),
        nif: this.nif,
      })
      .pipe(
        finalize(() => {
          this.isCreatingClient =
            false;
        }),
      )
      .subscribe({
        next: (client) => {
          this.client = client;

          this.clientName =
            client.name;

          this.clientNotFound =
            false;

          this.clientChecked =
            true;

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

  formatFileSize(
    size: number,
  ): string {
    if (size < 1024) {
      return `${size} B`;
    }

    if (
      size <
      1024 * 1024
    ) {
      return `${(
        size / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      size /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  cancel(): void {
    if (
      this.isCreatingContract
    ) {
      return;
    }

    this.router.navigate([
      '/home/contracts/iberdrola',
    ]);
  }

  createContract(): void {
    if (
      this.isCreatingContract
    ) {
      return;
    }

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

    if (
      !this.contractForm
        .tipoSegmento
    ) {
      this.errorMessage =
        'O tipo de segmento é obrigatório.';
      return;
    }

    if (
      !this.contractForm
        .tipoProduto
    ) {
      this.errorMessage =
        'O tipo de produto é obrigatório.';
      return;
    }

    if (
      !this.contractForm
        .contratacao
    ) {
      this.errorMessage =
        'O tipo de contratação é obrigatório.';
      return;
    }

    if (
      !this.contractForm.telefone
    ) {
      this.errorMessage =
        'O telefone é obrigatório.';
      return;
    }

    if (
      this.contractForm
        .email.trim() &&
      !this.isValidEmail(
        this.contractForm.email,
      )
    ) {
      this.errorMessage =
        'Indica um email válido.';
      return;
    }

    const campaignIsMissing =
      this
        .campaignSelectionMode ===
      'existing'
        ? !this.contractForm
            .campanha
        : !this.customCampaign
            .trim();

    if (campaignIsMissing) {
      this.errorMessage =
        'É obrigatório selecionar ou indicar uma campanha.';
      return;
    }

    const teamValidationError =
      this.validateSelectedTeams();

    if (
      teamValidationError
    ) {
      this.errorMessage =
        teamValidationError;
      return;
    }

    if (this.isLightLayout()) {
      this.contractForm.estado =
        'Pedido de Contratação';
    }

    const payload =
      this.buildContractPayload();

    this.isCreatingContract =
      true;

    this.isUploadingDocuments =
      false;

    this.errorMessage = '';
    this.successMessage = '';

    let createdContract:
      IberdrolaContractDetail | null =
        null;

    this.iberdrolaContractService
      .createIberdrolaContract(
        payload,
      )
      .pipe(
        tap((contract) => {
          createdContract =
            contract;
        }),

        switchMap((contract) => {
          if (
            !this.selectedFiles
              .length
          ) {
            return of(contract);
          }

          this.isUploadingDocuments =
            true;

          return this
            .iberdrolaContractService
            .uploadAttachments(
              contract.id,
              this.selectedFiles,
            )
            .pipe(
              tap(() => {
                this.isUploadingDocuments =
                  false;
              }),

              catchError(
                (
                  error:
                    HttpErrorResponse,
                ) => {
                  this.isUploadingDocuments =
                    false;

                  this.errorMessage =
                    error?.error
                      ?.message ||
                    'O contrato foi criado, mas não foi possível carregar os documentos.';

                  return EMPTY;
                },
              ),
            );
        }),

        finalize(() => {
          this.isCreatingContract =
            false;

          this.isUploadingDocuments =
            false;
        }),
      )
      .subscribe({
        next: (contract) => {
          this.successMessage =
            this.selectedFiles
              .length
              ? 'Contrato e documentos criados com sucesso.'
              : 'Contrato criado com sucesso.';

          this.router.navigate([
            '/home/contracts/iberdrola',
            contract.id,
          ]);
        },

        error: (
          error:
            HttpErrorResponse,
        ) => {
          this.errorMessage =
            error?.error?.details
              ?.join(' ') ||
            error?.error?.message ||
            'Não foi possível criar o contrato Iberdrola.';
        },

        complete: () => {
          if (
            createdContract &&
            this.errorMessage
              .includes(
                'O contrato foi criado',
              )
          ) {
            this.successMessage =
              `Contrato ${createdContract.id} criado com sucesso.`;
          }
        },
      });
  }

  private loadContractLayout():
    void {
    this.contractLayout =
      this.preferencesService
        .getContractLayout();

    if (this.isLightLayout()) {
      this.contractForm.estado =
        'Pedido de Contratação';
    }
  }

  private loadCampaigns(): void {
    this.campaignService
      .getCampaignsByCompanyId(
        IBERDROLA_COMPANY_ID,
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
          this.campaigns =
            campaigns;
        },

        error: () => {
          this.errorMessage =
            'Não foi possível carregar as campanhas.';
        },
      });
  }

  private loadAssignmentData():
    void {
    const authenticatedUser =
      this.auth
        .getCurrentUser() as
        | Partial<ProfileUser>
        | null;

    if (
      !authenticatedUser?.id
    ) {
      this.assignmentErrorMessage =
        'Não foi possível identificar o utilizador autenticado.';
      return;
    }

    this.isLoadingAssignment =
      true;

    this.assignmentErrorMessage =
      '';

    this.userService
      .getUserById(
        authenticatedUser.id,
      )
      .pipe(
        switchMap(
          (currentUser) => {
            this.currentUser =
              currentUser;

            this.resolveInternalObservationsAccess(
              currentUser,
            );

            if (
              this.isSuperAdmin() ||
              this.getManagedTeamIds(
                currentUser,
              ).length > 0
            ) {
              return this
                .userService
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
              users: [
                currentUser,
              ],
            });
          },
        ),

        finalize(() => {
          this.isLoadingAssignment =
            false;
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
        (user) =>
          user.active,
      );

    if (this.isSuperAdmin()) {
      return activeUsers;
    }

    const managedTeamIds =
      this.getManagedTeamIds(
        currentUser,
      );

    if (
      !managedTeamIds.length
    ) {
      return activeUsers.filter(
        (user) =>
          user.id ===
          currentUser.id,
      );
    }

    const managedTeamIdSet =
      new Set(
        managedTeamIds,
      );

    return activeUsers.filter(
      (user) => {
        if (
          user.id ===
          currentUser.id
        ) {
          return true;
        }

        return this
          .getUserTeamIds(user)
          .some((teamId) =>
            managedTeamIdSet
              .has(teamId),
          );
      },
    );
  }

  private getManagedTeamIds(
    user:
      ProfileUser | null =
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
          .map(
            (team) =>
              team.id,
          )
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
        ?.map(
          (team) =>
            team.id,
        )
        .filter(Boolean) ??
      [];

    const defaultTeamId =
      typedUser.defaultTeam
        ?.id;

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
      | string
      | null
      | undefined,
  ): boolean {
    const normalizedPosition =
      (position ?? '')
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          '',
        )
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          '',
        );

    return (
      normalizedPosition
        .includes('admin') ||
      normalizedPosition
        .includes('backoffice') ||
      normalizedPosition
        .includes(
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
        user as
          ProfileUserWithTeamPositions
      ).teams
        ?.map(
          (team) =>
            team.id,
        )
        .filter(Boolean) ??
      [];

    this.canAccessInternalObservations =
      userTeamIds.some(
        (teamId) =>
          authorizedTeamIds
            .includes(teamId),
      );

    if (
      !this
        .canAccessInternalObservations
    ) {
      this.contractForm
        .observacoesInternas =
        '';
    }
  }

  private loadAssignedUserTeams(
    userId: string,
  ): void {
    this.isLoadingAssignment =
      true;

    this.assignmentErrorMessage =
      '';

    this.availableTeams = [];
    this.selectedTeamIds = [];
    this.teamToAddId = '';
    this.selectedRegistrationTeamId = '';
    this.clearRegistrationFields();

    this.userService
      .getUserById(userId)
      .pipe(
        finalize(() => {
          this.isLoadingAssignment =
            false;
        }),
      )
      .subscribe({
        next: (
          selectedUser,
        ) => {
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
      this.assignedUserId =
        user.id;
    }

    this.availableTeams =
      this.resolveAssignableTeams(
        user,
      );

    this.selectedTeamIds =
      this.resolveInitialTeamIds(
        user,
      );

    this.syncRegistrationFields(
      user,
    );

    this.teamToAddId = '';
  }

  private resolveAssignableTeams(
    user: ProfileUser,
  ): AssignableContractTeam[] {
    const rawTeams =
      (
        user as
          ProfileUserWithTeamPositions
      ).teams ?? [];

    return rawTeams
      .filter((team) => {
        return (
          Boolean(team?.id) &&
          Number.isInteger(
            team.positionIndex,
          ) &&
          team.positionIndex >=
            0 &&
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

  private resolveInitialTeamIds(
    user: ProfileUser,
  ): string[] {
    const defaultTeamId =
      (
        user as
          ProfileUserWithTeamPositions
      ).defaultTeam?.id;

    const initialTeamId =
      defaultTeamId &&
      this.availableTeams.some(
        (team) =>
          team.id ===
          defaultTeamId,
      )
        ? defaultTeamId
        : this.availableTeams[
            0
          ]?.id;

    return initialTeamId
      ? [initialTeamId]
      : [];
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

  private getRequiredTeamIds():
    string[] {
    return [
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
  }

  private validateSelectedTeams():
    string | null {
    const invalidTeamId =
      this.selectedTeamIds
        .find((teamId) => {
          const team =
            this.availableTeams
              .find(
                (
                  availableTeam,
                ) =>
                  availableTeam.id ===
                  teamId,
              );

          return (
            !team ||
            !Number.isInteger(
              team.positionIndex,
            ) ||
            team.positionIndex <
              0
          );
        });

    if (invalidTeamId) {
      return (
        'Uma das equipas selecionadas não possui uma posição hierárquica válida para o utilizador atribuído.'
      );
    }

    return null;
  }

  private resolveContractTeams():
    IberdrolaContractTeamVisibility[] {
    const userTeams =
      this.selectedTeamIds
        .map((teamId) =>
          this.availableTeams
            .find(
              (team) =>
                team.id ===
                teamId,
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
              team.positionIndex >=
                0
            );
          },
        )
        .map((team) => ({
          teamId: team.id,

          minimumPositionIndex:
            team.positionIndex,
        }));

    const existingTeamIds =
      new Set(
        userTeams.map(
          (team) =>
            team.teamId,
        ),
      );

    const requiredTeams =
      this.getRequiredTeamIds()
        .filter(
          (teamId) =>
            !existingTeamIds
              .has(teamId),
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

  private buildContractPayload():
    CreateIberdrolaContractRequest {
    if (!this.client) {
      throw new Error(
        'Cliente não identificado.',
      );
    }

    if (
      !this.contractForm.telefone
    ) {
      throw new Error(
        'Telefone não preenchido.',
      );
    }

    const campanha =
      this
        .campaignSelectionMode ===
      'other'
        ? this.customCampaign
            .trim()
        : this.contractForm
            .campanha;

    const estado:
      IberdrolaContractStatus =
        this.isLightLayout()
          ? 'Pedido de Contratação'
          : this.contractForm
              .estado;

    const payload:
      CreateIberdrolaContractRequest =
        {
          companyId:
            IBERDROLA_COMPANY_ID,

          clientId:
            this.client.id,

          tipoSegmento:
            this.contractForm
              .tipoSegmento,

          tipoProduto:
            this.contractForm
              .tipoProduto,

          contratacao:
            this.contractForm
              .contratacao,

          estado,

          nomeClienteEmpresa:
            this.client.name,

          nif:
            this.client.nif,

          telefone:
            this.contractForm
              .telefone,

          campanha,

          userId:
            this.assignedUserId,

          teams:
            this.resolveContractTeams(),

          faturaEletronica:
            this.contractForm
              .faturaEletronica,

          debitoDireto:
            this.contractForm
              .debitoDireto,

          sva:
            this.contractForm.sva,
        };

    this.addIfFilled(
      payload,
      'idVenda',
      this.contractForm.idVenda.trim(),
    );

    this.addIfFilled(
      payload,
      'email',
      this.contractForm
        .email.trim(),
    );

    this.addIfFilled(
      payload,
      'cartaoCidadao',
      this.contractForm
        .cartaoCidadao.trim(),
    );

    this.addIfFilled(
      payload,
      'cae',
      this.contractForm
        .cae.trim(),
    );

    this.addIfFilled(
      payload,
      'crc',
      this.contractForm
        .crc.trim(),
    );

    this.addIfFilled(
      payload,
      'controleQualidade',
      this.contractForm
        .controleQualidade.trim(),
    );

    this.addIfFilled(
      payload,
      'nomeRegistoCE',
      this.contractForm
        .nomeRegistoCE.trim(),
    );

    this.addIfFilled(
      payload,
      'codigoRegistoCE',
      this.contractForm
        .codigoRegistoCE.trim(),
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
      'iban',
      this.contractForm
        .iban.trim(),
    );

    this.addIfFilled(
      payload,
      'antigaComercializadora',
      this.contractForm
        .antigaComercializadora
        .trim(),
    );

    if (
      this.shouldShowLuzFields()
    ) {
      this.addIfFilled(
        payload,
        'tipoContratacaoLuz',
        this.contractForm
          .tipoContratacaoLuz,
      );

      this.addIfFilled(
        payload,
        'cpe',
        this.contractForm
          .cpe.trim(),
      );

      this.addIfFilled(
        payload,
        'potencia',
        this.contractForm
          .potencia.trim(),
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

      this.addIfFilled(
        payload,
        'cui',
        this.contractForm
          .cui.trim(),
      );

      this.addIfFilled(
        payload,
        'escalao',
        this.contractForm
          .escalao.trim(),
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
    }

    this.addIfFilled(
      payload,
      'observacoes',
      this.buildInitialObservation(),
    );

    if (
      this
        .canAccessInternalObservations
    ) {
      this.addIfFilled(
        payload,
        'observacoesInternas',
        this.buildInitialInternalObservation(),
      );
    }

    return payload;
  }


  shouldShowBillingAddress(): boolean {
    return (
      this.contractForm
        .moradaFaturacaoSelecao ===
      'Outra'
    );
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
      .map((value) => value.trim())
      .filter(Boolean)
      .join(', ');
  }

  private getMoradaInstalacao(): string {
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

  private getMoradaFaturacao(): string {
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

  private clearElectricityFields():
    void {
    this.contractForm
      .tipoContratacaoLuz = '';

    this.contractForm.cpe = '';
    this.contractForm.potencia = '';
    this.contractForm
      .cicloHorario = '';
    this.contractForm
      .nivelTensao = '';

    this.contractForm
      .dataAtivacaoCPE = '';

    this.contractForm
      .dataBaixaCPE = '';
  }

  private clearGasFields(): void {
    this.contractForm
      .tipoContratacaoGas = '';

    this.contractForm.cui = '';
    this.contractForm.escalao = '';

    this.contractForm
      .dataAtivacaoCUI = '';

    this.contractForm
      .dataBaixaCUI = '';
  }

  private buildInitialObservation():
    string {
    return this.buildInitialObservationEntry(
      this.contractForm
        .observacoes,
    );
  }

  private buildInitialInternalObservation():
    string {
    return this.buildInitialObservationEntry(
      this.contractForm
        .observacoesInternas,
    );
  }

  private buildInitialObservationEntry(
    value: string,
  ): string {
    const normalizedValue =
      value
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) =>
          line.trim(),
        )
        .filter(Boolean)
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    if (!normalizedValue) {
      return '';
    }

    const userName =
      this.currentUser?.name ??
      this.currentUser
        ?.username ??
      'Utilizador';

    const timestamp =
      this.formatObservationTimestamp(
        new Date(),
      );

    return `${userName} - ${timestamp} - ${normalizedValue}`;
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

  private addIfFilled<
    Key extends
      keyof CreateIberdrolaContractRequest,
  >(
    payload:
      CreateIberdrolaContractRequest,
    key: Key,
    value:
      CreateIberdrolaContractRequest[Key]
      | ''
      | null
      | undefined,
  ): void {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return;
    }

    payload[key] =
      value as
        CreateIberdrolaContractRequest[Key];
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
}
