import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
  CurrentKnowledgeFolder,
  KnowledgeArticle,
  KnowledgeBaseService,
  KnowledgeFolder as KnowledgeFolderModel,
} from '../../../core/services/knowledge-base';

import {
  Company,
  CompanyService,
} from '../../../core/services/company';

import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-knowledge-folder',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
  ],
  templateUrl: './knowledge-folder.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './knowledge-folder.scss',
})
export class KnowledgeFolder implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly knowledgeBaseService =
    inject(KnowledgeBaseService);

  private readonly companyService =
    inject(CompanyService);

  private readonly auth = inject(Auth);

  folderId: string | null = null;

  subfolders: KnowledgeFolderModel[] = [];
  articles: KnowledgeArticle[] = [];

  currentFolder: CurrentKnowledgeFolder | null = null;

  folderName = 'Pasta';

  selectedSupplier = '';
  selectedCompanyId = '';

  companies: Company[] = [];

  isLoading = false;
  isDeleting = false;
  isCreatingArticle = false;

  canManageKnowledgeBase = false;

  errorMessage = '';

  showCreateFolderModal = false;
  showCreateArticleModal = false;

  newFolder = {
    name: '',
    description: '',
  };

  newArticle = {
    name: '',
    supplier: '',
    status: 'campaign_active',
    message: '',
  };

  ngOnInit(): void {
    this.initializePermissions();
    
    this.route.paramMap.subscribe((params) => {
      this.folderId = params.get('id');

      if (this.folderId) {
        this.loadFolderContents(this.folderId);
      }
    });

    this.route.queryParamMap.subscribe((params) => {
      this.folderName =
        params.get('name') || 'Pasta';

      this.selectedSupplier =
        params.get('supplier') || '';

      this.selectedCompanyId =
        params.get('companyId') || '';

      this.newArticle.supplier =
        this.selectedSupplier;
    });

    this.loadCompanies();
  }

  private initializePermissions(): void {
    const currentUser = this.auth.getCurrentUser();

    const role = currentUser?.role ?? '';

    this.canManageKnowledgeBase = role
      .toLowerCase()
      .includes('super admin');
  }

  private ensureCanManageKnowledgeBase(): boolean {
    if (this.canManageKnowledgeBase) {
      return true;
    }

    this.errorMessage =
      'Não tens permissão para realizar esta operação.';

    return false;
  }

  loadFolderContents(folderId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.knowledgeBaseService
      .getFolderContents(folderId)
      .subscribe({
        next: (contents) => {
          this.currentFolder =
            contents.currentFolder ?? null;

          this.folderName =
            contents.currentFolder?.name ||
            this.route.snapshot.queryParamMap.get(
              'name',
            ) ||
            'Pasta';

          this.subfolders = contents.folders;
          this.articles = contents.articles;
        },
        error: () => {
          this.errorMessage =
            'Não foi possível carregar o conteúdo da pasta.';

          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
        },
      });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      campaign_active: 'Campanha ativa',
      campaign_inactive: 'Campanha inativa',
      draft: 'Rascunho',
      archived: 'Arquivado',
    };

    return labels[status] || status;
  }

  openCreateFolderModal(): void {
    if (!this.ensureCanManageKnowledgeBase()) {
      return;
    }

    this.errorMessage = '';
    this.showCreateFolderModal = true;
  }

  closeCreateFolderModal(): void {
    this.showCreateFolderModal = false;

    this.newFolder = {
      name: '',
      description: '',
    };
  }

  createFolder(): void {
    if (!this.ensureCanManageKnowledgeBase()) {
      return;
    }
    
    const folderName =
      this.newFolder.name.trim();

    if (!folderName) {
      this.errorMessage =
        'O nome da pasta é obrigatório.';

      return;
    }

    if (!this.folderId) {
      this.errorMessage =
        'Não foi possível identificar a pasta atual.';

      return;
    }

    const duplicate = this.subfolders.some(
      (folder) =>
        folder.name.trim().toLowerCase() ===
        folderName.toLowerCase(),
    );

    if (duplicate) {
      this.errorMessage =
        'Já existe uma pasta com esse nome.';

      return;
    }

    this.errorMessage = '';

    this.knowledgeBaseService
      .createFolder({
        name: folderName,
        description:
          this.newFolder.description.trim(),
        parentFolder: this.folderId,
      })
      .subscribe({
        next: () => {
          this.closeCreateFolderModal();
          this.loadFolderContents(this.folderId!);
        },
        error: () => {
          this.errorMessage =
            'Não foi possível criar a pasta.';
        },
      });
  }

  deleteFolder(): void {
    if (!this.ensureCanManageKnowledgeBase()) {
      return;
    }

    if (!this.folderId) {
      return;
    }

    const hasContents =
      this.subfolders.length > 0 ||
      this.articles.length > 0;

    if (hasContents) {
      const confirmed = confirm(
        'Esta pasta contém subpastas ou artigos. Tens a certeza que queres eliminá-la? Esta ação não pode ser revertida.',
      );

      if (!confirmed) {
        return;
      }
    }

    this.isDeleting = true;
    this.errorMessage = '';

    this.knowledgeBaseService
      .deleteFolder(
        this.folderId,
        hasContents,
      )
      .subscribe({
        next: () => {
          this.router.navigate([
            '/home/knowledge-base',
          ]);
        },
        error: () => {
          this.errorMessage =
            'Não foi possível eliminar a pasta.';

          this.isDeleting = false;
        },
        complete: () => {
          this.isDeleting = false;
        },
      });
  }

  openCreateArticleModal(): void {
    if (!this.ensureCanManageKnowledgeBase()) {
      return;
    }

    this.errorMessage = '';

    this.newArticle.supplier =
      this.selectedSupplier;

    this.showCreateArticleModal = true;
  }

  closeCreateArticleModal(): void {
    this.showCreateArticleModal = false;

    this.newArticle = {
      name: '',
      supplier: this.selectedSupplier,
      status: 'campaign_active',
      message: '',
    };
  }

  createArticle(): void {
    if (!this.ensureCanManageKnowledgeBase()) {
      return;
    }
    
    const currentUser =
      this.auth.getCurrentUser();

    const articleName =
      this.newArticle.name.trim();

    const supplier =
      this.newArticle.supplier.trim() ||
      this.selectedSupplier.trim();

    if (!articleName) {
      this.errorMessage =
        'O nome do artigo é obrigatório.';

      return;
    }

    if (!this.folderId) {
      this.errorMessage =
        'Não foi possível identificar a pasta atual.';

      return;
    }

    if (!currentUser?.id) {
      this.errorMessage =
        'Não foi possível identificar o utilizador autenticado.';

      return;
    }

    if (!supplier) {
      this.errorMessage =
        'O fornecedor é obrigatório.';

      return;
    }

    this.isCreatingArticle = true;
    this.errorMessage = '';

    this.knowledgeBaseService
      .createArticle({
        folderId: this.folderId,
        name: articleName,
        supplier,
        status: this.newArticle.status,
        message:
          this.newArticle.message.trim(),
        createdBy: currentUser.id,
      })
      .subscribe({
        next: () => {
          this.closeCreateArticleModal();
          this.loadFolderContents(this.folderId!);
        },
        error: () => {
          this.errorMessage =
            'Não foi possível criar o artigo.';

          this.isCreatingArticle = false;
        },
        complete: () => {
          this.isCreatingArticle = false;
        },
      });
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat(
      'pt-PT',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    ).format(new Date(date));
  }

  loadCompanies(): void {
    this.companyService
      .getCompanies()
      .subscribe({
        next: (companies) => {
          this.companies =
            companies.filter(
              (company) => company.active,
            );

          this.ensureSelectedSupplierExists();
        },
        error: () => {
          this.errorMessage =
            'Não foi possível carregar os fornecedores.';
        },
      });
  }

  getSubfolderQueryParams(
    subfolder: KnowledgeFolderModel,
  ): Record<string, string> {
    return {
      name: subfolder.name,
      supplier: this.selectedSupplier,
      companyId: this.selectedCompanyId,
    };
  }

  getArticleQueryParams(
    article: KnowledgeArticle,
  ): Record<string, string> {
    return {
      name: article.name,
      supplier:
        article.supplier ||
        this.selectedSupplier,
      companyId: this.selectedCompanyId,
    };
  }

  private ensureSelectedSupplierExists(): void {
    if (!this.selectedSupplier) {
      return;
    }

    const supplierExists =
      this.companies.some(
        (company) =>
          company.name
            .trim()
            .toLowerCase() ===
          this.selectedSupplier
            .trim()
            .toLowerCase(),
      );

    if (!supplierExists) {
      this.newArticle.supplier = '';
    }
  }
}
