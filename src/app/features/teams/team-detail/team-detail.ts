import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import {
  catchError,
  finalize,
  forkJoin,
  map,
  of,
} from 'rxjs';

import { environment } from '../../../../environments/environment';

import { Auth } from '../../../core/services/auth';

import {
  Company,
  CompanyService,
} from '../../../core/services/company';

import {
  AddUserToTeamRequest,
  Team,
  TeamService,
  TeamUser,
} from '../../../core/services/team';

import {
  ProfileUser,
  UserService,
} from '../../../core/services/user';

import {
  CreateTeamCommissionRequest,
  TeamCommission,
  TeamCommissionSegment,
  TeamCommissionService,
  UpdateTeamCommissionRequest,
} from '../../../core/services/team-commission';

interface AddUserResult {
  userId: string;
  success: boolean;
  status?: number;
  message?: string;
}

interface PowerCommissionFormValue {
  powerKva: number | null;
  commission: number | null;
}

@Component({
  selector: 'app-team-detail',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
  ],
  templateUrl: './team-detail.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './team-detail.scss',
})
export class TeamDetail implements OnInit {
  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly teamService =
    inject(TeamService);

  private readonly userService =
    inject(UserService);

  private readonly companyService =
    inject(CompanyService);

  private readonly teamCommissionService =
    inject(TeamCommissionService);

  private readonly fb =
    inject(FormBuilder);

  private readonly auth =
    inject(Auth);

  private readonly cdr =
    inject(ChangeDetectorRef);

  teamId: string | null = null;

  team: Team | null = null;
  users: TeamUser[] = [];

  availableUsers: ProfileUser[] = [];
  filteredAvailableUsers: ProfileUser[] = [];

  teamCommissions: TeamCommission[] = [];
  companies: Company[] = [];

  readonly companyNameById =
    new Map<string, string>();

  isLoadingCommissions = false;
  isLoadingCompanies = false;
  isSavingCommission = false;
  deletingCommissionId = '';

  commissionsError = '';
  commissionFormError = '';

  showCommissionModal = false;
  editingCommission: TeamCommission | null = null;

  selectedUserIds: string[] = [];

  selectedUserPositions: Record<
    string,
    number | null
  > = {};

  userSearch = '';

  isLoading = false;
  isLoadingUsers = false;
  isAddingUser = false;
  removingUserId = '';

  showAddUserModal = false;

  errorMessage = '';
  successMessage = '';
  addUserErrorMessage = '';

  readonly commissionForm =
    this.fb.group({
      companyId:
        this.fb.nonNullable.control(
          '',
          Validators.required,
        ),

      segment:
        this.fb.control<
          TeamCommissionSegment | null
        >(
          null,
          Validators.required,
        ),

      electricityCommission:
        this.fb.nonNullable.control(
          0,
          [
            Validators.required,
            Validators.min(0),
          ],
        ),

      electricityPowerCommissions:
        this.fb.array([]),

      gasCommission:
        this.fb.nonNullable.control(
          0,
          [
            Validators.required,
            Validators.min(0),
          ],
        ),

      directDebitCommission:
        this.fb.nonNullable.control(
          0,
          [
            Validators.required,
            Validators.min(0),
          ],
        ),

      electronicInvoiceCommission:
        this.fb.nonNullable.control(
          0,
          [
            Validators.required,
            Validators.min(0),
          ],
        ),

      SVACommission:
        this.fb.nonNullable.control(
          0,
          [
            Validators.required,
            Validators.min(0),
          ],
        ),

      PELCommission:
        this.fb.nonNullable.control(
          0,
          [
            Validators.required,
            Validators.min(0),
          ],
        ),

      PGICommission:
        this.fb.nonNullable.control(
          0,
          [
            Validators.required,
            Validators.min(0),
          ],
        ),

      MGICommission:
        this.fb.nonNullable.control(
          0,
          [
            Validators.required,
            Validators.min(0),
          ],
        ),

      PELPlusCommission:
        this.fb.nonNullable.control(
          0,
          [
            Validators.required,
            Validators.min(0),
          ],
        ),

      active:
        this.fb.nonNullable.control(
          true,
        ),
    });

