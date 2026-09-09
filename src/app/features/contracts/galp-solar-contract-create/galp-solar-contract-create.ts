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
  Client,
  ClientService,
} from '../../../core/services/client';

import {
  CreateGalpSolarContractRequest,
  GALP_SOLAR_PANEL_SUGGESTIONS,
  GALP_SOLAR_PAYMENT_METHOD_SUGGESTIONS,
  GALP_SOLAR_STATUSES,
  GalpSolarContract,
  GalpSolarContractService,
  GalpSolarContractStatus,
  GalpSolarContractTeamVisibility,
} from '../../../core/services/galp-solar-contract';

import { Auth } from '../../../core/services/auth';

import {
  ProfileUser,
  UserService,
} from '../../../core/services/user';

type TipoSegmento =
  | 'Residencial'
  | 'Empresarial'
  | 'Condomínios';

type TipoProduto = 'Painéis Solares';

type Contratacao =
  | 'Contratação Papel'
  | 'Contratação Digital';

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

interface ProfileUserWithTeamPositions extends ProfileUser {
  teams: AssignableContractTeam[];
  defaultTeam: AssignableContractTeam | null;
}

import { FileDropzone } from '../../../shared/components/file-dropzone/file-dropzone';

@Component({
  selector: 'app-galp-solar-contract-create',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    FileDropzone,
  ],
  templateUrl: './galp-solar-contract-create.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './galp-solar-contract-create.scss',
})
export class GalpSolarContractCreate implements OnInit {
  readonly qualityControlBackofficeOptions =
    QUALITY_CONTROL_BACKOFFICE_OPTIONS;
  private readonly clientService =
    inject(ClientService);

  private readonly galpSolarContractService =
    inject(GalpSolarContractService);

  private readonly userService =
    inject(UserService);

  private readonly auth =
    inject(Auth);

  private readonly router =
    inject(Router);

  nif: number | null = null;

  clientName = '';

  client: Client | null = null;

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

  readonly panelSuggestions =
    GALP_SOLAR_PANEL_SUGGESTIONS;

  readonly paymentMethodSuggestions =
    GALP_SOLAR_PAYMENT_METHOD_SUGGESTIONS;

  readonly estadoOptions =
    GALP_SOLAR_STATUSES;

  readonly tipoSegmentoOptions: TipoSegmento[] = [
    'Residencial',
    'Empresarial',
    'Condomínios',
  ];

  readonly tipoProdutoOptions: TipoProduto[] = [
    'Painéis Solares',
  ];

  readonly contratacaoOptions: Contratacao[] = [
    'Contratação Papel',
    'Contratação Digital',
  ];

  readonly moradaFaturacaoOptions: MoradaFaturacaoSelecao[] = [
    'Igual à de Instalação',
    'Outra',
  ];

  contractForm = {
    companyId: environment.GALP_SOLAR_COMPANY_ID,

    contratacao: 'Contratação Digital' as Contratacao,

    tipoSegmento: 'Residencial' as TipoSegmento,

    tipoProduto: 'Painéis Solares' as TipoProduto,

    controleQualidade: '',

    codigoRegistoCE: '',

    nomeRegistoCE: '',

    estado: 'Pedido de Proposta' as GalpSolarContractStatus,

    agendamento: '',

    dataAssinatura: '',

    dataContrato: '',

    dataRegisto: '',

    dataPrevistaInstalacao: '',

    dataInstalacao: '',

    dataAtivacao: '',

    dataBaixa: '',

    numeroLead: '',

    offer: '',

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

    debitoDireto: false,

    nib: '',

    tipoPainel: '',

    numeroPaineisSolares: 1,

    microinversor: false,

    baterias: false,

    metodoPagamento: '',

    observacoes: '',

    observacoesInternas: '',
  };

  ngOnInit(): void {
    this.loadAssignmentData();
  }

  canManageQualityControl(): boolean {
    return canManageQualityControlRole(
      this.currentUser?.role,
    );
  }

