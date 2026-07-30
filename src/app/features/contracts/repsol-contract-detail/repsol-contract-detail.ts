import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, map, of, switchMap } from 'rxjs';

import { Auth } from '../../../core/services/auth';
import {
  Campaign,
  CampaignService,
} from '../../../core/services/campaign';
import {
  RepsolContractDetail as RepsolContractDetailModel,
  RepsolContractDocument,
  RepsolContractService,
  RepsolContractStatus,
  UpdateRepsolContractRequest,
} from '../../../core/services/repsol-contract';
import { PreferencesService } from '../../../core/services/preferences';
import { SocketService } from '../../../core/services/socket';

type CampaignSelectionMode = 'existing' | 'other';

interface EditableContractForm {
  nomeClienteEmpresa: string;
  nif: number | null;
  telefone: number | null;
  email: string;
  cae: string;
  crc: string;

  tipoSegmento: string;
  tipoProduto: string;
  contratacao: string;
  tipoContratacaoLuz: string;
  tipoContratacaoGas: string;

  controleQualidade: string;
  codigoRegistoCE: string;
  nomeRegistoCE: string;
  estado: RepsolContractStatus;

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
  potencia: string | number | null;
  escalao: number | null;
  cicloHorario: string;
  nivelTensao: string;


  campaignId: string;
  customCampaign: string;
}

interface AuthenticatedUserLike {
  id?: string;
  _id?: string;
  role?: string;
  name?: string;
  username?: string;
}

