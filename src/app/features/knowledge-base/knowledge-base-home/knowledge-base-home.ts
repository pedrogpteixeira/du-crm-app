import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  KnowledgeArticle,
  KnowledgeBaseService,
  KnowledgeFolder,
} from '../../../core/services/knowledge-base';

@Component({
  selector: 'app-knowledge-base-home',
  imports: [CommonModule, RouterLink],
  templateUrl: './knowledge-base-home.html',
  styleUrl: './knowledge-base-home.scss',
})
export class KnowledgeBaseHome implements OnInit {
  private readonly knowledgeBaseService = inject(KnowledgeBaseService);

  folders: KnowledgeFolder[] = [];
  articles: KnowledgeArticle[] = [];

  isLoading = false;
  errorMessage = '';

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