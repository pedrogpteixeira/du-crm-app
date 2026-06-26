import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  Campaign,
  CampaignService,
} from '../../../core/services/campaign';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-knowledge-campaigns',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './knowledge-campaigns.html',
  styleUrl: './knowledge-campaigns.scss',
})
export class KnowledgeCampaigns implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly campaignService = inject(CampaignService);

  companyId = '';
  companyName = 'Empresa';

  campaigns: Campaign[] = [];

  showCreateCampaignModal = false;
  isCreatingCampaign = false;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  updatingCampaignId: string | null = null;
  deletingCampaignId: string | null = null;

  newCampaign = {
    name: '',
    active: true,
    startDate: '',
    endDate: '',
  };

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.companyId = params.get('companyId') || '';
      this.companyName =
        this.route.snapshot.queryParamMap.get('name') || 'Empresa';

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
            item.id === updatedCampaign.id
              ? updatedCampaign
              : item,
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
    this.showCreateCampaignModal = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeCreateCampaignModal(): void {
    this.showCreateCampaignModal = false;

    this.newCampaign = {
      name: '',
      active: true,
      startDate: '',
      endDate: '',
    };
  }

  createCampaign(): void {
    if (!this.newCampaign.name.trim()) {
      this.errorMessage = 'O nome da campanha é obrigatório.';
      return;
    }

    this.isCreatingCampaign = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload: any = {
      companyId: this.companyId,
      name: this.newCampaign.name.trim(),
      active: this.newCampaign.active,
    };

    if (this.newCampaign.startDate) {
      payload.startDate = new Date(
        this.newCampaign.startDate,
      ).toISOString();
    }

    if (this.newCampaign.endDate) {
      payload.endDate = new Date(
        this.newCampaign.endDate,
      ).toISOString();
    }

    this.campaignService.createCampaign(payload)
      .subscribe({
        next: (campaign) => {
          this.campaigns = [campaign, ...this.campaigns];

          this.closeCreateCampaignModal();

          this.successMessage = 'Campanha criada com sucesso.';
          this.clearSuccessMessage();
        },
        error: (error) => {
          this.errorMessage =
            error.error?.message ||
            'Não foi possível criar a campanha.';
        },
        complete: () => {
          this.isCreatingCampaign = false;
        },
      });
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

  private clearSuccessMessage(): void {
    setTimeout(() => {
      this.successMessage = '';
    }, 2500);
  }

  deleteCampaign(campaign: Campaign): void {
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
        this.campaigns = this.campaigns.filter(
          (item) => item.id !== campaign.id,
        );

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