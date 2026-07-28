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
  forkJoin,
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
  CreateRepsolContractRequest,
  RepsolContractDetail,
  RepsolContractService,
  RepsolContractStatus,
} from '../../../core/services/repsol-contract';

import { Auth } from '../../../core/services/auth';

import {
  ProfileUser,
  UserService,
} from '../../../core/services/user';

import {
  Team,
  TeamService,
} from '../../../core/services/team';

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

@Component({
  selector: 'app-repsol-contract-create',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: './repsol-contract-create.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './repsol-contract-create.scss',
})
export class RepsolContractCreate implements OnInit {
  private readonly clientService =
    inject(ClientService);

  private readonly campaignService =
    inject(CampaignService);

  private readonly repsolContractService =
    inject(RepsolContractService);

  private readonly preferencesService =
    inject(PreferencesService);

  private readonly userService =
    inject(UserService);

  private readonly teamService =
    inject(TeamService);

  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  contractLayout: ContractLayout = 'light';

  nif: number | null = null;
  clientName = '';
  client: Client | null = null;

  campaigns: Campaign[] = [];

  currentUser: ProfileUser | null = null;
  assignableUsers: ProfileUser[] = [];
  availableTeams: Team[] = [];

  assignedUserId = '';
  selectedTeamIds: string[] = [];
  teamToAddId = '';

  isLoadingAssignment = false;
  assignmentErrorMessage = '';

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

  estadoOptions: RepsolContractStatus[] = [
    'Pedido de Chamada',
    'Em validação',
    'Chamada Efetuada',
    'Pendente Assinatura Digital',
    'Não Conformidade',
    'Pendente Docs',
    'Documentos Enviados',
    'Atribuído',
  ];

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
    companyId: environment.repsolId,

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
      'Pedido de Chamada' as RepsolContractStatus,

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
    cpe: '',
    cui: '',

    potencia:
      '6.90' as ContractPowerSelection,

    escalao:
      1 as number | typeof OTHER_GAS_LEVEL,

    cicloHorario: 'Simples',
    nivelTensao: 'Monofásico',

    observacoes: '',

    teams: [] as string[],
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

  get selectedTeams(): Team[] {
    return this.selectedTeamIds
      .map((teamId) =>
        this.availableTeams.find(
          (team) => team.id === teamId,
        ),
      )
      .filter((team): team is Team =>
        Boolean(team),
      );
  }

  get teamsAvailableToAdd(): Team[] {
    return this.availableTeams.filter(
      (team) =>
        !this.selectedTeamIds.includes(
          team.id,
        ),
    );
  }

  onAssignedUserChange(): void {
    if (!this.isSuperAdmin()) {
      return;
    }

    const selectedUser =
      this.assignableUsers.find(
        (user) =>
          user.id === this.assignedUserId,
      );

    this.teamToAddId = '';
    this.selectedTeamIds = selectedUser
      ? this.resolveInitialTeamIds(
          selectedUser,
        )
      : [];
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
        'Pedido de Chamada';
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

          if (
            currentUser.role.includes(
              'Super Admin',
            )
          ) {
            return forkJoin({
              users: this.userService.getUsers(),
              teams: this.teamService.getTeams(),
            });
          }

          const userTeams: Team[] =
            currentUser.teams.map(
              (team) => ({
                id: team.id,
                name: team.name,
                role: '',
                positionList: [],
                active: true,
              }),
            );

          return of({
            users: [currentUser],
            teams: userTeams,
          });
        }),
        finalize(() => {
          this.isLoadingAssignment = false;
        }),
      )
      .subscribe({
        next: ({ users, teams }) => {
          this.assignableUsers =
            users.filter(
              (user) => user.active,
            );

          this.availableTeams =
            teams.filter(
              (team) => team.active,
            );

          if (this.currentUser) {
            this.initializeAssignment(
              this.currentUser,
            );
          }
        },
        error: () => {
          this.assignmentErrorMessage =
            'Não foi possível carregar os dados de atribuição do contrato.';
        },
      });
  }

  private initializeAssignment(
    user: ProfileUser,
  ): void {
    this.assignedUserId = user.id;
    this.selectedTeamIds =
      this.resolveInitialTeamIds(user);
    this.teamToAddId = '';
  }

  private resolveInitialTeamIds(
    user: ProfileUser,
  ): string[] {
    if (user.defaultTeam?.id) {
      return [user.defaultTeam.id];
    }

    return user.teams[0]?.id
      ? [user.teams[0].id]
      : [];
  }

  private resolveContractTeamIds(): string[] {
    const requiredTeamIds = [
      environment.EQUIPA_CRM_ID,
      environment.EQUIPA_DU_ID,
    ].filter(
      (teamId): teamId is string =>
        Boolean(teamId),
    );

    return [
      ...new Set([
        ...this.selectedTeamIds,
        ...requiredTeamIds,
      ]),
    ];
  }

  private loadCampaigns(): void {
    this.campaignService
      .getCampaignsByCompanyId(
        environment.repsolId,
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

    const campaignIsMissing =
      this.campaignSelectionMode === 'existing'
        ? !this.contractForm.campanha
        : !this.customCampaign.trim();

    if (campaignIsMissing) {
      this.errorMessage =
        'É obrigatório selecionar ou indicar uma campanha.';

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

    let createdContract:
      RepsolContractDetail | null = null;

    this.repsolContractService
      .createRepsolContract(payload)
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

          return this.repsolContractService
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
            '/home/contracts/repsol',
            contract.id,
          ]);
        },

        error: (error) => {
          this.errorMessage =
            error?.error?.details?.join(
              ' ',
            ) ||
            error?.error?.message ||
            'Não foi possível criar o contrato Repsol.';
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
    CreateRepsolContractRequest {
    if (!this.client) {
      throw new Error(
        'Cliente não identificado.',
      );
    }


    const estado:
      RepsolContractStatus =
        this.isLightLayout()
          ? 'Pedido de Chamada'
          : this.contractForm.estado;

    const payload:
      CreateRepsolContractRequest = {
        clientId: this.client.id,
        companyId:
          this.contractForm.companyId,

        nomeClienteEmpresa:
          this.client.name,

        nif: this.client.nif,

        userId: this.assignedUserId,

        teams:
          this.resolveContractTeamIds(),

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
      CreateRepsolContractRequest,
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
      this.contractForm
        .observacoes.trim(),
    );
  }

  private addProFields(
    payload:
      CreateRepsolContractRequest,
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

    this.addIfFilled(
      payload,
      'controleQualidade',
      this.contractForm
        .controleQualidade,
    );

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