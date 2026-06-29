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
      companyId: 'edp',
      name: 'EDP',
      logo: '_images/companies/edp.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'endesa',
      name: 'Endesa',
      logo: '_images/companies/endesa.png',
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
      companyId: 'iberdrola',
      name: 'Iberdrola',
      logo: '_images/companies/iberdrola.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'plenitude',
      name: 'Plenitude',
      logo: '_images/companies/plenitude.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'goldenergy',
      name: 'Goldenergy',
      logo: '_images/companies/goldenergy.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'portugal-gas',
      name: 'Portugalgás',
      logo: '_images/companies/portugal-gas.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'ezu',
      name: 'EZU Energia',
      logo: '_images/companies/ezu.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'galp',
      name: 'Galp',
      logo: '_images/companies/galp.png',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'yes-energy',
      name: 'Yes Energy',
      logo: '_images/companies/yes-energy.png',
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
