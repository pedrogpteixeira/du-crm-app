import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  KnowledgeArticle as KnowledgeArticleModel,
  KnowledgeAttachment,
  KnowledgeBaseService,
} from '../../../core/services/knowledge-base';

import { Company, CompanyService } from '../../../core/services/company';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-knowledge-article',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './knowledge-article.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './knowledge-article.scss',
})
export class KnowledgeArticle implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly knowledgeBaseService = inject(KnowledgeBaseService);
  private readonly router = inject(Router);
  private readonly companyService = inject(CompanyService);

  readonly apiUrl = environment.apiUrl;

  articleId: string | null = null;
  article: KnowledgeArticleModel | null = null;

  folderId: string | null = null;
  folderName = 'Base de Conhecimento';
  articleName = 'Artigo';

  selectedFiles: File[] = [];
  companies: Company[] = [];

  isLoading = false;
  isDeleting = false;
  isEditing = false;
  isSaving = false;
  isDraggingFiles = false;
  isUploadingAttachments = false;

  deletingAttachmentFileName: string | null = null;

  errorMessage = '';

  editableArticle = {
    name: '',
    supplier: '',
    status: 'campaign_active',
    message: '',
  };

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.articleId = params.get('id');

      this.folderId = this.route.snapshot.queryParamMap.get('folderId');
      this.folderName =
        this.route.snapshot.queryParamMap.get('folderName') || 'Base de Conhecimento';

      if (this.articleId) {
        this.loadArticle(this.articleId);
      }

      this.loadCompanies();
    });
  }

  loadArticle(articleId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.knowledgeBaseService.getArticle(articleId).subscribe({
      next: (article) => {
        this.article = article;
        this.articleName = article.name;

        this.editableArticle = {
          name: article.name,
          supplier: article.supplier,
          status: article.status,
          message: article.message,
        };
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o artigo.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  loadCompanies(): void {
    this.companyService.getCompanies().subscribe({
      next: (companies) => {
        this.companies = companies;
      },
    });
  }

  startEditing(): void {
    if (!this.article) {
      return;
    }

    this.isEditing = true;

    this.editableArticle = {
      name: this.article.name,
      supplier: this.article.supplier,
      status: this.article.status,
      message: this.article.message,
    };
  }

  cancelEditing(): void {
    if (!this.article) {
      return;
    }

    this.isEditing = false;
    this.selectedFiles = [];
    this.isDraggingFiles = false;

    this.editableArticle = {
      name: this.article.name,
      supplier: this.article.supplier,
      status: this.article.status,
      message: this.article.message,
    };
  }

  saveArticle(): void {
    if (!this.article?.id) {
      return;
    }

    if (!this.hasArticleChanges()) {
      this.isEditing = false;
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    this.knowledgeBaseService
      .updateArticle(this.article.id, {
        name: this.editableArticle.name.trim(),
        supplier: this.editableArticle.supplier.trim(),
        status: this.editableArticle.status,
        message: this.editableArticle.message.trim(),
      })
      .subscribe({
        next: (updatedArticle) => {
          this.article = updatedArticle;
          this.articleName = updatedArticle.name;

          this.editableArticle = {
            name: updatedArticle.name,
            supplier: updatedArticle.supplier,
            status: updatedArticle.status,
            message: updatedArticle.message,
          };

          this.isEditing = false;
        },
        error: () => {
          this.errorMessage = 'Não foi possível atualizar o artigo.';
        },
        complete: () => {
          this.isSaving = false;
        },
      });
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

    this.isDeleting = true;
    this.errorMessage = '';

    this.knowledgeBaseService.deleteArticle(this.article.id).subscribe({
      next: () => {
        if (!this.article?.folderId) {
          this.router.navigate(['/home/knowledge-base']);
          return;
        }

        this.router.navigate(['/home/knowledge-base/folders', this.article.folderId]);
      },
      error: () => {
        this.errorMessage = 'Não foi possível eliminar o artigo.';
      },
      complete: () => {
        this.isDeleting = false;
      },
    });
  }

  deleteAttachment(fileName: string): void {
    if (!this.article?.id || !this.isEditing) {
      return;
    }

    const confirmed = confirm('Tens a certeza que queres eliminar este anexo?');

    if (!confirmed) {
      return;
    }

    this.deletingAttachmentFileName = fileName;
    this.errorMessage = '';

    this.knowledgeBaseService.deleteArticleAttachment(this.article.id, fileName).subscribe({
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

  downloadAttachment(attachment: KnowledgeAttachment): void {
    if (!this.article?.id) {
      return;
    }

    this.knowledgeBaseService.downloadAttachment(attachment, this.article.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.originalName || attachment.fileName;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.errorMessage = 'Não foi possível descarregar o anexo.';
      },
    });
  }

  onDragOver(event: DragEvent): void {
    if (!this.isEditing) {
      return;
    }

    event.preventDefault();
    this.isDraggingFiles = true;
  }

  onDragLeave(event: DragEvent): void {
    if (!this.isEditing) {
      return;
    }

    event.preventDefault();
    this.isDraggingFiles = false;
  }

  onDropFiles(event: DragEvent): void {
    if (!this.isEditing) {
      return;
    }

    event.preventDefault();
    this.isDraggingFiles = false;

    const files = Array.from(event.dataTransfer?.files || []);

    if (!files.length) {
      return;
    }

    this.selectedFiles = [...this.selectedFiles, ...files];
  }

  onFileInputChange(event: Event): void {
    if (!this.isEditing) {
      return;
    }

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
    if (!this.article?.id || !this.selectedFiles.length || !this.isEditing) {
      return;
    }

    this.isUploadingAttachments = true;
    this.errorMessage = '';

    this.knowledgeBaseService
      .uploadArticleAttachments(this.article.id, this.selectedFiles)
      .subscribe({
        next: (updatedArticle) => {
          this.article = updatedArticle;
          this.articleName = updatedArticle.name;

          this.editableArticle = {
            name: updatedArticle.name,
            supplier: updatedArticle.supplier,
            status: updatedArticle.status,
            message: updatedArticle.message,
          };

          this.selectedFiles = [];
          this.isDraggingFiles = false;
          this.isEditing = false;
        },
        error: () => {
          this.errorMessage = 'Não foi possível carregar os anexos.';
        },
        complete: () => {
          this.isUploadingAttachments = false;
        },
      });
  }

  private hasArticleChanges(): boolean {
    if (!this.article) {
      return false;
    }

    return (
      this.editableArticle.name.trim() !== this.article.name ||
      this.editableArticle.supplier.trim() !== this.article.supplier ||
      this.editableArticle.status !== this.article.status ||
      this.editableArticle.message.trim() !== this.article.message
    );
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
