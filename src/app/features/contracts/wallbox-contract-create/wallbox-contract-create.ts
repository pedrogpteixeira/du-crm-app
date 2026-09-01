import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
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

import {
  Client,
  ClientService,
} from '../../../core/services/client';

import {
  Campaign,
  CampaignService,
} from '../../../core/services/campaign';

import {
  CreateWallboxContractRequest,
  WallboxContractCreateResponse,
  WallboxContractService,
} from '../../../core/services/wallbox-contract';

import { Auth } from '../../../core/services/auth';

import {
  ProfileUser,
  UserService,
} from '../../../core/services/user';

import {
  ContractLayout,
  PreferencesService,
} from '../../../core/services/preferences';

const WALLBOX_COMPANY_ID = 'cmp_StOnumtpT5' as const;

type WallboxTipoSegmento =
  | 'residencial'
  | 'empresarial';

type WallboxTipoProduto =
  | 'Luz'
  | 'Luz + Gás'
  | 'Gás';

type WallboxContractStatus =
  | 'Pedido de Chamada'
  | 'Registo Plataforma Galp'
  | 'Não conformidade'
  | 'Em Ativação'
  | 'Ativo'
  | 'Anulado';

type WallboxNivelTensao =
  | 'Manter'
  | 'Monofásico'
  | 'Trifásico';

type WallboxTipoLocalInstalacao =
  | 'Moradia'
  | 'Condomínio Ligação a QE comum'
  | 'Condomínio Ligação a QE cliente';

type WallboxMetodoPagamento =
  | 'Pronto Pagamento'
  | 'Pagamento em Prestações';

interface WallboxContractTeamVisibility {
  teamId: string;
  minimumPositionIndex: number;
}

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

interface SegmentOption {
  value: WallboxTipoSegmento;
  label: string;
}

@Component({
  selector: 'app-wallbox-contract-create',
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl: './wallbox-contract-create.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './wallbox-contract-create.scss',
})
export class WallboxContractCreate implements OnInit {
  private readonly clientService =
    inject(ClientService);

  private readonly campaignService =
    inject(CampaignService);

  private readonly wallboxContractService =
    inject(WallboxContractService);

  private readonly preferencesService =
    inject(PreferencesService);

  private readonly userService =
    inject(UserService);

  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly wallboxCompanyId = WALLBOX_COMPANY_ID;

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

  campaignSelectionMode:
    | 'existing'
    | 'other' = 'existing';

  customCampaign = '';

  readonly tipoSegmentoOptions: SegmentOption[] = [
    {
      value: 'residencial',
      label: 'Residencial',
    },
    {
      value: 'empresarial',
      label: 'Empresarial',
    },
  ];

  readonly tipoProdutoOptions: WallboxTipoProduto[] = [
    'Luz',
    'Luz + Gás',
    'Gás',
  ];

  readonly estadoOptions: WallboxContractStatus[] = [
    'Pedido de Chamada',
    'Registo Plataforma Galp',
    'Não conformidade',
    'Em Ativação',
    'Ativo',
    'Anulado',
  ];

