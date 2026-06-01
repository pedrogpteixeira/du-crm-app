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
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeFolderContents {
  folderId: string;
  folders: KnowledgeFolder[];
  articles: KnowledgeArticle[];
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
}