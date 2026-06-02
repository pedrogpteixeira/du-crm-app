import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, filter } from 'rxjs';

export interface KnowledgeBreadcrumbItem {
  id: string;
  name: string;
  type: 'root' | 'folder' | 'article';
  url: string;
}

@Injectable({
  providedIn: 'root',
})
export class KnowledgeBreadcrumbService {
  private readonly router = inject(Router);
  private readonly storageKey = 'knowledge_breadcrumb_path';

  private readonly pathSubject = new BehaviorSubject<KnowledgeBreadcrumbItem[]>(
    this.getStoredPath(),
  );

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.syncWithUrl(event.urlAfterRedirects);
      });
  }

  path$ = this.pathSubject.asObservable();

  setRoot(): void {
    this.setPath([
      {
        id: 'root',
        name: 'Base de Conhecimento',
        type: 'root',
        url: '/home/knowledge-base',
      },
    ]);
  }

  enterFolder(folder: { id: string; name: string }): void {
    const currentPath = this.pathSubject.value;

    const existingIndex = currentPath.findIndex(
      (item) => item.type === 'folder' && item.id === folder.id,
    );

    if (existingIndex !== -1) {
      this.setPath(currentPath.slice(0, existingIndex + 1));
      return;
    }

    this.setPath([
      ...currentPath.filter((item) => item.type !== 'article'),
      {
        id: folder.id,
        name: folder.name,
        type: 'folder',
        url: `/home/knowledge-base/folders/${folder.id}`,
      },
    ]);
  }

  enterArticle(article: { id: string; name: string }): void {
    const currentPath = this.pathSubject.value.filter(
      (item) => item.type !== 'article',
    );

    this.setPath([
      ...currentPath,
      {
        id: article.id,
        name: article.name,
        type: 'article',
        url: `/home/knowledge-base/articles/${article.id}`,
      },
    ]);
  }

  navigateTo(index: number): void {
    const currentPath = this.pathSubject.value;
    this.setPath(currentPath.slice(0, index + 1));
  }

  clear(): void {
    sessionStorage.removeItem(this.storageKey);
    this.setRoot();
  }

  private setPath(path: KnowledgeBreadcrumbItem[]): void {
    this.pathSubject.next(path);
    sessionStorage.setItem(this.storageKey, JSON.stringify(path));
  }

  private getStoredPath(): KnowledgeBreadcrumbItem[] {
    const stored = sessionStorage.getItem(this.storageKey);

    if (!stored) {
      return [
        {
          id: 'root',
          name: 'Base de Conhecimento',
          type: 'root',
          url: '/home/knowledge-base',
        },
      ];
    }

    return JSON.parse(stored);
  }

  private syncWithUrl(url: string): void {
    if (!url.startsWith('/home/knowledge-base')) {
      return;
    }

    const currentPath = this.pathSubject.value;

    if (url === '/home/knowledge-base') {
      this.setRoot();
      return;
    }

    const cleanUrl = url.split('?')[0];

    const matchingIndex = currentPath.findIndex((item) => item.url === cleanUrl);

    if (matchingIndex !== -1) {
      this.setPath(currentPath.slice(0, matchingIndex + 1));
    }
  }
}