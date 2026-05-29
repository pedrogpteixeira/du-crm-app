import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface KnowledgeArticle {
  id: string;
  name: string;
  provider: string;
  status: string;
  createdAt: string;
}

interface KnowledgeSubfolder {
  id: string;
  name: string;
  articlesCount: number;
}

@Component({
  selector: 'app-knowledge-folder',
  imports: [CommonModule, RouterLink],
  templateUrl: './knowledge-folder.html',
  styleUrl: './knowledge-folder.scss',
})
export class KnowledgeFolder implements OnInit {
  private readonly route = inject(ActivatedRoute);

  folderId: string | null = null;

  folderName = 'Repsol - Campanhas & Formulários';

  subfolders: KnowledgeSubfolder[] = [
    {
      id: 'sub-1',
      name: 'Contratos',
      articlesCount: 4,
    },
    {
      id: 'sub-2',
      name: 'Formulários',
      articlesCount: 7,
    },
  ];

  articles: KnowledgeArticle[] = [
    {
      id: 'art-1',
      name: 'Acesso App My Repsol',
      provider: 'Repsol',
      status: 'Campanha Ativa',
      createdAt: '05 nov, 2025 12:31',
    },
    {
      id: 'art-2',
      name: 'Formação SVA',
      provider: 'Repsol',
      status: 'Campanha Ativa',
      createdAt: '05 nov, 2025 12:30',
    },
    {
      id: 'art-3',
      name: 'Formação CE',
      provider: 'Repsol',
      status: 'Campanha Ativa',
      createdAt: '31 out, 2025 11:32',
    },
  ];

  ngOnInit(): void {
    this.folderId = this.route.snapshot.paramMap.get('id');

    console.log('Folder ID:', this.folderId);
  }
}