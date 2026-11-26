import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Company, CompanyService } from '../../../core/services/company';

type KnowledgeCompanyAction = 'campaigns' | 'support' | 'forms' | 'training';

interface KnowledgeCompanyConfig {
  companyId: string;
  name: string;
  branchLabel?: string;
  cardLabel?: string;
  logo: string;
  supportFolderId: string;
  formsFolderId: string;
  trainingFolderId: string;
}

interface KnowledgeCompanyGroupDefinition {
  id: string;
  name: string;
  logo: string;
  companyIds: string[];
}

interface KnowledgeCompanyGroup {
  id: string;
  name: string;
  logo: string;
  companies: KnowledgeCompanyConfig[];
}

@Component({
  selector: 'app-knowledge-base-home',
  imports: [CommonModule, RouterLink],
  templateUrl: './knowledge-base-home.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './knowledge-base-home.scss',
})
export class KnowledgeBaseHome implements OnInit {
  private readonly companyService = inject(CompanyService);

  companies: Company[] = [];

  isLoading = false;
  errorMessage = '';
  selectedCompany: KnowledgeCompanyConfig | null = null;

  readonly companyConfigs: KnowledgeCompanyConfig[] = [
    {
      companyId: 'cmp_njRqliQBpR',
      name: 'Repsol',
      logo: 'assets/companies/knowledge-base-home/repsol.png',
      supportFolderId: 'kfo_dg07x7l18v',
      formsFolderId: 'kfo_i35rytegr3',
      trainingFolderId: 'kfo_i0z03220l9',
    },
    {
      companyId: 'cmp_Q5MgNAInW6',
      name: 'Galp',
      branchLabel: 'Galp Power & Gás',
      cardLabel: 'Power & Gás',
      logo: 'assets/companies/knowledge-base-home/galp.png',
      supportFolderId: 'kfo_yoxtelc7hj',
      formsFolderId: 'kfo_dymwpxdy36',
      trainingFolderId: 'kfo_ajzrw8mu2h',
    },
    {
      companyId: 'cmp_qZUMPp-x7f',
      name: 'Galp Solar',
      branchLabel: 'Galp Solar',
      cardLabel: 'Solar',
      logo: 'assets/companies/knowledge-base-home/galp-solar.png',
      supportFolderId: 'kfo_i1ojmovwne',
      formsFolderId: 'kfo_7myn0r3pil',
      trainingFolderId: 'kfo_3ykc1s8b22',
    },
    {
      companyId: 'cmp_StOnumtpT5',
      name: 'wallbox',
      branchLabel: 'Wallbox',
      cardLabel: 'Wallbox',
      logo: 'assets/companies/knowledge-base-home/wallbox.png',
      supportFolderId: 'kfo_x60fzc7xlh',
      formsFolderId: 'kfo_yuicpeb2ok',
      trainingFolderId: 'kfo_lv7nw6cywu',
    },
    {
      companyId: 'cmp_1GdwakqCnA',
      name: 'Yes Energy',
      logo: 'assets/companies/knowledge-base-home/yes.png',
      supportFolderId: 'kfo_gjbx3z3c9a',
      formsFolderId: 'kfo_8rujt3nd8e',
      trainingFolderId: 'kfo_o8dvkh0ds6',
    },
    {
      companyId: 'cmp_JHtuvY63fm',
      name: 'Iberdrola',
      branchLabel: 'Iberdrola',
      cardLabel: 'Energia',
      logo: 'assets/companies/knowledge-base-home/iberdrola.png',
      supportFolderId: 'kfo_iabn8mqp2u',
      formsFolderId: 'kfo_fo6btqzxy4',
      trainingFolderId: 'kfo_9ndbemqtt9',
    },
    {
      companyId: 'cmp_FKsS04kTr7',
      name: 'Iberdrola Solar',
      branchLabel: 'Iberdrola Solar',
      cardLabel: 'Solar',
      logo: 'assets/companies/knowledge-base-home/iberdrola-solar.png',
      supportFolderId: 'kfo_kpcysylf4g',
      formsFolderId: 'kfo_eqkwzmdjba',
      trainingFolderId: 'kfo_0ezs3gmg45',
    },
    {
      companyId: 'cmp_UL2eeL1SvE',
      name: 'Vodafone',
      logo: 'assets/companies/knowledge-base-home/vodafone.png',
      supportFolderId: 'kfo_ku3x7wiv0y',
      formsFolderId: 'kfo_222xyz9osk',
      trainingFolderId: 'kfo_n7r31l64zk',
    },
    {
      companyId: 'cmp_KCnjrA0i-U',
      name: 'Meo Energias',
      logo: 'assets/companies/knowledge-base-home/meo.png',
      supportFolderId: 'kfo_fg00yogo42',
      formsFolderId: 'kfo_k3d6olqieh',
      trainingFolderId: 'kfo_u30hhp4joj',
    },
    {
      companyId: 'cmp_4xFQ0RiwtJ',
      name: 'Endesa',
      logo: 'assets/companies/knowledge-base-home/endesa.png',
      supportFolderId: 'kfo_tlqa9gkhyk',
      formsFolderId: 'kfo_d4uiwp3mjx',
      trainingFolderId: 'kfo_kdx0txkw7x',
    },
    {
      companyId: 'cmp_cYTHohh7uo',
      name: 'Ezu',
      logo: 'assets/companies/knowledge-base-home/ezu.png',
      supportFolderId: 'kfo_rw8suqgvg9',
      formsFolderId: 'kfo_v2960oyoj1',
      trainingFolderId: 'kfo_c9s9h4pyan',
    },
    {
      companyId: 'cmp_2AH_yvQ8Wn',
      name: 'Portulogos',
      branchLabel: 'Portulogos B2C',
      cardLabel: 'B2C',
      logo: 'assets/companies/knowledge-base-home/portulogos.png',
      supportFolderId: 'kfo_meil5tyc3k',
      formsFolderId: 'kfo_tt767dkyph',
      trainingFolderId: 'kfo_7gsz8xw1r2',
    },
    {
      companyId: 'cmp_8rkornAQ4H',
      name: 'Portulogos B2B',
      branchLabel: 'Portulogos B2B',
      cardLabel: 'B2B',
      logo: 'assets/companies/knowledge-base-home/portulogos.png',
      supportFolderId: 'kfo_wizci3939f',
      formsFolderId: 'kfo_is4rt939hz',
      trainingFolderId: 'kfo_ijnosgjmyr',
    },
    {
      companyId: 'cmp_ijGIgzDUrA',
      name: 'EDP',
      branchLabel: 'EDP',
      cardLabel: 'Energia',
      logo: 'assets/companies/knowledge-base-home/edp.png',
      supportFolderId: '',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'cmp_yH50RBtMbI',
      name: 'EDP Solar',
      branchLabel: 'EDP Solar',
      cardLabel: 'Solar',
      logo: 'assets/companies/knowledge-base-home/edp.png',
      supportFolderId: '',
      formsFolderId: '',
      trainingFolderId: '',
    },
    {
      companyId: 'cmp_s4mjPGw-gJ',
      name: 'Nossa Energia',
      logo: 'assets/companies/knowledge-base-home/nossa-energia.png',
      supportFolderId: 'kfo_88lrw1pbod',
      formsFolderId: 'kfo_6k9pc8uuxa',
      trainingFolderId: 'kfo_37keno5y89',
    },
    {
      companyId: 'cmp_r26ycsfqpu',
      name: 'Audax',
      logo: 'assets/companies/knowledge-base-home/audax.png',
      supportFolderId: 'kfo_mo9oz4l2t3',
      formsFolderId: 'kfo_bexh6hfgcg',
      trainingFolderId: 'kfo_y2ex3vyirg',
    },
    {
      companyId: 'cmp_KXGnjPcbx-',
      name: 'Plenitude',
      logo: 'assets/companies/knowledge-base-home/plenitude.png',
      supportFolderId: 'kfo_ubgu6d5c6t',
      formsFolderId: 'kfo_p9sorelxzk',
      trainingFolderId: 'kfo_u2mhzsq9i9',
    },
  ];

