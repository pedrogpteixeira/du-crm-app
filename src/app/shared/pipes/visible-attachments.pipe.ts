import { Pipe, PipeTransform, inject } from '@angular/core';

import { FileAccessService, FileLike } from '../../core/services/file-access';

@Pipe({
  name: 'visibleAttachments',
  standalone: true,
  pure: false,
})
export class VisibleAttachmentsPipe implements PipeTransform {
  private readonly fileAccess = inject(FileAccessService);

  transform<T extends FileLike>(files: readonly T[] | null | undefined): T[] {
    return this.fileAccess.filterVisibleFiles(files);
  }
}
