import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface ArticleAttachment {
  id: string;
  originalName: string;
  size: string;
  url: string;
}

interface KnowledgeArticleDetail {
  id: string;
  title: string;
  provider: string;
  status: string;
  folderName: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  body: string;
  attachments: ArticleAttachment[];
}

@Component({
  selector: 'app-knowledge-article',
  imports: [CommonModule, RouterLink],
  templateUrl: './knowledge-article.html',
  styleUrl: './knowledge-article.scss',
})
export class KnowledgeArticle implements OnInit {
  private readonly route = inject(ActivatedRoute);

  articleId: string | null = null;

  article: KnowledgeArticleDetail = {
    id: 'art-1',
    title: 'Acesso App My Repsol',
    provider: 'Repsol',
    status: 'Campanha Ativa',
    folderName: 'Repsol - Campanhas & Formulários',
    createdAt: '05 nov, 2025 12:31',
    updatedAt: '05 nov, 2025 14:12',
    createdBy: 'Pedro Teixeira',
    body: `
      Este artigo reúne a informação necessária para orientar o utilizador no acesso à aplicação My Repsol.

      Deve ser utilizado como referência interna para esclarecimento de dúvidas, apoio operacional e consulta rápida durante o atendimento.

      Procedimentos principais:
      - Confirmar os dados do cliente.
      - Validar o acesso à aplicação.
      - Explicar os passos de recuperação de palavra-passe, caso necessário.
      - Encaminhar situações técnicas para a equipa responsável.
    `,
    attachments: [
      {
        id: 'att-1',
        originalName: 'Guia_Acesso_My_Repsol.pdf',
        size: '245 KB',
        url: '#',
      },
      {
        id: 'att-2',
        originalName: 'Formulario_Apoio_Repsol.docx',
        size: '82 KB',
        url: '#',
      },
    ],
  };

  ngOnInit(): void {
    this.articleId = this.route.snapshot.paramMap.get('id');
    console.log('Article ID:', this.articleId);
  }
}