  isSuperAdmin(): boolean {
    return Boolean(
      this.currentUser?.role.includes('Super Admin'),
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
        !this.selectedTeamIds.includes(team.id),
    );
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

          this.clientName =
            client.name;

          this.clientChecked =
            true;

          this.clientNotFound =
            false;

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

  isRequiredTeam(teamId: string): boolean {
    return this.getRequiredTeamIds().includes(
      teamId,
    );
  }

  shouldShowBillingAddress(): boolean {
    return (
      this.contractForm.moradaFaturacaoSelecao ===
      'Outra'
    );
  }

  onFilesSelected(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    const files: File[] = input.files
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
      return `${(size / 1024).toFixed(1)} KB`;
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

    // TELEFONE OBRIGATÓRIO
    if (!this.contractForm.telefone) {
      this.errorMessage =
        'O telefone é obrigatório.';

      return;
    }

    if (
      !this.contractForm.tipoPainel.trim()
    ) {
      this.errorMessage =
        'O tipo de painel é obrigatório.';

      return;
    }

    const numeroPaineis =
      Number(
        this.contractForm.numeroPaineisSolares,
      );

    if (
      !Number.isFinite(numeroPaineis) ||
      numeroPaineis < 1
    ) {
      this.errorMessage =
        'O número de painéis solares deve ser igual ou superior a 1.';

      return;
    }

    const teamValidationError =
      this.validateSelectedTeams();

    if (teamValidationError) {
      this.errorMessage =
        teamValidationError;

      return;
    }

    const payload =
      this.buildContractPayload();

    this.isCreatingContract = true;

    this.isUploadingDocuments = false;

    this.errorMessage = '';

    this.successMessage = '';

    let createdContract:
      GalpSolarContract | null = null;

    this.galpSolarContractService
      .create(payload)
      .pipe(
        tap((contract) => {
          createdContract =
            contract;
        }),

        switchMap((contract) => {
          if (
            !this.selectedFiles.length
          ) {
            return of(contract);
          }

          this.isUploadingDocuments =
            true;

          return this.galpSolarContractService
            .uploadAttachments(
              contract.id,
              this.selectedFiles,
            )
            .pipe(
              map(() => contract),

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
              : 'Contrato Galp Solar criado com sucesso.';

          this.router.navigate([
            '/home/galp-solar/contracts',
            contract.id,
          ]);
        },

        error: (error) => {
          this.errorMessage =
            error?.error?.details?.join(' ') ||
            error?.error?.message ||
            'Não foi possível criar o contrato Galp Solar.';
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

  private loadAssignmentData(): void {
    const authenticatedUser =
      this.auth.getCurrentUser() as Partial<ProfileUser> | null;

    if (!authenticatedUser?.id) {
      this.assignmentErrorMessage =
        'Não foi possível identificar o utilizador autenticado.';

      return;
    }

    this.isLoadingAssignment = true;

    this.assignmentErrorMessage = '';

    this.userService
      .getUserById(
        authenticatedUser.id,
      )
      .pipe(
        switchMap((currentUser) => {
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
        ).some(
          (teamId) =>
            managedTeamIdSet.has(
              teamId,
            ),
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
        .replace(
          /[^a-z0-9]/g,
          '',
        );

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
      userTeamIds.some(
        (teamId) =>
          authorizedTeamIds.includes(
            teamId,
          ),
      );

    if (
      !this.canAccessInternalObservations
    ) {
      this.contractForm.observacoesInternas =
        '';
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

        active:
          team.active,
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
      (
        teamId,
      ): teamId is string =>
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
      return 'Uma das equipas selecionadas não possui uma posição hierárquica válida para o utilizador atribuído.';
    }

    return null;
  }

  private resolveContractTeams():
    GalpSolarContractTeamVisibility[] {
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
            !existingTeamIds.has(
              teamId,
            ),
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
    CreateGalpSolarContractRequest {
    if (!this.client) {
      throw new Error(
        'Cliente não identificado.',
      );
    }

    if (!this.contractForm.telefone) {
      throw new Error(
        'Telefone não identificado.',
      );
    }

    const estado: GalpSolarContractStatus =
      this.contractForm.estado;

    const payload:
      CreateGalpSolarContractRequest = {
        clientId: this.client.id,

        companyId:
          environment.GALP_SOLAR_COMPANY_ID,

        nomeClienteEmpresa:
          this.client.name,

        nif:
          this.client.nif,

        // OBRIGATÓRIO
        telefone:
          this.contractForm.telefone,

        userId:
          this.assignedUserId,

        teams:
          this.resolveContractTeams(),

        estado,

        tipoPainel:
          this.contractForm.tipoPainel.trim(),

        numeroPaineisSolares:
          Number(
            this.contractForm
              .numeroPaineisSolares,
          ),

        // Enviar explicitamente false
        microinversor:
          this.contractForm.microinversor,

        baterias:
          this.contractForm.baterias,

        faturaEletronica:
          this.contractForm.faturaEletronica,

        debitoDireto:
          this.contractForm.debitoDireto,
      };

    this.addIfFilled(
      payload,
      'contratacao',
      this.contractForm.contratacao,
    );

    this.addIfFilled(
      payload,
      'tipoSegmento',
      this.contractForm.tipoSegmento,
    );

    this.addIfFilled(
      payload,
      'tipoProduto',
      this.contractForm.tipoProduto,
    );


    if (this.canManageQualityControl()) {
      this.addIfFilled(
        payload,
        'controleQualidade',
        this.contractForm.controleQualidade,
      );
    }

    this.addIfFilled(
      payload,
      'codigoRegistoCE',
      this.contractForm.codigoRegistoCE,
    );

    this.addIfFilled(
      payload,
      'nomeRegistoCE',
      this.contractForm.nomeRegistoCE,
    );

    this.addIfFilled(
      payload,
      'agendamento',
      this.contractForm.agendamento,
    );

    this.addIfFilled(
      payload,
      'dataAssinatura',
      this.contractForm.dataAssinatura,
    );

    this.addIfFilled(
      payload,
      'dataContrato',
      this.contractForm.dataContrato,
    );

    this.addIfFilled(
      payload,
      'dataRegisto',
      this.contractForm.dataRegisto,
    );

    this.addIfFilled(
      payload,
      'dataPrevistaInstalacao',
      this.contractForm.dataPrevistaInstalacao,
    );

    this.addIfFilled(
      payload,
      'dataInstalacao',
      this.contractForm.dataInstalacao,
    );

    this.addIfFilled(
      payload,
      'dataAtivacao',
      this.contractForm.dataAtivacao,
    );

    this.addIfFilled(
      payload,
      'dataBaixa',
      this.contractForm.dataBaixa,
    );

    this.addIfFilled(
      payload,
      'numeroLead',
      this.contractForm.numeroLead,
    );

    this.addIfFilled(
      payload,
      'offer',
      this.contractForm.offer,
    );

    /*
     * Telefone já não é colocado através de addIfFilled().
     * É obrigatório e é enviado diretamente no payload.
     */

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
      'nib',
      this.contractForm.nib,
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

    if (
      this.canAccessInternalObservations
    ) {
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

    return (
      `${userName} - ` +
      `${formattedDate} - ` +
      message
    );
  }

  private formatObservationDate(
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

    return (
      `${day}/${month}/${year} ` +
      `${hours}:${minutes}`
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
      .map(
        (value) =>
          value.trim(),
      )
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
    if (
      this.contractForm.moradaFaturacaoSelecao ===
      'Igual à de Instalação'
    ) {
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

  private addIfFilled<T extends object>(
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
    )[key as string] =
      typeof value === 'string'
        ? value.trim()
        : value;
  }

  private getFileKey(file: File): string {
    return [
      file.name,
      file.size,
      file.lastModified,
    ].join('-');
  }
}