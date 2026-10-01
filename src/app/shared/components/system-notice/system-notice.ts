import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { SystemNoticeService } from '../../../core/services/system-notice';

@Component({
  selector: 'app-system-notice',
  imports: [CommonModule],
  templateUrl: './system-notice.html',
  styleUrl: './system-notice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemNoticeComponent {
  private readonly notices = inject(SystemNoticeService);

  readonly activeNotice$ = this.notices.activeNotice$;

  dismiss(noticeId: string): void {
    this.notices.dismissLocally(noticeId);
  }
}
