import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  Campaign,
  CampaignService,
} from '../../../core/services/campaign';

@Component({
  selector: 'app-knowledge-campaigns',
  imports: [CommonModule, RouterLink],
  templateUrl: './knowledge-campaigns.html',
  styleUrl: './knowledge-campaigns.scss',
})
export class KnowledgeCampaigns implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly campaignService = inject(CampaignService);

  companyId = '';
  companyName = 'Empresa';

  campaigns: Campaign[] = [];

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  updatingCampaignId: string | null = null;

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

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  }

  private clearSuccessMessage(): void {
    setTimeout(() => {
      this.successMessage = '';
    }, 2500);
  }
}