import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, inject } from '@angular/core';
import { catchError, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';

import { SystemNotice } from '../../../core/models/system-notice';
import { SystemNoticeService } from '../../../core/services/system-notice';

type SystemNoticeImageState = 'none' | 'loading' | 'ready' | 'error';

interface SystemNoticeViewModel {
  notice: SystemNotice;
  imageUrl: string | null;
  imageState: SystemNoticeImageState;
}

@Component({
  selector: 'app-system-notice',
  imports: [CommonModule],
  templateUrl: './system-notice.html',
  styleUrl: './system-notice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemNoticeComponent implements OnDestroy {
  private readonly notices = inject(SystemNoticeService);
  private activeImageObjectUrl: string | null = null;

  readonly activeNoticeView$ = this.notices.activeNotice$.pipe(
    distinctUntilChanged((previous, current) => this.isSameRenderedNotice(previous, current)),
    switchMap((notice) => {
      this.revokeActiveImageObjectUrl();

      if (!notice) {
        return of<SystemNoticeViewModel | null>(null);
      }

      if (!notice.image) {
        return of<SystemNoticeViewModel>({
          notice,
          imageUrl: null,
          imageState: 'none',
        });
      }

      const loadingView: SystemNoticeViewModel = {
        notice,
        imageUrl: null,
        imageState: 'loading',
      };

      return this.notices.loadImage(notice.id).pipe(
        map((blob) => {
          const imageUrl = URL.createObjectURL(blob);
          this.activeImageObjectUrl = imageUrl;

          return {
            notice,
            imageUrl,
            imageState: 'ready',
          } satisfies SystemNoticeViewModel;
        }),
        catchError(() =>
          of<SystemNoticeViewModel>({
            notice,
            imageUrl: null,
            imageState: 'error',
          }),
        ),
        startWith(loadingView),
      );
    }),
  );

  ngOnDestroy(): void {
    this.revokeActiveImageObjectUrl();
  }

  dismiss(noticeId: string): void {
    this.revokeActiveImageObjectUrl();
    this.notices.dismissLocally(noticeId);
  }

  private isSameRenderedNotice(
    previous: SystemNotice | null,
    current: SystemNotice | null,
  ): boolean {
    if (previous === current) {
      return true;
    }

    if (!previous || !current) {
      return false;
    }

    return (
      previous.id === current.id &&
      previous.updatedAt === current.updatedAt &&
      previous.image?.fileName === current.image?.fileName &&
      previous.image?.size === current.image?.size
    );
  }

  private revokeActiveImageObjectUrl(): void {
    if (!this.activeImageObjectUrl) {
      return;
    }

    URL.revokeObjectURL(this.activeImageObjectUrl);
    this.activeImageObjectUrl = null;
  }
}
