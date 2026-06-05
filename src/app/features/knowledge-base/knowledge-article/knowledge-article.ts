import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';

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
  private readonly router = inject(Router);

  readonly apiUrl = environment.apiUrl;

  articleId: string | null = null;

  article: KnowledgeArticleModel | null = null;
  deletingAttachmentFileName: string | null = null;

  folderId: string | null = null;
  folderName = 'Base de Conhecimento';
  articleName = 'Artigo';

  selectedFiles: File[] = [];
  isDraggingFiles = false;
  isUploadingAttachments = false;

  isLoading = false;
  isDeleting = false;
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
        this.articleName = article.name;
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

  deleteArticle(): void {
    if (!this.article?.id) {
      return;
    }

    const confirmed = confirm(
      `Tens a certeza que pretendes eliminar o artigo "${this.article.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    const folderId = this.article.folderId;
    this.isDeleting = true;

    // folderId is empty when the article is in the root folder, so we navigate to the root folder page
    if (!folderId) {
      console.log('Article is in root folder, navigating to root folder page');
    }

    this.knowledgeBaseService
      .deleteArticle(this.article.id)
      .subscribe({
        next: () => {
          if (!this.article?.folderId) {
            this.router.navigate(['/home/knowledge-base']);
          } else {
            this.router.navigate([
              '/home/knowledge-base/folders',
              this.article.folderId,
            ]);
          }
        },
        error: () => {
          this.errorMessage =
            'Não foi possível eliminar o artigo.';
        },
        complete: () => {
          this.isDeleting = false;
        },
      });
  }

  deleteAttachment(fileName: string): void {
    if (!this.article?.id) {
      return;
    }

    const confirmed = confirm(
      'Tens a certeza que queres eliminar este anexo?',
    );

    if (!confirmed) {
      return;
    }

    this.deletingAttachmentFileName = fileName;

    this.knowledgeBaseService
      .deleteArticleAttachment(this.article.id, fileName)
      .subscribe({
        next: (updatedArticle) => {
          this.article = updatedArticle;
        },
        error: () => {
          this.errorMessage = 'Não foi possível eliminar o anexo.';
        },
        complete: () => {
          this.deletingAttachmentFileName = null;
        },
      });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFiles = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFiles = false;
  }

  onDropFiles(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFiles = false;

    const files = Array.from(event.dataTransfer?.files || []);

    if (!files.length) {
      return;
    }

    this.selectedFiles = [...this.selectedFiles, ...files];
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);

    if (!files.length) {
      return;
    }

    this.selectedFiles = [...this.selectedFiles, ...files];

    input.value = '';
  }

  removeSelectedFile(index: number): void {
    this.selectedFiles = this.selectedFiles.filter((_, i) => i !== index);
  }

  uploadSelectedAttachments(): void {
    if (!this.article?.id || !this.selectedFiles.length) {
      return;
    }

    this.isUploadingAttachments = true;

    this.knowledgeBaseService
      .uploadArticleAttachments(this.article.id, this.selectedFiles)
      .subscribe({
        next: (updatedArticle) => {
          this.article = updatedArticle;
          this.selectedFiles = [];
        },
        error: () => {
          this.errorMessage = 'Não foi possível carregar os anexos.';
        },
        complete: () => {
          this.isUploadingAttachments = false;
        },
      });
  }
}