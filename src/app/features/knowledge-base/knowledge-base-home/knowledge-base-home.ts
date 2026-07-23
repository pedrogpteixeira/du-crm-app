import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';

import { Company, CompanyService } from '../../../core/services/company';

type KnowledgeCompanyAction =
  | 'campaigns'
  | 'support'
  | 'forms'
  | 'training';

interface KnowledgeCompanyConfig {
  companyId: string;
  name: string;
  logo: string;
  supportFolderId: string;
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
      supportFolderId: 'kfo_dg07x7l18v',
      formsFolderId: 'kfo_i35rytegr3',
      trainingFolderId: 'kfo_i0z03220l9',
    },
    {
      companyId: 'cmp_StOnumtpT5',
      name: 'wallbox',
      logo: 'assets/companies/wallbox.png',
      supportFolderId: 'kfo_x60fzc7xlh',
      formsFolderId: 'kfo_yuicpeb2ok',
      trainingFolderId: 'kfo_lv7nw6cywu',
    },
    {
      companyId: 'cmp_KCnjrA0i-U',
      name: 'Meo Energias',
      logo: 'assets/companies/meo.png',
      supportFolderId: 'kfo_fg00yogo42',
      formsFolderId: 'kfo_k3d6olqieh',
      trainingFolderId: 'kfo_u30hhp4joj',
    },
    {
      companyId: 'cmp_cYTHohh7uo',
      name: 'Ezu',
      logo: 'assets/companies/ezu.png',
      supportFolderId: 'kfo_rw8suqgvg9',
      formsFolderId: 'kfo_v2960oyoj1',
      trainingFolderId: 'kfo_c9s9h4pyan',
    },
    {
      companyId: 'cmp_Q5MgNAInW6',
      name: 'Galp',
      logo: 'assets/companies/galp.png',
      supportFolderId: 'kfo_yoxtelc7hj',
      formsFolderId: 'kfo_dymwpxdy36',
      trainingFolderId: 'kfo_ajzrw8mu2h',
    },
    {
      companyId: 'cmp_JHtuvY63fm',
      name: 'Iberdrola',
      logo: 'assets/companies/iberdrola.png',
      supportFolderId: 'kfo_iabn8mqp2u',
      formsFolderId: 'kfo_fo6btqzxy4',
      trainingFolderId: 'kfo_9ndbemqtt9',
    },
    {
      companyId: 'cmp_1GdwakqCnA',
      name: 'Yes Energy',
      logo: 'assets/companies/yes.png',
      supportFolderId: 'kfo_gjbx3z3c9a',
      formsFolderId: 'kfo_8rujt3nd8e',
      trainingFolderId: 'kfo_o8dvkh0ds6',
    },
    {
      companyId: 'cmp_4xFQ0RiwtJ',
      name: 'Endesa',
      logo: 'assets/companies/endesa.png',
      supportFolderId: 'kfo_tlqa9gkhyk',
      formsFolderId: 'kfo_d4uiwp3mjx',
      trainingFolderId: 'kfo_kdx0txkw7x',
    },
    {
      companyId: 'cmp_2AH_yvQ8Wn',
      name: 'Portulogos',
      logo: 'assets/companies/portulogos.png',
      supportFolderId: 'kfo_meil5tyc3k',
      formsFolderId: 'kfo_tt767dkyph',
      trainingFolderId: 'kfo_7gsz8xw1r2',
    },
    {
      companyId: 'cmp_s4mjPGw-gJ',
      name: 'Nossa Energia',
      logo: 'assets/companies/nossa-energia.png',
      supportFolderId: 'kfo_88lrw1pbod',
      formsFolderId: 'kfo_6k9pc8uuxa',
      trainingFolderId: 'kfo_37keno5y89',
    },
    {
      companyId: 'cmp_r26ycsfqpu',
      name: 'Audax',
      logo: 'assets/companies/audax.png',
      supportFolderId: 'kfo_mo9oz4l2t3',
      formsFolderId: 'kfo_bexh6hfgcg',
      trainingFolderId: 'kfo_y2ex3vyirg',
    },
    {
      companyId: 'cmp_KXGnjPcbx-',
      name: 'Plenitude',
      logo: 'assets/companies/plenitude.png',
      supportFolderId: 'kfo_ubgu6d5c6t',
      formsFolderId: 'kfo_p9sorelxzk',
      trainingFolderId: 'kfo_u2mhzsq9i9',
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
        this.isLoading = false;
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
          company.name.trim().toLowerCase() ===
            config.name.trim().toLowerCase(),
      ),
    );
  }

  openCompanyAction(
    company: KnowledgeCompanyConfig,
    action: KnowledgeCompanyAction,
  ): void {
    this.errorMessage = '';

    if (action === 'campaigns') {
      this.router.navigate(
        ['/home/knowledge-base/campaigns', company.companyId],
        {
          queryParams: {
            name: company.name,
          },
        },
      );

      return;
    }

    const folderId = this.getFolderId(company, action);

    if (!folderId) {
      this.errorMessage =
        'Ainda não existe uma pasta configurada para esta opção.';

      return;
    }

    this.router.navigate(['/home/knowledge-base/folders', folderId], {
      queryParams: {
        name: this.getFolderName(company, action),
      },
    });
  }

  private getFolderId(
    company: KnowledgeCompanyConfig,
    action: Exclude<KnowledgeCompanyAction, 'campaigns'>,
  ): string {
    switch (action) {
      case 'support':
        return company.supportFolderId;

      case 'forms':
        return company.formsFolderId;

      case 'training':
        return company.trainingFolderId;
    }
  }

  private getFolderName(
    company: KnowledgeCompanyConfig,
    action: Exclude<KnowledgeCompanyAction, 'campaigns'>,
  ): string {
    switch (action) {
      case 'support':
        return `${company.name} - Suporte`;

      case 'forms':
        return `${company.name} - Formulários de Adesão`;

      case 'training':
        return `${company.name} - Formações`;
    }
  }
}