import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  KnowledgeArticle,
  KnowledgeBaseService,
  KnowledgeFolder as KnowledgeFolderModel,
} from '../../../core/services/knowledge-base';

@Component({
  selector: 'app-knowledge-folder',
  imports: [CommonModule, RouterLink],
  templateUrl: './knowledge-folder.html',
  styleUrl: './knowledge-folder.scss',
})
export class KnowledgeFolder implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly knowledgeBaseService = inject(KnowledgeBaseService);
  // readonly breadcrumbService = inject(KnowledgeBreadcrumbService);

  folderId: string | null = null;

  subfolders: KnowledgeFolderModel[] = [];
  articles: KnowledgeArticle[] = [];
  folderName = 'Pasta';

  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.folderId = params.get('id');
      this.folderName =
        this.route.snapshot.queryParamMap.get('name') || 'Pasta';

      if (this.folderId) {
        this.loadFolderContents(this.folderId);
      }
    });
  }

  loadFolderContents(folderId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.knowledgeBaseService.getFolderContents(folderId).subscribe({
      next: (contents) => {
        this.subfolders = contents.folders;
        this.articles = contents.articles;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o conteúdo da pasta.';
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
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }
}