  private readonly groupDefinitions: KnowledgeCompanyGroupDefinition[] = [
    {
      id: 'galp',
      name: 'Galp',
      logo: 'assets/companies/knowledge-base-home/galp.png',
      companyIds: ['cmp_Q5MgNAInW6', 'cmp_qZUMPp-x7f', 'cmp_StOnumtpT5'],
    },
    {
      id: 'iberdrola',
      name: 'Iberdrola',
      logo: 'assets/companies/knowledge-base-home/iberdrola.png',
      companyIds: ['cmp_JHtuvY63fm', 'cmp_FKsS04kTr7'],
    },
    {
      id: 'portulogos',
      name: 'Portulogos',
      logo: 'assets/companies/knowledge-base-home/portulogos.png',
      companyIds: ['cmp_2AH_yvQ8Wn', 'cmp_8rkornAQ4H'],
    },
    {
      id: 'edp',
      name: 'EDP',
      logo: 'assets/companies/knowledge-base-home/edp.png',
      companyIds: ['cmp_ijGIgzDUrA', 'cmp_yH50RBtMbI'],
    },
  ];

  ngOnInit(): void {
    this.loadCompanies();
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeResourceModal();
  }

  loadCompanies(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.companyService.getCompanies().subscribe({
      next: (companies) => {
        this.companies = [...companies];
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

  getVisibleGroups(): KnowledgeCompanyGroup[] {
    const visibleCompanies = this.getVisibleCompanies();
    const groupedCompanyIds = new Set(this.groupDefinitions.flatMap((group) => group.companyIds));

    const grouped = this.groupDefinitions
      .map((group) => ({
        id: group.id,
        name: group.name,
        logo: group.logo,
        companies: group.companyIds
          .map((companyId) => visibleCompanies.find((company) => company.companyId === companyId))
          .filter((company): company is KnowledgeCompanyConfig => Boolean(company)),
      }))
      .filter((group) => group.companies.length > 0);

    const standalone = visibleCompanies
      .filter((company) => !groupedCompanyIds.has(company.companyId))
      .map((company) => ({
        id: company.companyId,
        name: company.name,
        logo: company.logo,
        companies: [company],
      }));

    return [...grouped, ...standalone];
  }

  getBranchLabel(company: KnowledgeCompanyConfig): string {
    return company.branchLabel ?? company.name;
  }

  getCardLabel(company: KnowledgeCompanyConfig, groupSize: number): string {
    if (groupSize === 1) {
      return 'Aceder aos recursos';
    }

    return company.cardLabel ?? this.getBranchLabel(company);
  }

  openResourceModal(company: KnowledgeCompanyConfig): void {
    this.errorMessage = '';
    this.selectedCompany = company;
  }

  closeResourceModal(): void {
    this.selectedCompany = null;
  }

  companyActionRoute(
    company: KnowledgeCompanyConfig,
    action: KnowledgeCompanyAction,
  ): string[] | null {
    if (action === 'campaigns') {
      return ['/home/knowledge-base/campaigns', company.companyId];
    }

    const folderId = this.getFolderId(company, action);

    if (!folderId) {
      return null;
    }

    return ['/home/knowledge-base/folders', folderId];
  }

  companyActionQueryParams(
    company: KnowledgeCompanyConfig,
    action: KnowledgeCompanyAction,
  ): Record<string, string> {
    return {
      name: action === 'campaigns' ? company.name : this.getFolderName(company, action),
      supplier: company.name,
      companyId: company.companyId,
    };
  }

  handleCompanyActionClick(
    event: MouseEvent,
    company: KnowledgeCompanyConfig,
    action: KnowledgeCompanyAction,
  ): void {
    if (this.companyActionRoute(company, action)) {
      this.closeResourceModal();
      return;
    }

    event.preventDefault();
    this.errorMessage = 'Ainda não existe uma pasta configurada para esta opção.';
  }

  trackGroup(_: number, group: KnowledgeCompanyGroup): string {
    return group.id;
  }

  trackCompany(_: number, company: KnowledgeCompanyConfig): string {
    return company.companyId;
  }

  private getVisibleCompanies(): KnowledgeCompanyConfig[] {
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
        return `${company.name} - Recursos`;
      case 'forms':
        return `${company.name} - Formulários de Adesão`;
      case 'training':
        return `${company.name} - Formações`;
    }
  }
}
