import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  Campaign,
  CampaignService,
  CreateCampaignRequest,
} from '../../../core/services/campaign';
import { FormsModule } from '@angular/forms';

import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-knowledge-campaigns',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './knowledge-campaigns.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './knowledge-campaigns.scss',
})
export class KnowledgeCampaigns implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly campaignService = inject(CampaignService);
  private readonly auth = inject(Auth);

  companyId = '';
  companyName = 'Empresa';

  campaigns: Campaign[] = [];

  showCreateCampaignModal = false;
  showEditCampaignModal = false;
  isCreatingCampaign = false;
  isEditingCampaign = false;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  updatingCampaignId: string | null = null;
  deletingCampaignId: string | null = null;

  readonly canManageCampaigns =
    this.auth.roleIncludes(
      'Super Admin',
    );

  newCampaign = {
    name: '',
    active: true,
    loyalty: false,
    chargebackDays: null as number | null,
    startDate: '',
    endDate: '',
  };

  editingCampaign: Campaign | null = null;

  editCampaign = {
    active: true,
    loyalty: false,
    chargebackDays: null as number | null,
  };

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.companyId = params.get('companyId') || '';
      this.companyName = this.route.snapshot.queryParamMap.get('name') || 'Empresa';

      if (this.companyId) {
        this.loadCampaigns();
      }
    });
  }

  loadCampaigns(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.campaignService.getCampaignsByCompanyId(this.companyId).subscribe({
      next: (campaigns) => {
        this.campaigns = campaigns;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar as campanhas.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  toggleCampaign(campaign: Campaign): void {
    if (!this.canManageCampaigns) {
      return;
    }

    const newActiveValue = !campaign.active;

    this.updatingCampaignId = campaign.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.campaignService
      .updateCampaign(campaign.id, {
        active: newActiveValue,
      })
      .subscribe({
        next: (updatedCampaign) => {
          this.campaigns = this.campaigns.map((item) =>
            item.id === updatedCampaign.id ? updatedCampaign : item,
          );

          this.successMessage = updatedCampaign.active
            ? 'Campanha ativada com sucesso.'
            : 'Campanha desativada com sucesso.';

          this.clearSuccessMessage();
        },
        error: (error) => {
          if (error?.status === 400) {
            this.errorMessage = 'A campanha já se encontra nesse estado.';
            return;
          }

          this.errorMessage = 'Não foi possível atualizar a campanha.';
        },
        complete: () => {
          this.updatingCampaignId = null;
        },
      });
  }

  openCreateCampaignModal(): void {
    if (!this.canManageCampaigns) {
      return;
    }

    this.showCreateCampaignModal = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeCreateCampaignModal(): void {
    this.showCreateCampaignModal = false;

    this.newCampaign = {
      name: '',
      active: true,
      loyalty: false,
      chargebackDays: null,
      startDate: '',
      endDate: '',
    };
  }

  createCampaign(): void {
    if (!this.canManageCampaigns) {
      return;
    }

    if (!this.newCampaign.name.trim()) {
      this.errorMessage = 'O nome da campanha é obrigatório.';
      return;
    }

    const chargebackError = this.getChargebackDaysError(
      this.newCampaign.chargebackDays,
    );

    if (chargebackError) {
      this.errorMessage = chargebackError;
      return;
    }

    this.isCreatingCampaign = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload: CreateCampaignRequest = {
      companyId: this.companyId,
      name: this.newCampaign.name.trim(),
      active: this.newCampaign.active,
      loyalty: this.newCampaign.loyalty,
      chargebackDays: this.normalizeChargebackDays(
        this.newCampaign.chargebackDays,
      ),
    };

    if (this.newCampaign.startDate) {
      payload.startDate = new Date(this.newCampaign.startDate).toISOString();
    }

    if (this.newCampaign.endDate) {
      payload.endDate = new Date(this.newCampaign.endDate).toISOString();
    }

    this.campaignService.createCampaign(payload).subscribe({
      next: (campaign) => {
        this.campaigns = [campaign, ...this.campaigns];

        this.closeCreateCampaignModal();

        this.successMessage = 'Campanha criada com sucesso.';
        this.clearSuccessMessage();
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Não foi possível criar a campanha.';
      },
      complete: () => {
        this.isCreatingCampaign = false;
      },
    });
  }

  openEditCampaignModal(campaign: Campaign): void {
    if (!this.canManageCampaigns) {
      return;
    }

    this.editingCampaign = campaign;
    this.editCampaign = {
      active: campaign.active,
      loyalty: campaign.loyalty,
      chargebackDays: campaign.chargebackDays ?? null,
    };

    this.showEditCampaignModal = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeEditCampaignModal(): void {
    if (this.isEditingCampaign) {
      return;
    }

    this.showEditCampaignModal = false;
    this.editingCampaign = null;
    this.editCampaign = {
      active: true,
      loyalty: false,
      chargebackDays: null,
    };
  }

  saveCampaignChanges(): void {
    if (!this.canManageCampaigns || !this.editingCampaign) {
      return;
    }

    const chargebackError = this.getChargebackDaysError(
      this.editCampaign.chargebackDays,
    );

    if (chargebackError) {
      this.errorMessage = chargebackError;
      return;
    }

    this.isEditingCampaign = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.campaignService
      .updateCampaign(this.editingCampaign.id, {
        active: this.editCampaign.active,
        loyalty: this.editCampaign.loyalty,
        chargebackDays: this.normalizeChargebackDays(
          this.editCampaign.chargebackDays,
        ),
      })
      .subscribe({
        next: (updatedCampaign) => {
          this.campaigns = this.campaigns.map((item) =>
            item.id === updatedCampaign.id ? updatedCampaign : item,
          );

          this.showEditCampaignModal = false;
          this.editingCampaign = null;
          this.successMessage = 'Campanha atualizada com sucesso.';
          this.clearSuccessMessage();
        },
        error: (error) => {
          this.errorMessage =
            error.error?.message || 'Não foi possível atualizar a campanha.';
        },
        complete: () => {
          this.isEditingCampaign = false;
        },
      });
  }

  get newCampaignChargebackError(): string {
    return this.getChargebackDaysError(this.newCampaign.chargebackDays);
  }

  get editCampaignChargebackError(): string {
    return this.getChargebackDaysError(this.editCampaign.chargebackDays);
  }

  formatChargebackDays(chargebackDays?: number | null): string {
    return chargebackDays == null
      ? 'Não configurado'
      : `${chargebackDays} ${chargebackDays === 1 ? 'dia' : 'dias'}`;
  }

  formatDate(date?: string | null): string {
    if (!date) {
      return '—';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsedDate);
  }

  private getChargebackDaysError(
    rawValue: number | string | null | undefined,
  ): string {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return '';
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return 'Introduza um número inteiro de dias.';
    }

    if (value < 0) {
      return 'O número de dias não pode ser negativo.';
    }

    return '';
  }

  private normalizeChargebackDays(
    rawValue: number | string | null | undefined,
  ): number | null {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }

    return Number(rawValue);
  }

  private clearSuccessMessage(): void {
    setTimeout(() => {
      this.successMessage = '';
    }, 2500);
  }

  deleteCampaign(campaign: Campaign): void {
    if (!this.canManageCampaigns) {
      return;
    }

    const confirmed = confirm(
      `Tens a certeza que pretendes eliminar a campanha "${campaign.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    this.deletingCampaignId = campaign.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.campaignService.deleteCampaign(campaign.id).subscribe({
      next: () => {
        this.campaigns = this.campaigns.filter((item) => item.id !== campaign.id);

        this.successMessage = 'Campanha eliminada com sucesso.';
        this.clearSuccessMessage();
      },
      error: () => {
        this.errorMessage = 'Não foi possível eliminar a campanha.';
      },
      complete: () => {
        this.deletingCampaignId = null;
      },
    });
  }
}