  ngOnInit(): void {
    this.route.paramMap.subscribe(
      (params) => {
        const teamId =
          params.get('id');

        if (!teamId) {
          void this.router.navigateByUrl(
            '/error',
          );

          return;
        }

        this.teamId = teamId;

        this.validateTeamAccess(
          teamId,
        );
      },
    );
  }

  get canManageTeamUsers(): boolean {
    return this.auth.roleIncludes(
      'Super Admin',
    );
  }

  get canManageCommissions(): boolean {
    return this.auth.roleIncludes(
      'Super Admin',
    );
  }

  get powerCommissions():
    FormArray {
    return this.commissionForm.controls
      .electricityPowerCommissions;
  }

  get selectedUsersCount(): number {
    return this.selectedUserIds.length;
  }

  get canSubmitSelectedUsers(): boolean {
    return (
      this.selectedUserIds.length > 0 &&
      this.selectedUserIds.every(
        (userId) =>
          this.hasValidSelectedPosition(
            userId,
          ),
      )
    );
  }

  private validateTeamAccess(
    teamId: string,
  ): void {
    if (
      this.auth.roleIncludes(
        'Super Admin',
      )
    ) {
      this.initializeTeam(teamId);

      return;
    }

    const currentUser =
      this.auth.getCurrentUser();

    if (!currentUser?.id) {
      void this.router.navigateByUrl(
        '/error',
      );

      return;
    }

    this.userService
      .getUserById(currentUser.id)
      .subscribe({
        next: (user: ProfileUser) => {
          if (
            !this.userBelongsToTeam(
              user,
              teamId,
            )
          ) {
            void this.router.navigateByUrl(
              '/error',
            );

            return;
          }

          this.initializeTeam(
            teamId,
          );
        },

        error: () => {
          void this.router.navigateByUrl(
            '/error',
          );
        },
      });
  }

  private userBelongsToTeam(
    user: ProfileUser,
    teamId: string,
  ): boolean {
    return Boolean(
      user.teams?.some(
        (team) =>
          team.id === teamId,
      ),
    );
  }

  private initializeTeam(
    teamId: string,
  ): void {
    this.loadTeam(teamId);

    if (this.canManageCommissions) {
      this.loadCompanies();
      this.loadTeamCommissions();
    }
  }

