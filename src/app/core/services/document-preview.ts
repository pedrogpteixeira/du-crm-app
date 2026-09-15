import { Injectable, inject } from '@angular/core';
import { Observable, catchError, defer, map, throwError } from 'rxjs';

import { FileAccessService, FileLike, isAudioFile } from './file-access';

export type DocumentPreviewType = 'image' | 'pdf' | 'audio';

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'avif',
]);

const PDF_EXTENSIONS = new Set(['pdf']);

const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  wave: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  flac: 'audio/flac',
  wma: 'audio/x-ms-wma',
  opus: 'audio/ogg',
  aiff: 'audio/aiff',
  aif: 'audio/aiff',
  amr: 'audio/amr',
};

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  avif: 'image/avif',
};

function getFileName(file: FileLike): string {
  return String(file.originalName ?? file.fileName ?? file.name ?? '').trim();
}

function getExtension(file: FileLike): string {
  const fileName = getFileName(file).toLowerCase();
  const dotIndex = fileName.lastIndexOf('.');

  return dotIndex >= 0 ? fileName.slice(dotIndex + 1) : '';
}

export function getDocumentPreviewType(file: FileLike): DocumentPreviewType | null {
  const mimeType = String(file.mimetype ?? file.type ?? '').toLowerCase();
  const extension = getExtension(file);

  if (mimeType === 'application/pdf' || PDF_EXTENSIONS.has(extension)) {
    return 'pdf';
  }

  if (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') {
    return 'image';
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }

  if (isAudioFile(file)) {
    return 'audio';
  }

  return null;
}

function getPreviewMimeType(
  file: FileLike,
  blob: Blob,
  previewType: DocumentPreviewType,
): string {
  const metadataMime = String(file.mimetype ?? file.type ?? '').toLowerCase();
  const blobMime = String(blob.type ?? '').toLowerCase();
  const extension = getExtension(file);

  if (previewType === 'pdf') {
    return 'application/pdf';
  }

  if (previewType === 'image') {
    if (metadataMime.startsWith('image/') && metadataMime !== 'image/svg+xml') {
      return metadataMime;
    }

    if (blobMime.startsWith('image/') && blobMime !== 'image/svg+xml') {
      return blobMime;
    }

    return IMAGE_MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
  }

  if (metadataMime.startsWith('audio/')) {
    return metadataMime;
  }

  if (blobMime.startsWith('audio/')) {
    return blobMime;
  }

  return AUDIO_MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

@Injectable({
  providedIn: 'root',
})
export class DocumentPreviewService {
  private readonly fileAccess = inject(FileAccessService);

  canPreview(file: FileLike): boolean {
    return this.fileAccess.canViewFile(file) && getDocumentPreviewType(file) !== null;
  }

  preview(file: FileLike, loader: () => Observable<Blob>): Observable<void> {
    return defer(() => {
      const previewType = getDocumentPreviewType(file);

      if (!previewType) {
        return throwError(() => new Error('Este tipo de ficheiro não suporta pré-visualização.'));
      }

      if (!this.fileAccess.canViewFile(file)) {
        return throwError(() => new Error('Não tem permissão para visualizar este ficheiro.'));
      }

      const previewWindow = window.open('', '_blank');

      if (!previewWindow) {
        return throwError(() => new Error('O browser bloqueou a janela de pré-visualização.'));
      }

      previewWindow.opener = null;
      previewWindow.document.title = `A carregar ${getFileName(file) || 'documento'}...`;
      previewWindow.document.body.innerHTML = `
        <div style="font-family:system-ui,sans-serif;padding:24px;color:#334155">
          A carregar pré-visualização...
        </div>
      `;

      return loader().pipe(
        map((blob) => {
          const mimeType = getPreviewMimeType(file, blob, previewType);
          const previewBlob =
            blob.type === mimeType
              ? blob
              : new Blob([blob], {
                  type: mimeType,
                });
          const objectUrl = window.URL.createObjectURL(previewBlob);

          if (previewWindow.closed) {
            window.URL.revokeObjectURL(objectUrl);
            throw new Error('A janela de pré-visualização foi fechada.');
          }

          previewWindow.location.replace(objectUrl);

          // Dá tempo suficiente ao browser para consumir a Blob URL. A janela
          // mantém o conteúdo carregado mesmo depois de a URL ser libertada.
          window.setTimeout(() => {
            window.URL.revokeObjectURL(objectUrl);
          }, 5 * 60 * 1000);

          return undefined;
        }),
        catchError((error: unknown) => {
          if (!previewWindow.closed) {
            previewWindow.close();
          }

          return throwError(() => error);
        }),
      );
    });
  }
}
