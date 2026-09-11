import { Injectable, inject } from '@angular/core';

import { Auth } from './auth';

export interface FileLike {
  name?: string | null;
  fileName?: string | null;
  originalName?: string | null;
  mimetype?: string | null;
  type?: string | null;
}

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'wave',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'flac',
  'wma',
  'opus',
  'aiff',
  'aif',
  'amr',
]);

export function isAudioFile(file: FileLike): boolean {
  const mimetype = String(file.mimetype ?? file.type ?? '').toLowerCase();

  if (mimetype.startsWith('audio/')) {
    return true;
  }

  const fileName = String(file.originalName ?? file.fileName ?? file.name ?? '').toLowerCase();
  const extension = fileName.split('.').pop() ?? '';

  return AUDIO_EXTENSIONS.has(extension);
}

@Injectable({
  providedIn: 'root',
})
export class FileAccessService {
  private readonly auth = inject(Auth);

  canAccessAudioFiles(): boolean {
    return this.auth.roleIncludes(['Super Admin', 'DU']);
  }

  filterUploadFiles(files: readonly File[]): {
    allowedFiles: File[];
    rejectedAudioFiles: File[];
  } {
    if (this.canAccessAudioFiles()) {
      return {
        allowedFiles: [...files],
        rejectedAudioFiles: [],
      };
    }

    const allowedFiles: File[] = [];
    const rejectedAudioFiles: File[] = [];

    files.forEach((file) => {
      if (isAudioFile(file)) {
        rejectedAudioFiles.push(file);
      } else {
        allowedFiles.push(file);
      }
    });

    return {
      allowedFiles,
      rejectedAudioFiles,
    };
  }

  filterVisibleFiles<T extends FileLike>(files: readonly T[] | null | undefined): T[] {
    const list = files ?? [];

    if (this.canAccessAudioFiles()) {
      return [...list];
    }

    return list.filter((file) => !isAudioFile(file));
  }

  canViewFile(file: FileLike): boolean {
    return !isAudioFile(file) || this.canAccessAudioFiles();
  }
}
