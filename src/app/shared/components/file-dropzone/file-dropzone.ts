import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';

import { FileAccessService } from '../../../core/services/file-access';

@Component({
  selector: 'app-file-dropzone',
  imports: [CommonModule],
  templateUrl: './file-dropzone.html',
  styleUrl: './file-dropzone.scss',
})
export class FileDropzone {
  private readonly fileAccess = inject(FileAccessService);

  @Input() files: File[] = [];
  @Input() disabled = false;
  @Input() title = 'Arrasta ficheiros para aqui';
  @Input() selectLabel = 'Selecionar ficheiros';

  @Output() filesChange = new EventEmitter<File[]>();

  isDraggingFiles = false;
  fileAccessMessage = '';

  get canAccessAudioFiles(): boolean {
    return this.fileAccess.canAccessAudioFiles();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();

    if (this.disabled) {
      return;
    }

    this.isDraggingFiles = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFiles = false;
  }

  onDropFiles(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFiles = false;

    if (this.disabled) {
      return;
    }

    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  onFileInputChange(event: Event): void {
    if (this.disabled) {
      return;
    }

    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  removeFile(index: number): void {
    if (this.disabled) {
      return;
    }

    this.filesChange.emit(this.files.filter((_, currentIndex) => currentIndex !== index));
  }

  clearFiles(): void {
    if (this.disabled) {
      return;
    }

    this.filesChange.emit([]);
  }

  formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0 B';
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private addFiles(files: File[]): void {
    if (!files.length) {
      return;
    }

    const { allowedFiles, rejectedAudioFiles } = this.fileAccess.filterUploadFiles(files);

    this.fileAccessMessage = rejectedAudioFiles.length
      ? 'Ficheiros de áudio só podem ser carregados por utilizadores Super Admin ou DU.'
      : '';

    if (!allowedFiles.length) {
      return;
    }

    const existingKeys = new Set(this.files.map((file) => this.getFileKey(file)));

    const newFiles = allowedFiles.filter((file) => !existingKeys.has(this.getFileKey(file)));

    if (!newFiles.length) {
      return;
    }

    this.filesChange.emit([...this.files, ...newFiles]);
  }

  private getFileKey(file: File): string {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }
}