  loadTeam(teamId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.teamService
      .getTeamUsers(teamId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.team = response.team;

          this.users = [
            ...(response.users || []),
          ].sort(
            (
              firstUser,
              secondUser,
            ) =>
              firstUser.positionIndex -
              secondUser.positionIndex,
          );
        },

        error: () => {
          this.errorMessage =
            'Não foi possível carregar a equipa.';
        },
      });
  }

  private loadCompanies(): void {
    if (
      !this.canManageCommissions ||
      this.isLoadingCompanies ||
      this.companies.length
    ) {
      return;
    }

    this.isLoadingCompanies = true;

    this.companyService
      .getCompanies()
      .pipe(
        finalize(() => {
          this.isLoadingCompanies = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (companies) => {
          this.companies = companies
            .filter(
              (company) =>
                company.active,
            )
            .sort((first, second) =>
              first.name.localeCompare(
                second.name,
                'pt',
              ),
            );

          this.companyNameById.clear();

          companies.forEach(
            (company) => {
              this.companyNameById.set(
                company.id,
                company.name,
              );
            },
          );

          this.sortTeamCommissions();
        },

        error: () => {
          this.commissionsError =
            'Não foi possível carregar as comercializadoras.';
        },
      });
  }

  private loadTeamCommissions(): void {
    if (
      !this.canManageCommissions ||
      !this.teamId
    ) {
      return;
    }

    this.isLoadingCommissions = true;
    this.commissionsError = '';

    this.teamCommissionService
      .getByTeamId(this.teamId)
      .pipe(
        finalize(() => {
          this.isLoadingCommissions = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (commissions) => {
          this.teamCommissions = [
            ...(commissions || []),
          ];

          this.sortTeamCommissions();
        },

        error: () => {
          this.commissionsError =
            'Não foi possível carregar as comissões da equipa.';
        },
      });
  }

  openCreateCommissionModal(): void {
    if (
      !this.canManageCommissions ||
      !this.teamId
    ) {
      return;
    }

    this.editingCommission = null;
    this.commissionFormError = '';

    this.resetCommissionForm();

    this.showCommissionModal = true;
  }

  openEditCommissionModal(
    commission: TeamCommission,
  ): void {
    if (!this.canManageCommissions) {
      return;
    }

    this.editingCommission =
      commission;

    this.commissionFormError = '';

    this.powerCommissions.clear();

    commission
      .electricityPowerCommissions
      ?.forEach((powerCommission) => {
        this.powerCommissions.push(
          this.createPowerCommissionGroup(
            powerCommission.powerKva,
            powerCommission.commission,
          ),
        );
      });

    this.commissionForm.reset(
      {
        companyId:
          commission.companyId,

        segment:
          commission.segment,

        electricityCommission:
          commission.electricityCommission,

        gasCommission:
          commission.gasCommission,

        directDebitCommission:
          commission.directDebitCommission,

        electronicInvoiceCommission:
          commission.electronicInvoiceCommission,

        SVACommission:
          commission.SVACommission,

        PELCommission:
          commission.PELCommission,

        PGICommission:
          commission.PGICommission,

        MGICommission:
          commission.MGICommission,

        PELPlusCommission:
          commission.PELPlusCommission,

        active:
          commission.active,
      },
      {
        emitEvent: false,
      },
    );

    this.showCommissionModal = true;
  }

  closeCommissionModal(): void {
    if (this.isSavingCommission) {
      return;
    }

    this.showCommissionModal = false;
    this.editingCommission = null;
    this.commissionFormError = '';

    this.resetCommissionForm();
  }

  addPowerCommission(): void {
    if (this.isSavingCommission) {
      return;
    }

    this.powerCommissions.push(
      this.createPowerCommissionGroup(),
    );
  }

  removePowerCommission(
    index: number,
  ): void {
    if (this.isSavingCommission) {
      return;
    }

    this.powerCommissions.removeAt(
      index,
    );

    this.commissionFormError = '';
  }

  saveCommission(): void {
    if (
      !this.canManageCommissions ||
      !this.teamId ||
      this.isSavingCommission
    ) {
      return;
    }

    this.commissionFormError = '';

    if (this.commissionForm.invalid) {
      this.commissionForm.markAllAsTouched();

      this.commissionFormError =
        'Preenche corretamente todos os campos obrigatórios.';

      return;
    }

    if (
      this.hasDuplicatePowerCommissions()
    ) {
      this.commissionFormError =
        'Já existe uma comissão definida para esta potência.';

      return;
    }

    const rawValue =
      this.commissionForm.getRawValue();

    const powerCommissions =
      (
        rawValue
          .electricityPowerCommissions as
          PowerCommissionFormValue[]
      ).map((item) => ({
        powerKva:
          Number(item.powerKva),
        commission:
          Number(item.commission),
      }));

    const duplicateConfiguration =
      this.teamCommissions.some(
        (commission) =>
          commission.companyId ===
            rawValue.companyId &&
          commission.segment ===
            rawValue.segment &&
          commission.id !==
            this.editingCommission?.id,
      );

    if (duplicateConfiguration) {
      this.commissionFormError =
        'Já existe uma configuração de comissões para esta comercializadora e segmento.';

      return;
    }

    this.isSavingCommission = true;

    if (this.editingCommission) {
      const payload:
        UpdateTeamCommissionRequest = {
          companyId:
            rawValue.companyId,

          segment:
            rawValue.segment!,

          electricityCommission:
            Number(
              rawValue
                .electricityCommission,
            ),

          electricityPowerCommissions:
            powerCommissions,

          gasCommission:
            Number(
              rawValue.gasCommission,
            ),

          directDebitCommission:
            Number(
              rawValue
                .directDebitCommission,
            ),

          electronicInvoiceCommission:
            Number(
              rawValue
                .electronicInvoiceCommission,
            ),

          SVACommission:
            Number(
              rawValue.SVACommission,
            ),

          PELCommission:
            Number(
              rawValue.PELCommission,
            ),

          PGICommission:
            Number(
              rawValue.PGICommission,
            ),

          MGICommission:
            Number(
              rawValue.MGICommission,
            ),

          PELPlusCommission:
            Number(
              rawValue
                .PELPlusCommission,
            ),

          active:
            Boolean(rawValue.active),
        };

      this.teamCommissionService
        .update(
          this.editingCommission.id,
          payload,
        )
        .pipe(
          finalize(() => {
            this.isSavingCommission =
              false;

            this.cdr.detectChanges();
          }),
        )
        .subscribe({
          next: () => {
            this.closeCommissionModal();

            this.successMessage =
              'Configuração de comissões atualizada com sucesso.';

            this.loadTeamCommissions();

            this.clearSuccessMessageLater();
          },

          error: (error) => {
            this.handleCommissionSaveError(
              error,
            );
          },
        });

      return;
    }

    const payload:
      CreateTeamCommissionRequest = {
        teamId: this.teamId,

        companyId:
          rawValue.companyId,

        segment:
          rawValue.segment!,

        electricityCommission:
          Number(
            rawValue
              .electricityCommission,
          ),

        electricityPowerCommissions:
          powerCommissions,

        gasCommission:
          Number(rawValue.gasCommission),

        directDebitCommission:
          Number(
            rawValue
              .directDebitCommission,
          ),

        electronicInvoiceCommission:
          Number(
            rawValue
              .electronicInvoiceCommission,
          ),

        SVACommission:
          Number(rawValue.SVACommission),

        PELCommission:
          Number(rawValue.PELCommission),

        PGICommission:
          Number(rawValue.PGICommission),

        MGICommission:
          Number(rawValue.MGICommission),

        PELPlusCommission:
          Number(
            rawValue.PELPlusCommission,
          ),
      };

    this.teamCommissionService
      .create(payload)
      .pipe(
        finalize(() => {
          this.isSavingCommission = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.closeCommissionModal();

          this.successMessage =
            'Configuração de comissões criada com sucesso.';

          this.loadTeamCommissions();

          this.clearSuccessMessageLater();
        },

        error: (error) => {
          this.handleCommissionSaveError(
            error,
          );
        },
      });
  }

  deleteCommission(
    commission: TeamCommission,
  ): void {
    if (
      !this.canManageCommissions ||
      this.deletingCommissionId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Eliminar configuração de comissões de ${this.getCompanyName(
          commission.companyId,
        )} - ${this.getSegmentLabel(
          commission.segment,
        )}?`,
      );

    if (!confirmed) {
      return;
    }

    this.deletingCommissionId =
      commission.id;

    this.commissionsError = '';

    this.teamCommissionService
      .delete(commission.id)
      .pipe(
        finalize(() => {
          this.deletingCommissionId = '';
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.teamCommissions =
            this.teamCommissions.filter(
              (item) =>
                item.id !== commission.id,
            );

          this.successMessage =
            'Configuração de comissões eliminada com sucesso.';

          this.clearSuccessMessageLater();
        },

        error: (error) => {
          this.commissionsError =
            error?.error?.message ||
            'Não foi possível eliminar a configuração de comissões.';
        },
      });
  }

  toggleCommissionActive(
    commission: TeamCommission,
  ): void {
    if (
      !this.canManageCommissions ||
      this.isSavingCommission
    ) {
      return;
    }

    this.isSavingCommission = true;

    this.teamCommissionService
      .update(
        commission.id,
        {
          active:
            !commission.active,
        },
      )
      .pipe(
        finalize(() => {
          this.isSavingCommission = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.loadTeamCommissions();

          this.successMessage =
            'Estado da configuração atualizado com sucesso.';

          this.clearSuccessMessageLater();
        },

        error: (error) => {
          this.commissionsError =
            error?.error?.message ||
            'Não foi possível atualizar o estado da configuração.';
        },
      });
  }

  getCompanyName(
    companyId: string,
  ): string {
    return (
      this.companyNameById.get(
        companyId,
      ) ??
      companyId
    );
  }

  getSegmentLabel(
    segment:
      TeamCommissionSegment,
  ): string {
    const labels:
      Record<
        TeamCommissionSegment,
        string
      > = {
        residential: 'Residencial',
        business: 'Empresarial',
        condominium: 'Condomínio',
      };

    return labels[segment];
  }

  formatCommission(
    value:
      number |
      null |
      undefined,
  ): string {
    return new Intl.NumberFormat(
      'pt-PT',
      {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
      },
    ).format(Number(value ?? 0));
  }

  formatPower(
    value: number,
  ): string {
    return `${Number(value).toFixed(2)} kVA`;
  }

  trackCommissionById(
    _index: number,
    commission: TeamCommission,
  ): string {
    return commission.id;
  }

  trackPowerByIndex(
    index: number,
  ): number {
    return index;
  }

  private createPowerCommissionGroup(
    powerKva:
      number | null = null,
    commission:
      number | null = null,
  ) {
    return this.fb.group({
      powerKva:
        this.fb.control<number | null>(
          powerKva,
          [
            Validators.required,
            Validators.min(0.01),
          ],
        ),

      commission:
        this.fb.control<number | null>(
          commission,
          [
            Validators.required,
            Validators.min(0),
          ],
        ),
    });
  }

  private resetCommissionForm(): void {
    this.powerCommissions.clear();

    this.commissionForm.reset(
      {
        companyId: '',
        segment: null,

        electricityCommission: 0,
        gasCommission: 0,

        directDebitCommission: 0,
        electronicInvoiceCommission: 0,

        SVACommission: 0,

        PELCommission: 0,
        PGICommission: 0,
        MGICommission: 0,
        PELPlusCommission: 0,

        active: true,
      },
      {
        emitEvent: false,
      },
    );

    this.commissionForm.markAsPristine();
    this.commissionForm.markAsUntouched();
  }

  private hasDuplicatePowerCommissions():
    boolean {
    const values =
      (
        this.powerCommissions
          .getRawValue() as
          PowerCommissionFormValue[]
      )
        .map((item) =>
          Number(item.powerKva),
        )
        .filter((value) =>
          Number.isFinite(value),
        );

    return (
      new Set(values).size !==
      values.length
    );
  }

  private sortTeamCommissions(): void {
    this.teamCommissions.sort(
      (first, second) => {
        const companyComparison =
          this.getCompanyName(
            first.companyId,
          ).localeCompare(
            this.getCompanyName(
              second.companyId,
            ),
            'pt',
          );

        if (companyComparison !== 0) {
          return companyComparison;
        }

        return this.getSegmentLabel(
          first.segment,
        ).localeCompare(
          this.getSegmentLabel(
            second.segment,
          ),
          'pt',
        );
      },
    );
  }

  private handleCommissionSaveError(
    error: {
      status?: number;
      error?: {
        message?: string;
      };
    },
  ): void {
    if (error?.status === 409) {
      this.commissionFormError =
        'Já existe uma configuração de comissões para esta comercializadora e segmento.';

      return;
    }

    this.commissionFormError =
      error?.error?.message ||
      'Não foi possível guardar a configuração de comissões.';
  }

  private clearSuccessMessageLater(): void {
    window.setTimeout(() => {
      this.successMessage = '';
      this.cdr.detectChanges();
    }, 5000);
  }

  openAddUserModal(): void {
    if (
      !this.canManageTeamUsers ||
      !this.teamId ||
      this.isLoadingUsers
    ) {
      return;
    }

    this.resetUserSelection();

    this.userSearch = '';
    this.addUserErrorMessage = '';

    this.availableUsers = [];
    this.filteredAvailableUsers = [];

    this.showAddUserModal = true;

    this.loadAvailableUsers();
  }

  closeAddUserModal(): void {
    if (this.isAddingUser) {
      return;
    }

    this.showAddUserModal = false;

    this.resetUserSelection();

    this.userSearch = '';

    this.availableUsers = [];
    this.filteredAvailableUsers = [];

    this.addUserErrorMessage = '';
  }

  loadAvailableUsers(): void {
    if (!this.canManageTeamUsers) {
      return;
    }

    this.isLoadingUsers = true;
    this.addUserErrorMessage = '';

    this.userService
      .getUsers()
      .pipe(
        finalize(() => {
          this.isLoadingUsers = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (users) => {
          const existingUserIds =
            new Set(
              this.users.map(
                (user) => user.id,
              ),
            );

          this.availableUsers =
            users.filter(
              (user) =>
                user.active &&
                !existingUserIds.has(
                  user.id,
                ),
            );

          this.applyUserSearch();
        },

        error: () => {
          this.addUserErrorMessage =
            'Não foi possível carregar os utilizadores disponíveis.';
        },
      });
  }

  applyUserSearch(): void {
    const searchedValue =
      this.normalizeText(
        this.userSearch,
      );

    this.filteredAvailableUsers =
      this.availableUsers.filter(
        (user) => {
          if (!searchedValue) {
            return true;
          }

          const searchableText =
            this.normalizeText(
              [
                user.name,
                user.email,
                user.role,
              ]
                .filter(Boolean)
                .join(' '),
            );

          return searchableText.includes(
            searchedValue,
          );
        },
      );
  }

  toggleUserSelection(
    userId: string,
  ): void {
    if (
      !this.canManageTeamUsers ||
      this.isAddingUser
    ) {
      return;
    }

    if (
      this.selectedUserIds.includes(
        userId,
      )
    ) {
      this.selectedUserIds =
        this.selectedUserIds.filter(
          (selectedId) =>
            selectedId !== userId,
        );

      this.removeSelectedUserPosition(
        userId,
      );

      return;
    }

    this.selectedUserIds = [
      ...this.selectedUserIds,
      userId,
    ];

    this.selectedUserPositions = {
      ...this.selectedUserPositions,
      [userId]: null,
    };

    this.addUserErrorMessage = '';
  }

  isUserSelected(
    userId: string,
  ): boolean {
    return this.selectedUserIds.includes(
      userId,
    );
  }

  setSelectedUserPosition(
    userId: string,
    positionIndex: number | null,
  ): void {
    if (
      !this.isUserSelected(userId) ||
      this.isAddingUser
    ) {
      return;
    }

    this.selectedUserPositions = {
      ...this.selectedUserPositions,
      [userId]: positionIndex,
    };

    this.addUserErrorMessage = '';
  }

  getSelectedUserPosition(
    userId: string,
  ): number | null {
    return (
      this.selectedUserPositions[
        userId
      ] ??
      null
    );
  }

  hasValidSelectedPosition(
    userId: string,
  ): boolean {
    const positionIndex =
      this.getSelectedUserPosition(
        userId,
      );

    return Boolean(
      this.team &&
      Number.isInteger(positionIndex) &&
      positionIndex !== null &&
      positionIndex >= 0 &&
      positionIndex <
        this.team.positionList.length,
    );
  }

  clearSelectedUsers(): void {
    if (this.isAddingUser) {
      return;
    }

    this.resetUserSelection();
  }

  selectAllVisibleUsers(): void {
    if (
      this.isAddingUser ||
      !this.filteredAvailableUsers.length
    ) {
      return;
    }

    const visibleUserIds =
      this.filteredAvailableUsers.map(
        (user) => user.id,
      );

    this.selectedUserIds =
      Array.from(
        new Set([
          ...this.selectedUserIds,
          ...visibleUserIds,
        ]),
      );

    const nextPositions = {
      ...this.selectedUserPositions,
    };

    visibleUserIds.forEach(
      (userId) => {
        if (
          nextPositions[userId] ===
          undefined
        ) {
          nextPositions[userId] =
            null;
        }
      },
    );

    this.selectedUserPositions =
      nextPositions;

    this.addUserErrorMessage = '';
  }

  areAllVisibleUsersSelected(): boolean {
    return (
      this.filteredAvailableUsers.length >
        0 &&
      this.filteredAvailableUsers.every(
        (user) =>
          this.selectedUserIds.includes(
            user.id,
          ),
      )
    );
  }

  toggleAllVisibleUsers(): void {
    if (
      this.isAddingUser ||
      !this.filteredAvailableUsers.length
    ) {
      return;
    }

    if (
      this.areAllVisibleUsersSelected()
    ) {
      const visibleUserIds =
        new Set(
          this.filteredAvailableUsers.map(
            (user) => user.id,
          ),
        );

      this.selectedUserIds =
        this.selectedUserIds.filter(
          (userId) =>
            !visibleUserIds.has(
              userId,
            ),
        );

      const nextPositions = {
        ...this.selectedUserPositions,
      };

      visibleUserIds.forEach(
        (userId) => {
          delete nextPositions[userId];
        },
      );

      this.selectedUserPositions =
        nextPositions;

      return;
    }

    this.selectAllVisibleUsers();
  }

  addSelectedUsers(): void {
    if (
      !this.canManageTeamUsers ||
      !this.teamId ||
      !this.selectedUserIds.length ||
      this.isAddingUser
    ) {
      if (
        this.canManageTeamUsers &&
        !this.selectedUserIds.length
      ) {
        this.addUserErrorMessage =
          'Seleciona pelo menos um utilizador.';
      }

      return;
    }

    if (!this.canSubmitSelectedUsers) {
      this.addUserErrorMessage =
        'Seleciona uma posição para todos os utilizadores escolhidos.';

      return;
    }

    const teamId = this.teamId;

    const uniqueUserIds =
      Array.from(
        new Set(
          this.selectedUserIds,
        ),
      );

    this.isAddingUser = true;
    this.addUserErrorMessage = '';

    const requests =
      uniqueUserIds.map(
        (userId) => {
          const payload:
            AddUserToTeamRequest = {
              teamId,
              userId,
              positionIndex:
                this.selectedUserPositions[
                  userId
                ] as number,
            };

          return this.teamService
            .addUserToTeam(payload)
            .pipe(
              map(
                (): AddUserResult => ({
                  userId,
                  success: true,
                }),
              ),

              catchError((error) => {
                const result:
                  AddUserResult = {
                    userId,
                    success: false,
                    status:
                      error?.status,
                    message:
                      typeof error?.error
                        ?.message ===
                      'string'
                        ? error.error
                            .message
                        : undefined,
                  };

                return of(result);
              }),
            );
        },
      );

    forkJoin(requests)
      .pipe(
        finalize(() => {
          this.isAddingUser = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (results) => {
          const successfulResults =
            results.filter(
              (result) =>
                result.success,
            );

          const failedResults =
            results.filter(
              (result) =>
                !result.success,
            );

          if (
            successfulResults.length
          ) {
            this.loadTeam(teamId);
          }

          if (
            !failedResults.length
          ) {
            this.closeModalAfterSuccess();
            return;
          }

          const duplicatedUsers =
            failedResults.filter(
              (result) =>
                result.status === 409,
            );

          const otherFailures =
            failedResults.filter(
              (result) =>
                result.status !== 409,
            );

          const failedUserIds =
            new Set(
              failedResults.map(
                (result) =>
                  result.userId,
              ),
            );

          this.selectedUserIds =
            this.selectedUserIds.filter(
              (userId) =>
                failedUserIds.has(
                  userId,
                ),
            );

          this.selectedUserPositions =
            Object.fromEntries(
              Object.entries(
                this.selectedUserPositions,
              ).filter(([userId]) =>
                failedUserIds.has(
                  userId,
                ),
              ),
            );

          if (
            duplicatedUsers.length &&
            !otherFailures.length
          ) {
            this.addUserErrorMessage =
              duplicatedUsers.length === 1
                ? 'Um dos utilizadores selecionados já pertence à equipa.'
                : `${duplicatedUsers.length} dos utilizadores selecionados já pertencem à equipa.`;

            return;
          }

          if (
            successfulResults.length
          ) {
            this.addUserErrorMessage =
              `${successfulResults.length} utilizador${
                successfulResults.length ===
                1
                  ? ''
                  : 'es'
              } adicionado${
                successfulResults.length ===
                1
                  ? ''
                  : 's'
              }, mas não foi possível adicionar ${failedResults.length}.`;

            return;
          }

          this.addUserErrorMessage =
            failedResults[0]
              ?.message ||
            'Não foi possível adicionar os utilizadores à equipa.';
        },
      });
  }

  removeUserFromTeam(
    user: TeamUser,
  ): void {
    if (
      !this.canManageTeamUsers ||
      !this.teamId ||
      this.removingUserId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Tens a certeza que pretendes remover ${user.name} desta equipa?`,
      );

    if (!confirmed) {
      return;
    }

    const previousUsers = [
      ...this.users,
    ];

    this.removingUserId =
      user.id;

    this.errorMessage = '';
    this.successMessage = '';

    this.users =
      this.users.filter(
        (teamUser) =>
          teamUser.id !== user.id,
      );

    this.teamService
      .removeUserFromTeam(
        this.teamId,
        user.id,
      )
      .pipe(
        finalize(() => {
          this.removingUserId = '';
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.successMessage =
            `${user.name} foi removido da equipa com sucesso.`;

          window.setTimeout(() => {
            this.successMessage = '';
            this.cdr.detectChanges();
          }, 5000);
        },

        error: (error) => {
          this.users =
            previousUsers;

          this.errorMessage =
            error?.error?.message ||
            'Não foi possível remover o utilizador da equipa.';
        },
      });
  }

  isRemovingUser(
    userId: string,
  ): boolean {
    return (
      this.removingUserId ===
      userId
    );
  }

  getTeamUserPositionLabel(
    user: TeamUser,
  ): string {
    const position =
      user.position?.trim() ||
      this.team?.positionList[
        user.positionIndex
      ]?.trim() ||
      'Sem posição selecionada';

    const teamRole =
      this.team?.role?.trim();

    return teamRole
      ? `${teamRole} - ${position}`
      : position;
  }

  getAddUsersButtonText(): string {
    if (this.isAddingUser) {
      return 'A adicionar...';
    }

    if (
      this.selectedUsersCount === 1
    ) {
      return 'Adicionar 1 utilizador';
    }

    if (
      this.selectedUsersCount > 1
    ) {
      return `Adicionar ${this.selectedUsersCount} utilizadores`;
    }

    return 'Adicionar à equipa';
  }

  getProfilePictureUrl(
    user:
      TeamUser |
      ProfileUser,
  ): string | null {
    if (!user.profilePicture) {
      return null;
    }

    return `${environment.apiUrl}/api/users/${user.id}/profile-picture`;
  }

  getInitial(
    name: string,
  ): string {
    return (
      name
        ?.charAt(0)
        .toUpperCase() ||
      '?'
    );
  }

  trackUserById(
    _index: number,
    user: ProfileUser,
  ): string {
    return user.id;
  }

  trackTeamUserById(
    _index: number,
    user: TeamUser,
  ): string {
    return user.id;
  }

  private resetUserSelection(): void {
    this.selectedUserIds = [];
    this.selectedUserPositions = {};
  }

  private removeSelectedUserPosition(
    userId: string,
  ): void {
    const nextPositions = {
      ...this.selectedUserPositions,
    };

    delete nextPositions[userId];

    this.selectedUserPositions =
      nextPositions;
  }

  private closeModalAfterSuccess(): void {
    this.showAddUserModal = false;

    this.resetUserSelection();

    this.userSearch = '';

    this.availableUsers = [];
    this.filteredAvailableUsers = [];

    this.addUserErrorMessage = '';
  }

  private normalizeText(
    value:
      string |
      null |
      undefined,
  ): string {
    return (value || '')
      .trim()
      .toLocaleLowerCase('pt-PT')
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      );
  }

  isFirstUserOfPosition(
    index: number,
    user: TeamUser,
  ): boolean {
    if (index === 0) {
      return true;
    }

    return (
      this.users[index - 1]
        ?.positionIndex !==
      user.positionIndex
    );
  }

  getPositionGroupLabel(
    user: TeamUser,
  ): string {
    return (
      user.position?.trim() ||
      this.team?.positionList[
        user.positionIndex
      ]?.trim() ||
      'Sem posição definida'
    );
  }

  onCommissionBackdropPointerDown(
    event: PointerEvent,
  ): void {
    if (
      event.target !==
      event.currentTarget
    ) {
      return;
    }

    this.closeCommissionModal();
  }
}