  readonly nivelTensaoOptions: WallboxNivelTensao[] = [
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

  contractForm = {
    companyId: WALLBOX_COMPANY_ID,

    tipoSegmento:
      'residencial' as WallboxTipoSegmento,

    tipoProduto:
      'Luz' as WallboxTipoProduto,

    estado:
      'Pedido de Chamada' as WallboxContractStatus,

    telefone: null as number | null,
    email: '',
    moradaInstalacao: '',

    campanha: '',

    nivelTensao:
      '' as WallboxNivelTensao | '',

    tipoLocalInstalacao:
      '' as WallboxTipoLocalInstalacao | '',

    metodoPagamento:
      '' as WallboxMetodoPagamento | '',

    comDeslocacao: false,
    balanceamentoPotencia: false,

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

    return this.getManagedTeamIds().length > 0;
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

  isRequiredTeam(teamId: string): boolean {
    return this.getRequiredTeamIds()
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
          this.isCheckingClient = false;
        }),
      )
      .subscribe({
        next: (client) => {
          this.client = client;
          this.clientName = client.name;
          this.clientChecked = true;
          this.clientNotFound = false;

          this.successMessage =
            'Cliente encontrado.';
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

          this.successMessage =
            'Cliente criado com sucesso.';
        },
        error: () => {
          this.errorMessage =
            'Não foi possível criar o cliente.';
        },
      });
  }

  onFilesSelected(event: Event): void {
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
          (file) => this.getFileKey(file),
        ),
      );

    const newFiles = files.filter(
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

  removeSelectedFile(index: number): void {
    this.selectedFiles =
      this.selectedFiles.filter(
        (_, fileIndex) =>
          fileIndex !== index,
      );
  }

  clearSelectedFiles(): void {
    this.selectedFiles = [];
  }

  formatFileSize(size: number): string {
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

  cancel(): void {
    if (this.isCreatingContract) {
      return;
    }

    this.router.navigate([
      '/home/contracts/wallbox',
    ]);
  }

  createContract(): void {
    if (this.isCreatingContract) {
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

    if (!this.contractForm.tipoSegmento) {
      this.errorMessage =
        'O tipo de segmento é obrigatório.';

      return;
    }

    if (!this.contractForm.tipoProduto) {
      this.errorMessage =
        'O tipo de produto é obrigatório.';

      return;
    }

    if (!this.contractForm.telefone) {
      this.errorMessage =
        'O telefone é obrigatório.';

      return;
    }

    if (
      this.contractForm.email.trim() &&
      !this.isValidEmail(
        this.contractForm.email,
      )
    ) {
      this.errorMessage =
        'Indica um email válido.';

      return;
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
        'Pedido de Chamada';
    }

    const payload =
      this.buildContractPayload();

    this.isCreatingContract = true;
    this.isUploadingDocuments = false;
    this.errorMessage = '';
    this.successMessage = '';

    let createdContractId: string | null = null;

    this.wallboxContractService
      .createWallboxContract(payload)
      .pipe(
        tap((contract: WallboxContractCreateResponse) => {
          createdContractId = contract.id;
        }),
        switchMap((contract: WallboxContractCreateResponse) => {
          if (!this.selectedFiles.length) {
            return of(contract);
          }

          this.isUploadingDocuments = true;

          return this.wallboxContractService
            .uploadAttachments(
              contract.id,
              this.selectedFiles,
            )
            .pipe(
              map(() => contract),
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
        next: (contract: WallboxContractCreateResponse) => {
          this.successMessage =
            this.selectedFiles.length
              ? 'Contrato e documentos criados com sucesso.'
              : 'Contrato criado com sucesso.';

          this.router.navigate([
            '/home/contracts/wallbox',
            contract.id,
          ]);
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage =
            error?.error?.details?.join(
              ' ',
            ) ||
            error?.error?.message ||
            'Não foi possível criar o contrato Wallbox.';
        },
        complete: () => {
          if (
            createdContractId &&
            this.errorMessage.includes(
              'O contrato foi criado',
            )
          ) {
            this.successMessage =
              `Contrato ${createdContractId} criado com sucesso.`;
          }
        },
      });
  }

  private loadContractLayout(): void {
    this.contractLayout =
      this.preferencesService.getContractLayout();

    if (this.isLightLayout()) {
      this.contractForm.estado =
        'Pedido de Chamada';
    }
  }

  private loadCampaigns(): void {
    this.campaignService
      .getCampaignsByCompanyId(
        WALLBOX_COMPANY_ID,
      )
      .pipe(
        map((campaigns) =>
          campaigns.filter(
            (campaign) => campaign.active,
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
          this.resolveInternalObservationsAccess(
            currentUser,
          );

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
    const activeUsers = users.filter(
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

    return activeUsers.filter((user) => {
      if (user.id === currentUser.id) {
        return true;
      }

      return this.getUserTeamIds(
        user,
      ).some((teamId) =>
        managedTeamIdSet.has(teamId),
      );
    });
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
        user as ProfileUserWithTeamPositions
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
      user as ProfileUserWithTeamPositions;

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
          team.registrationNumber ?? null,
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
    WallboxContractTeamVisibility[] {
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

    const existingTeamIds =
      new Set(
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

  private buildContractPayload():
    CreateWallboxContractRequest {
    if (!this.client) {
      throw new Error(
        'Cliente não identificado.',
      );
    }

    if (!this.contractForm.telefone) {
      throw new Error(
        'Telefone não preenchido.',
      );
    }

    const campanha =
      this.campaignSelectionMode === 'other'
        ? this.customCampaign.trim()
        : this.contractForm.campanha;

    const estado: WallboxContractStatus =
      this.isLightLayout()
        ? 'Pedido de Chamada'
        : this.contractForm.estado;

    const payload:
      CreateWallboxContractRequest = {
        companyId: WALLBOX_COMPANY_ID,
        clientId: this.client.id,
        tipoSegmento:
          this.contractForm.tipoSegmento,
        tipoProduto:
          this.contractForm.tipoProduto,
        estado,
        nomeClienteEmpresa:
          this.client.name,
        nif: this.client.nif,
        telefone:
          this.contractForm.telefone,
        campanha,
        userId: this.assignedUserId,
        teams: this.resolveContractTeams(),
        comDeslocacao:
          this.contractForm.comDeslocacao,
        balanceamentoPotencia:
          this.contractForm
            .balanceamentoPotencia,
      };

    this.addIfFilled(
      payload,
      'email',
      this.contractForm.email.trim(),
    );

    this.addIfFilled(
      payload,
      'moradaInstalacao',
      this.contractForm
        .moradaInstalacao.trim(),
    );

    this.addIfFilled(
      payload,
      'nivelTensao',
      this.contractForm.nivelTensao,
    );

    this.addIfFilled(
      payload,
      'tipoLocalInstalacao',
      this.contractForm
        .tipoLocalInstalacao,
    );

    this.addIfFilled(
      payload,
      'metodoPagamento',
      this.contractForm.metodoPagamento,
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

    return payload;
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
    const message = value
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

  private isValidEmail(
    value: string,
  ): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(value.trim());
  }

  private getFileKey(file: File): string {
    return [
      file.name,
      file.size,
      file.lastModified,
    ].join('-');
  }
}
