import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
  KnowledgeArticle,
  KnowledgeBaseService,
  KnowledgeFolder,
} from '../../../core/services/knowledge-base';

@Component({
  selector: 'app-knowledge-base-home',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './knowledge-base-home.html',
  styleUrl: './knowledge-base-home.scss',
})
export class KnowledgeBaseHome implements OnInit {
  private readonly knowledgeBaseService = inject(KnowledgeBaseService);

  folders: KnowledgeFolder[] = [];
  articles: KnowledgeArticle[] = [];

  isLoading = false;
  errorMessage = '';

  showCreateFolderModal = false;

  newFolder = {
    name: '',
    description: '',
  };

  ngOnInit(): void {
    this.loadRootContents();
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
}