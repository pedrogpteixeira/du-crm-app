import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
  KnowledgeArticle,
  KnowledgeBaseService,
  KnowledgeFolder as KnowledgeFolderModel,
} from '../../../core/services/knowledge-base';

@Component({
  selector: 'app-knowledge-folder',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './knowledge-folder.html',
  styleUrl: './knowledge-folder.scss',
})
export class KnowledgeFolder implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly knowledgeBaseService = inject(KnowledgeBaseService);
  private readonly router = inject(Router);
  // readonly breadcrumbService = inject(KnowledgeBreadcrumbService);

  folderId: string | null = null;

  subfolders: KnowledgeFolderModel[] = [];
  articles: KnowledgeArticle[] = [];
  folderName = 'Pasta';

  isLoading = false;
  isDeleting = false;
  errorMessage = '';

  showCreateFolderModal = false;

  newFolder = {
    name: '',
    description: '',
  };

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

  createFolder(): void {
    const duplicate = this.subfolders.some(
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
        parentFolder: this.folderId ?? '',
      })
      .subscribe({
        next: () => {
          this.closeCreateFolderModal();
          this.loadFolderContents(this.folderId!);
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

  deleteFolder(): void {
    if (!this.folderId) {
      return;
    }

    const hasContents = this.subfolders.length > 0 || this.articles.length > 0;

    if (hasContents) {
      const confirmed = confirm(
        'Esta pasta contém subpastas ou artigos. Tens a certeza que queres eliminá-la? Esta ação não pode ser revertida.',
      );

      if (!confirmed) {
        return;
      }
    }

    this.isDeleting = true;

    this.knowledgeBaseService.deleteFolder(this.folderId, hasContents).subscribe({
      next: () => {
        this.router.navigate(['/home/knowledge-base']);
      },
      error: () => {
        this.errorMessage = 'Não foi possível eliminar a pasta.';
      },
      complete: () => {
        this.isDeleting = false;
      },
    });
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