import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  KnowledgeArticle as KnowledgeArticleModel,
  KnowledgeBaseService,
} from '../../../core/services/knowledge-base';

import { environment } from '../../../../environments/environment.development';

@Component({
  selector: 'app-knowledge-article',
  imports: [CommonModule, RouterLink],
  templateUrl: './knowledge-article.html',
  styleUrl: './knowledge-article.scss',
})
export class KnowledgeArticle implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly knowledgeBaseService = inject(KnowledgeBaseService);

  readonly apiUrl = environment.apiUrl;

  articleId: string | null = null;

  article: KnowledgeArticleModel | null = null;

  folderId: string | null = null;
  folderName = 'Base de Conhecimento';

  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.articleId = params.get('id');

      this.folderId = this.route.snapshot.queryParamMap.get('folderId');
      this.folderName =
        this.route.snapshot.queryParamMap.get('folderName') || 'Base de Conhecimento';

      if (this.articleId) {
        this.loadArticle(this.articleId);
      }
    });
  }

  loadArticle(articleId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.knowledgeBaseService.getArticle(articleId).subscribe({
      next: (article) => {
        this.article = article;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o artigo.';
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
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  getAttachmentUrl(path: string): string {
    return `${this.apiUrl}${path}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}