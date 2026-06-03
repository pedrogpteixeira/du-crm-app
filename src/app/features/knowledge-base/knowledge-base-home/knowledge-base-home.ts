import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
  KnowledgeArticle,
  KnowledgeBaseService,
  KnowledgeFolder,
} from '../../../core/services/knowledge-base';
import { Company, CompanyService } from '../../../core/services/company';

@Component({
  selector: 'app-knowledge-base-home',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './knowledge-base-home.html',
  styleUrl: './knowledge-base-home.scss',
})
export class KnowledgeBaseHome implements OnInit {
  private readonly knowledgeBaseService = inject(KnowledgeBaseService);
  private readonly companyService = inject(CompanyService);

  folders: KnowledgeFolder[] = [];
  articles: KnowledgeArticle[] = [];
  companies: Company[] = [];

  isLoading = false;
  errorMessage = '';

  showCreateFolderModal = false;

  newFolder = {
    name: '',
    description: '',
  };

  showCreateArticleModal = false;
  isCreatingArticle = false;

  newArticle = {
    name: '',
    supplier: '',
    status: 'campaign_active',
    message: '',
  };

  ngOnInit(): void {
    this.loadRootContents();
    this.loadCompanies();
  }

  loadRootContents(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.knowledgeBaseService.getRootContents().subscribe({
      next: (contents) => {
        this.folders = contents.folders;
        this.articles = contents.articles;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar a base de conhecimento.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  createFolder(): void {
    const duplicate = this.folders.some(
      (folder) =>
        folder.name.trim().toLowerCase() ===
        this.newFolder.name.trim().toLowerCase(),
    );

    if (duplicate) {
      this.errorMessage =
        'Já existe uma pasta com esse nome.';
      return;
    }

    this.knowledgeBaseService
      .createFolder({
        name: this.newFolder.name.trim(),
        description: this.newFolder.description.trim(),
        parentFolder: '',
      })
      .subscribe({
        next: () => {
          this.closeCreateFolderModal();
          this.loadRootContents();
        },
      });
  }

  closeCreateFolderModal(): void {
    this.showCreateFolderModal = false;

    this.newFolder = {
      name: '',
      description: '',
    };
  }

  openCreateArticleModal(): void {
    this.showCreateArticleModal = true;
  }

  closeCreateArticleModal(): void {
    this.showCreateArticleModal = false;

    this.newArticle = {
      name: '',
      supplier: '',
      status: 'campaign_active',
      message: '',
    };
  }

  createArticle(): void {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    if (!this.newArticle.name.trim()) {
      this.errorMessage = 'O nome do artigo é obrigatório.';
      return;
    }

    if (!currentUser.id) {
      this.errorMessage = 'Não foi possível identificar o utilizador autenticado.';
      return;
    }

    if (!this.newArticle.supplier) {
      this.errorMessage = 'O fornecedor é obrigatório.';
      return;
    }

    this.isCreatingArticle = true;

    this.knowledgeBaseService
      .createArticle({
        folderId: '',
        name: this.newArticle.name.trim(),
        supplier: this.newArticle.supplier.trim(),
        status: this.newArticle.status,
        message: this.newArticle.message.trim(),
        createdBy: currentUser.id,
      })
      .subscribe({
        next: () => {
          this.closeCreateArticleModal();
          this.loadRootContents();
        },
        error: () => {
          this.errorMessage = 'Não foi possível criar o artigo.';
        },
        complete: () => {
          this.isCreatingArticle = false;
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

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  }

  loadCompanies(): void {
    this.companyService.getCompanies().subscribe({
      next: (companies) => {
        this.companies = companies.filter((company) => company.active);
      },
    });
  }
}