@Component({
  selector: 'app-repsol-contract-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: './repsol-contract-detail.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './repsol-contract-detail.scss',
})
export class RepsolContractDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(Auth);
  private readonly campaignService = inject(CampaignService);
  private readonly repsolContractService =
    inject(RepsolContractService);
  private readonly preferencesService =
    inject(PreferencesService);
  private readonly socketService = inject(SocketService);

  private currentUserId = '';
  private currentUserName = '';
  private suppressNextOwnSocketUpdate = false;
  private ownSocketSuppressionTimer:
    ReturnType<typeof setTimeout> | null = null;

  contract: RepsolContractDetailModel | null = null;
  campaigns: Campaign[] = [];

  observationDraft = '';
  selectedFiles: File[] = [];
  deletingAttachmentFileNames = new Set<string>();

  editForm = this.buildEmptyEditForm();
  originalEditForm = this.buildEmptyEditForm();

  campaignSelectionMode: CampaignSelectionMode = 'existing';
  originalCampaignSelectionMode: CampaignSelectionMode = 'existing';

  collapsedSections = this.buildCollapsedSections(false);

  isLoading = false;
  isSaving = false;
  isEditing = false;
  isSuperAdmin = false;

  errorMessage = '';
  successMessage = '';
  socketMessage = '';

  contractId = '';
  lastSocketUpdate = '';

  readonly tipoSegmentoOptions = [
    'Residencial',
    'Empresarial',
    'Condomínios',
  ];

  readonly tipoProdutoOptions = [
    'Luz',
    'Luz + Gás',
    'Gás',
  ];

  readonly contratacaoOptions = [
    'Contratação Papel',
    'Contratação Digital',
  ];

  readonly tipoContratacaoOptions = [
    'Mudança de Comercializadora',
    'Mudança de Comercializadora & AT',
    'Entrada Direta',
  ];

  readonly estadoOptions: RepsolContractStatus[] = [
    'Pedido de Chamada',
    'Em validação',
    'Chamada Efetuada',
    'Pendente Assinatura Digital',
    'Não Conformidade',
    'Pendente Docs',
    'Documentos Enviados',
    'Atribuído',
  ];

  readonly cicloHorarioOptions = [
    'Simples',
    'Bi-Horário Diário',
    'Bi-Horário Semanal',
    'Tri-Horário Diário',
    'Tri-Horário Semanal',
    'Tetra-Horário',
  ];

  readonly nivelTensaoOptions = [
    'Monofásico',
    'Trifásico',
  ];

  ngOnInit(): void {
    this.resolvePermissions();

    const collapseByDefault =
      this.preferencesService
        .getPreferences()
        .contractDetailsCollapsedByDefault;

    this.collapsedSections =
      this.buildCollapsedSections(collapseByDefault);

    this.route.paramMap.subscribe((params) => {
      this.contractId = params.get('id') ?? '';

      if (this.contractId) {
        this.loadContract(this.contractId);
      }
    });

    this.socketService
      .listenRepsolContractUpdated()
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

        if (
          !eventUserId &&
          this.suppressNextOwnSocketUpdate
        ) {
          return;
        }

        const currentTime =
          new Date().toLocaleTimeString('pt-PT');

        this.lastSocketUpdate = currentTime;

        if (this.isEditing) {
          this.synchronizeExternalUpdate(currentTime);
          return;
        }

        this.socketMessage =
          `Este contrato foi atualizado por outro utilizador às ${currentTime}.`;

        this.loadContract(this.contractId);
      });
  }

  loadContract(contractId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.repsolContractService
      .getRepsolContractById(contractId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (contract) => {
          this.contract = contract;
          this.initializeEditForm(contract);
          this.loadCampaigns(contract.companyId);
        },
        error: () => {
          this.showError(
            'Não foi possível carregar o contrato Repsol.',
          );
        },
      });
  }

  startEditing(): void {
    if (!this.isSuperAdmin || !this.contract) {
      return;
    }

    this.initializeEditForm(this.contract);
    this.observationDraft = '';
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

    if (!this.editForm.telefone) {
      this.showError('O telefone é obrigatório.');
      return;
    }

    const campaignValue = this.getCurrentCampaignValue();

    if (!campaignValue) {
      this.showError(
        this.campaignSelectionMode === 'other'
          ? 'O nome da campanha é obrigatório.'
          : 'É obrigatório selecionar uma campanha.',
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
      ? this.repsolContractService.updateRepsolContract(
          this.contractId,
          payload,
        )
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

          return this.repsolContractService
            .uploadAttachments(
              this.contractId,
              this.selectedFiles,
            )
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
        next: ({
          contract: updatedContract,
          uploadFailed,
          uploadError,
        }) => {
          this.contract = updatedContract;
          this.initializeEditForm(updatedContract);
          this.observationDraft = '';

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
              : 'Contrato atualizado com sucesso.',
          );
        },
        error: (error) => {
          this.clearOwnSocketSuppression();
          this.showError(
            error?.error?.details?.join(' ') ||
              error?.error?.message ||
              'Não foi possível atualizar o contrato Repsol.',
          );
        },
      });
  }

  onCampaignModeChange(): void {
    if (this.campaignSelectionMode === 'other') {
      this.editForm.campaignId = '';
      return;
    }

    this.editForm.customCampaign = '';
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files
      ? Array.from(input.files)
      : [];

    if (!files.length) {
      return;
    }

    const existingFileKeys = new Set(
      this.selectedFiles.map((file) =>
        this.getFileKey(file),
      ),
    );

    const newFiles = files.filter(
      (file) =>
        !existingFileKeys.has(this.getFileKey(file)),
    );

    this.selectedFiles = [
      ...this.selectedFiles,
      ...newFiles,
    ];

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

  deleteAttachment(
    document: RepsolContractDocument,
  ): void {
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
    this.deletingAttachmentFileNames =
      new Set(this.deletingAttachmentFileNames);

    this.contract = {
      ...previousContract,
      documentos: previousContract.documentos.filter(
        (existingDocument) =>
          existingDocument.fileName !== document.fileName,
      ),
    };

    this.errorMessage = '';
    this.successMessage = '';
    this.prepareOwnSocketSuppression();

    this.repsolContractService
      .deleteAttachment(
        this.contractId,
        document.fileName,
      )
      .pipe(
        finalize(() => {
          this.deletingAttachmentFileNames.delete(
            document.fileName,
          );
          this.deletingAttachmentFileNames =
            new Set(this.deletingAttachmentFileNames);
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

  isDeletingAttachment(
    document: RepsolContractDocument,
  ): boolean {
    return this.deletingAttachmentFileNames.has(
      document.fileName,
    );
  }

  private getFileKey(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  private resolvePermissions(): void {
    const currentUser =
      this.auth.getCurrentUser() as AuthenticatedUserLike | null;

    const role = currentUser?.role?.toLowerCase() ?? '';

    this.currentUserId =
      currentUser?.id ?? currentUser?._id ?? '';
    this.currentUserName =
      currentUser?.name ??
      currentUser?.username ??
      'Utilizador';
    this.isSuperAdmin = role.includes('super admin');
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
    this.repsolContractService
      .getRepsolContractById(this.contractId)
      .subscribe({
        next: (latestContract) => {
          const result = this.mergeExternalContract(latestContract);

          this.contract = latestContract;

          if (result.conflicts > 0) {
            this.socketMessage =
              `Este contrato foi atualizado por outro utilizador às ${currentTime}. ` +
              `${result.updated} campo(s) não alterado(s) por si foram atualizados automaticamente. ` +
              `${result.conflicts} campo(s) que também estava a editar foram preservados com os seus valores. ` +
              'Ao guardar, os seus valores nesses campos irão prevalecer.';
            return;
          }

          this.socketMessage =
            `Este contrato foi atualizado por outro utilizador às ${currentTime}. ` +
            `${result.updated} campo(s) não alterado(s) por si foram atualizados automaticamente, ` +
            'incluindo o histórico de observações e os anexos, sem perder o seu rascunho nem os ficheiros selecionados.';
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
    latestContract: RepsolContractDetailModel,
  ): { updated: number; conflicts: number } {
    const latestState = this.buildEditableState(latestContract);
    const nextEditForm = structuredClone(this.editForm);
    const nextOriginalForm = structuredClone(this.originalEditForm);

    let updated = 0;
    let conflicts = 0;

    const campaignKeys: Array<keyof EditableContractForm> = [
      'campaignId',
      'customCampaign',
    ];

    const keys = Object.keys(
      latestState.form,
    ) as Array<keyof EditableContractForm>;

    keys.forEach((key) => {
      if (campaignKeys.includes(key)) {
        return;
      }

      const currentValue = this.editForm[key];
      const originalValue = this.originalEditForm[key];
      const latestValue = latestState.form[key];

      const userChanged = !this.areValuesEqual(
        currentValue,
        originalValue,
      );
      const serverChanged = !this.areValuesEqual(
        latestValue,
        originalValue,
      );

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

    const currentCampaign = this.getCampaignSnapshot(
      this.campaignSelectionMode,
      this.editForm,
    );
    const originalCampaign = this.getCampaignSnapshot(
      this.originalCampaignSelectionMode,
      this.originalEditForm,
    );
    const latestCampaign = this.getCampaignSnapshot(
      latestState.campaignMode,
      latestState.form,
    );

    const userChangedCampaign = !this.areValuesEqual(
      currentCampaign,
      originalCampaign,
    );
    const serverChangedCampaign = !this.areValuesEqual(
      latestCampaign,
      originalCampaign,
    );

    if (serverChangedCampaign) {
      if (!userChangedCampaign) {
        this.campaignSelectionMode = latestState.campaignMode;
        nextEditForm.campaignId = latestState.form.campaignId;
        nextEditForm.customCampaign = latestState.form.customCampaign;
        updated += 1;
      } else if (!this.areValuesEqual(currentCampaign, latestCampaign)) {
        conflicts += 1;
      }

      this.originalCampaignSelectionMode = latestState.campaignMode;
      nextOriginalForm.campaignId = latestState.form.campaignId;
      nextOriginalForm.customCampaign = latestState.form.customCampaign;
    }

    this.editForm = nextEditForm;
    this.originalEditForm = nextOriginalForm;

    return { updated, conflicts };
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
          ? form.customCampaign.trim()
          : form.campaignId,
    };
  }

  private areValuesEqual(
    firstValue: unknown,
    secondValue: unknown,
  ): boolean {
    return JSON.stringify(this.normalizeValue(firstValue)) ===
      JSON.stringify(this.normalizeValue(secondValue));
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

  private loadCampaigns(companyId: string): void {
    this.campaignService
      .getCampaignsByCompanyId(companyId)
      .pipe(
        map((campaigns) => {
          const assignedCampaign = this.contract?.campaign;
          const assignedId = assignedCampaign?.id ?? '';
          const assignedName = this.normalizeCampaignName(
            assignedCampaign?.name ?? '',
          );

          return campaigns.filter((campaign) => {
            const isAssignedById = Boolean(
              assignedId && campaign.id === assignedId,
            );
            const isAssignedByName = Boolean(
              assignedName &&
                this.normalizeCampaignName(campaign.name) ===
                  assignedName,
            );

            return (
              campaign.active ||
              isAssignedById ||
              isAssignedByName
            );
          });
        }),
      )
      .subscribe({
        next: (campaigns) => {
          this.campaigns = campaigns;

          if (this.contract && !this.isEditing) {
            this.initializeEditForm(this.contract);
          }
        },
        error: () => {
          this.showError(
            'Não foi possível carregar as campanhas.',
          );
        },
      });
  }

  private initializeEditForm(
    contract: RepsolContractDetailModel,
  ): void {
    const state = this.buildEditableState(contract);

    this.editForm = structuredClone(state.form);
    this.originalEditForm = structuredClone(state.form);
    this.campaignSelectionMode = state.campaignMode;
    this.originalCampaignSelectionMode = state.campaignMode;
  }

  private buildEditableState(
    contract: RepsolContractDetailModel,
  ): {
    form: EditableContractForm;
    campaignMode: CampaignSelectionMode;
  } {
    const campaign = contract.campaign;
    const resolvedCampaign = this.resolveCampaignSelection(campaign);

    return {
      campaignMode: resolvedCampaign.mode,
      form: {
        nomeClienteEmpresa: contract.nomeClienteEmpresa ?? '',
        nif: contract.nif ?? null,
        telefone: contract.telefone ?? null,
        email: contract.email ?? '',
        cae: contract.cae ?? '',
        crc: contract.crc ?? '',

        tipoSegmento: contract.tipoSegmento ?? '',
        tipoProduto: contract.tipoProduto ?? '',
        contratacao: contract.contratacao ?? '',
        tipoContratacaoLuz: contract.tipoContratacaoLuz ?? '',
        tipoContratacaoGas: contract.tipoContratacaoGas ?? '',

        controleQualidade: contract.controleQualidade ?? '',
        codigoRegistoCE: contract.codigoRegistoCE ?? '',
        nomeRegistoCE: contract.nomeRegistoCE ?? '',
        estado: contract.estado,

        agendamento: this.toDateTimeLocal(contract.agendamento),
        dataAssinatura: this.toDateInput(contract.dataAssinatura),
        dataContrato: this.toDateInput(contract.dataContrato),
        dataRegisto: this.toDateInput(contract.dataRegisto),
        dataAtivacaoCPE: this.toDateInput(contract.dataAtivacaoCPE),
        dataBaixaCPE: this.toDateInput(contract.dataBaixaCPE),
        dataAtivacaoCUI: this.toDateInput(contract.dataAtivacaoCUI),
        dataBaixaCUI: this.toDateInput(contract.dataBaixaCUI),

        moradaInstalacao: contract.moradaInstalacao ?? '',
        moradaFaturacao: contract.moradaFaturacao ?? '',

        faturaEletronica: Boolean(contract.faturaEletronica),
        sva: Boolean(contract.sva),
        debitoDireto: Boolean(contract.debitoDireto),
        iban: contract.iban ?? '',

        antigaComercializadora:
          contract.antigaComercializadora ?? '',
        cpe: contract.cpe ?? '',
        cui: contract.cui ?? '',
        potencia: contract.potencia ?? null,
        escalao: contract.escalao ?? null,
        cicloHorario: contract.cicloHorario ?? '',
        nivelTensao: contract.nivelTensao ?? '',


        campaignId: resolvedCampaign.campaignId,
        customCampaign: resolvedCampaign.customCampaign,
      },
    };
  }

  private resolveCampaignSelection(
    campaign: RepsolContractDetailModel['campaign'],
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

    const campaignId = campaign.id?.trim() ?? '';
    const normalizedName = this.normalizeCampaignName(
      campaign.name,
    );

    const campaignById = campaignId
      ? this.campaigns.find(
          (availableCampaign) =>
            availableCampaign.id === campaignId,
        )
      : undefined;

    const campaignByName = normalizedName
      ? this.campaigns.find(
          (availableCampaign) =>
            this.normalizeCampaignName(
              availableCampaign.name,
            ) === normalizedName,
        )
      : undefined;

    const existingCampaign = campaignById ?? campaignByName;

    if (existingCampaign) {
      return {
        mode: 'existing',
        campaignId: existingCampaign.id,
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
      customCampaign: campaign.name?.trim() ?? '',
    };
  }

  private normalizeCampaignName(value: string): string {
    return value
      .trim()
      .toLocaleLowerCase('pt-PT')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private buildPatchPayload():
    UpdateRepsolContractRequest {
    const payload: UpdateRepsolContractRequest = {};

    this.assignChangedValue(
      payload,
      'nomeClienteEmpresa',
      this.editForm.nomeClienteEmpresa,
      this.originalEditForm.nomeClienteEmpresa,
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
      this.originalEditForm.telefone,
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
      this.editForm.tipoSegmento,
      this.originalEditForm.tipoSegmento,
    );
    this.assignChangedValue(
      payload,
      'tipoProduto',
      this.editForm.tipoProduto,
      this.originalEditForm.tipoProduto,
    );
    this.assignChangedValue(
      payload,
      'contratacao',
      this.editForm.contratacao,
      this.originalEditForm.contratacao,
    );
    this.assignChangedValue(
      payload,
      'tipoContratacaoLuz',
      this.editForm.tipoContratacaoLuz,
      this.originalEditForm.tipoContratacaoLuz,
    );
    this.assignChangedValue(
      payload,
      'tipoContratacaoGas',
      this.editForm.tipoContratacaoGas,
      this.originalEditForm.tipoContratacaoGas,
    );
    this.assignChangedValue(
      payload,
      'controleQualidade',
      this.editForm.controleQualidade,
      this.originalEditForm.controleQualidade,
    );
    this.assignChangedValue(
      payload,
      'codigoRegistoCE',
      this.editForm.codigoRegistoCE,
      this.originalEditForm.codigoRegistoCE,
    );
    this.assignChangedValue(
      payload,
      'nomeRegistoCE',
      this.editForm.nomeRegistoCE,
      this.originalEditForm.nomeRegistoCE,
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
      this.originalEditForm.agendamento,
    );
    this.assignChangedValue(
      payload,
      'dataAssinatura',
      this.editForm.dataAssinatura,
      this.originalEditForm.dataAssinatura,
    );
    this.assignChangedValue(
      payload,
      'dataContrato',
      this.editForm.dataContrato,
      this.originalEditForm.dataContrato,
    );
    this.assignChangedValue(
      payload,
      'dataRegisto',
      this.editForm.dataRegisto,
      this.originalEditForm.dataRegisto,
    );
    this.assignChangedValue(
      payload,
      'dataAtivacaoCPE',
      this.editForm.dataAtivacaoCPE,
      this.originalEditForm.dataAtivacaoCPE,
    );
    this.assignChangedValue(
      payload,
      'dataBaixaCPE',
      this.editForm.dataBaixaCPE,
      this.originalEditForm.dataBaixaCPE,
    );
    this.assignChangedValue(
      payload,
      'dataAtivacaoCUI',
      this.editForm.dataAtivacaoCUI,
      this.originalEditForm.dataAtivacaoCUI,
    );
    this.assignChangedValue(
      payload,
      'dataBaixaCUI',
      this.editForm.dataBaixaCUI,
      this.originalEditForm.dataBaixaCUI,
    );
    this.assignChangedValue(
      payload,
      'moradaInstalacao',
      this.editForm.moradaInstalacao,
      this.originalEditForm.moradaInstalacao,
    );
    this.assignChangedValue(
      payload,
      'moradaFaturacao',
      this.editForm.moradaFaturacao,
      this.originalEditForm.moradaFaturacao,
    );
    this.assignChangedValue(
      payload,
      'faturaEletronica',
      this.editForm.faturaEletronica,
      this.originalEditForm.faturaEletronica,
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
      this.editForm.debitoDireto,
      this.originalEditForm.debitoDireto,
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
      this.editForm.antigaComercializadora,
      this.originalEditForm.antigaComercializadora,
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
      this.originalEditForm.potencia,
    );
    this.assignChangedValue(
      payload,
      'escalao',
      this.editForm.escalao,
      this.originalEditForm.escalao,
    );
    this.assignChangedValue(
      payload,
      'cicloHorario',
      this.editForm.cicloHorario,
      this.originalEditForm.cicloHorario,
    );
    this.assignChangedValue(
      payload,
      'nivelTensao',
      this.editForm.nivelTensao,
      this.originalEditForm.nivelTensao,
    );

    const observationValue = this.buildObservationValue();

    if (observationValue !== null) {
      payload.observacoes = observationValue;
    }

    const currentCampaign = this.getCurrentCampaignValue();
    const originalCampaign = this.getOriginalCampaignValue();

    if (currentCampaign !== originalCampaign) {
      payload.campanha = currentCampaign;
    }

    return payload;
  }

  private assignChangedValue<
    Key extends keyof UpdateRepsolContractRequest,
  >(
    payload: UpdateRepsolContractRequest,
    key: Key,
    currentValue: UpdateRepsolContractRequest[Key],
    originalValue: UpdateRepsolContractRequest[Key],
  ): void {
    const normalizedCurrent =
      this.normalizeValue(currentValue);
    const normalizedOriginal =
      this.normalizeValue(originalValue);

    if (
      JSON.stringify(normalizedCurrent) !==
      JSON.stringify(normalizedOriginal)
    ) {
      payload[key] =
        normalizedCurrent as UpdateRepsolContractRequest[Key];
    }
  }

  private buildObservationValue(): string | null {
    const draft = this.observationDraft.trim();

    if (!draft) {
      return null;
    }

    const currentHistory =
      this.contract?.observacoes?.trim() ?? '';

    const timestamp = new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(new Date())
      .replace(',', '');

    const entry =
      `${this.currentUserName} - ${timestamp} - ${draft}`;

    return currentHistory
      ? `${currentHistory}\n${entry}`
      : entry;
  }

  private getCurrentCampaignValue(): string {
    return this.campaignSelectionMode === 'other'
      ? this.editForm.customCampaign.trim()
      : this.editForm.campaignId;
  }

  private getOriginalCampaignValue(): string {
    return this.originalCampaignSelectionMode === 'other'
      ? this.originalEditForm.customCampaign.trim()
      : this.originalEditForm.campaignId;
  }

  private normalizeValue(value: unknown): unknown {
    return typeof value === 'string'
      ? value.trim()
      : value;
  }

  private toDateInput(
    value: string | null | undefined,
  ): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 10);
    }

    return date.toISOString().slice(0, 10);
  }

  private toDateTimeLocal(
    value: string | null | undefined,
  ): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 16);
    }

    const timezoneOffset =
      date.getTimezoneOffset() * 60_000;

    return new Date(date.getTime() - timezoneOffset)
      .toISOString()
      .slice(0, 16);
  }

  private buildEmptyEditForm(): EditableContractForm {
    return {
      nomeClienteEmpresa: '',
      nif: null,
      telefone: null,
      email: '',
      cae: '',
      crc: '',

      tipoSegmento: '',
      tipoProduto: '',
      contratacao: '',
      tipoContratacaoLuz: '',
      tipoContratacaoGas: '',

      controleQualidade: '',
      codigoRegistoCE: '',
      nomeRegistoCE: '',
      estado: 'Pedido de Chamada',

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
      potencia: null,
      escalao: null,
      cicloHorario: '',
      nivelTensao: '',


      campaignId: '',
      customCampaign: '',
    };
  }

  private buildCollapsedSections(value: boolean) {
    return {
      client: value,
      contract: value,
      status: value,
      billing: value,
      energy: value,
      attachments: value,
      observations: value,
    };
  }

  toggleSection(
    section: keyof typeof this.collapsedSections,
  ): void {
    this.collapsedSections[section] =
      !this.collapsedSections[section];
  }

  getStatusClass(status: RepsolContractStatus): string {
    return {
      'Pedido de Chamada': 'status-call-request',
      'Em validação': 'status-validation',
      'Chamada Efetuada': 'status-call-done',
      'Pendente Assinatura Digital': 'status-signature',
      'Não Conformidade': 'status-non-compliance',
      'Pendente Docs': 'status-docs',
      'Documentos Enviados': 'status-docs-sent',
      Atribuído: 'status-assigned',
    }[status];
  }

  downloadDocument(file: RepsolContractDocument): void {
    if (!this.contract?.id) {
      return;
    }

    this.repsolContractService
      .downloadDocument(this.contract.id, file)
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = window.document.createElement('a');

          link.href = url;
          link.download = file.originalName || file.fileName;

          window.document.body.appendChild(link);
          link.click();
          window.document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.showError(
            'Não foi possível descarregar o anexo.',
          );
        },
      });
  }

  formatBoolean(value: boolean): string {
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

  getValue(
    value: string | number | null | undefined,
  ): string | number {
    return value || '-';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  getFileIcon(mimetype: string): string {
    if (mimetype.startsWith('audio/')) {
      return '🎧';
    }

    if (mimetype.includes('pdf')) {
      return '📄';
    }

    if (mimetype.includes('word')) {
      return '📝';
    }

    if (mimetype.startsWith('image/')) {
      return '🖼️';
    }

    return '📎';
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