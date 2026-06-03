import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment.development';

export interface KnowledgeFolder {
  id: string;
  name: string;
  description: string;
  parentFolder: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeAttachment {
  originalName: string;
  fileName: string;
  path: string;
  mimetype: string;
  size: number;
}

export interface KnowledgeArticle {
  id: string;
  folderId: string;
  name: string;
  supplier: string;
  status: string;
  message: string;
  attachments: KnowledgeAttachment[];
  active: boolean;
  createdBy: KnowledgeCreatedBy | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentKnowledgeFolder {
  id: string;
  name: string;
  parentFolder: string;
}

export interface KnowledgeFolderContents {
  currentFolder?: CurrentKnowledgeFolder;
  folderId?: string;
  folders: KnowledgeFolder[];
  articles: KnowledgeArticle[];
}

export interface KnowledgeCreatedBy {
  id: string;
  name: string;
}

export interface CreateKnowledgeArticleRequest {
  folderId: string;
  name: string;
  supplier: string;
  status: string;
  message: string;
  createdBy: string;
}

@Injectable({
  providedIn: 'root',
})
export class KnowledgeBaseService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getRootContents(): Observable<KnowledgeFolderContents> {
    return this.http.get<KnowledgeFolderContents>(
      `${this.apiUrl}/api/knowledge-folders/root/contents`,
    );
  }

  getFolderContents(folderId: string): Observable<KnowledgeFolderContents> {
    return this.http.get<KnowledgeFolderContents>(
      `${this.apiUrl}/api/knowledge-folders/${folderId}/contents`,
    );
  }

  getArticle(articleId: string): Observable<KnowledgeArticle> {
    return this.http.get<KnowledgeArticle>(
      `${this.apiUrl}/api/knowledge-articles/${articleId}`,
    );
  }

  createFolder(payload: {
    name: string;
    description: string;
    parentFolder: string;
  }) {
    return this.http.post(
      `${this.apiUrl}/api/knowledge-folders`,
      payload,
    );
  }

  deleteFolder(folderId: string, force = false): Observable<void> {
    return this.http.request<void>(
      'delete',
      `${this.apiUrl}/api/knowledge-folders/${folderId}`,
      {
        body: { force },
      },
    );
  }

  createArticle(payload: CreateKnowledgeArticleRequest): Observable<KnowledgeArticle> {
    return this.http.post<KnowledgeArticle>(
      `${this.apiUrl}/api/knowledge-articles`,
      payload,
    );
  }

  deleteArticle(articleId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/api/knowledge-articles/${articleId}`,
    );
  }
}