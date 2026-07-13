import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

import { Company, CompanyService } from '../../../core/services/company';

type KnowledgeCompanyAction = 'campaigns' | 'forms' | 'training';

interface KnowledgeCompanyConfig {
  companyId: string;
  name: string;
  logo: string;
  formsFolderId: string;
  trainingFolderId: string;
}

@Component({
  selector: 'app-knowledge-base-home',
  imports: [CommonModule],
  templateUrl: './knowledge-base-home.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './knowledge-base-home.scss',
})
export class KnowledgeBaseHome implements OnInit {
  private readonly companyService = inject(CompanyService);
  private readonly router = inject(Router);

  companies: Company[] = [];

  isLoading = false;
  errorMessage = '';

  companyConfigs: KnowledgeCompanyConfig[] = [
    {
      companyId: 'cmp_njRqliQBpR',
      name: 'Repsol',
      logo: 'assets/companies/repsol.png',
      formsFolderId: 'COLOCAR_ID_PASTA_FORMULARIOS_REPSOL',
      trainingFolderId: 'COLOCAR_ID_PASTA_FORMACOES_REPSOL',
    },
    {
      companyId: 'cmp_StOnumtpT5',
      name: 'wallbox',
      logo: 'assets/companies/wallbox.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'cmp_KCnjrA0i-U',
      name: 'Meo Energias',
      logo: 'assets/companies/meo.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'cmp_cYTHohh7uo',
      name: 'Ezu',
      logo: 'assets/companies/ezu.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'cmp_Q5MgNAInW6',
      name: 'Galp',
      logo: 'assets/companies/galp.png',
      formsFolderId: 'kfo_w4m6x9244j',
      trainingFolderId: '',
    },
    {
      companyId: 'cmp_JHtuvY63fm',
      name: 'Iberdrola',
      logo: 'assets/companies/iberdrola.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'cmp_1GdwakqCnA',
      name: 'Yes Energy',
      logo: 'assets/companies/yes.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'cmp_4xFQ0RiwtJ',
      name: 'Endesa',
      logo: 'assets/companies/endesa.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'cmp_2AH_yvQ8Wn',
      name: 'Portulogos',
      logo: 'assets/companies/portulogos.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'cmp_s4mjPGw-gJ',
      name: 'Nossa Energia',
      logo: 'assets/companies/nossa-energia.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'cmp_r26ycsfqpu',
      name: 'Audax',
      logo: 'assets/companies/audax.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'cmp_KXGnjPcbx-',
      name: 'Plenitude',
      logo: 'assets/companies/plenitude.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
  ];

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.companyService.getCompanies().subscribe({
      next: (companies) => {
        this.companies = companies.filter((company) => company.active);
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar as empresas.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  getVisibleCompanies(): KnowledgeCompanyConfig[] {
    if (!this.companies.length) {
      return this.companyConfigs;
    }

    return this.companyConfigs.filter((config) =>
      this.companies.some(
        (company) =>
          company.id === config.companyId ||
          company.name.trim().toLowerCase() === config.name.trim().toLowerCase(),
      ),
    );
  }

  openCompanyAction(company: KnowledgeCompanyConfig, action: KnowledgeCompanyAction): void {
    if (action === 'campaigns') {
      this.router.navigate(['/home/knowledge-base/campaigns', company.companyId], {
        queryParams: {
          name: company.name,
        },
      });

      return;
    }

    const folderId = action === 'forms' ? company.formsFolderId : company.trainingFolderId;

    if (!folderId) {
      this.errorMessage = 'Ainda não existe uma pasta configurada para esta opção.';

      return;
    }

    this.router.navigate(['/home/knowledge-base/folders', folderId], {
      queryParams: {
        name:
          action === 'forms'
            ? `${company.name} - Formulários de Adesão`
            : `${company.name} - Formações`,
      },
    });
  }
}
