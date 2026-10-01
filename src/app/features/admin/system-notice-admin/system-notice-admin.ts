import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  SystemNotice,
  SystemNoticeAudience,
  SystemNoticeCreateInput,
  SystemNoticeType,
} from '../../../core/models/system-notice';
import { SystemNoticeService } from '../../../core/services/system-notice';
import { ToastService } from '../../../core/services/toast';

interface SystemNoticeDraft {
  title: string;
  message: string;
  type: SystemNoticeType;
  audience: SystemNoticeAudience;
  deferWhileCriticalRequest: boolean;
  expiresAt: string;
}

@Component({
  selector: 'app-system-notice-admin',
  imports: [CommonModule, FormsModule],
  templateUrl: './system-notice-admin.html',
  styleUrl: './system-notice-admin.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SystemNoticeAdmin implements OnInit {
  private readonly notices = inject(SystemNoticeService);
  private readonly toast = inject(ToastService);

  readonly activeNotices$ = this.notices.notices$;

  isSaving = false;
  isLoading = false;
  readonly deletingNoticeIds = new Set<string>();

  draft: SystemNoticeDraft = this.createEmptyDraft();

  ngOnInit(): void {
    this.loadActiveNotices();
  }

  get canSubmit(): boolean {
    return Boolean(
      this.normalizeText(this.draft?.title) && this.normalizeText(this.draft?.message),
    );
  }

  get audienceHelpText(): string {
    if (this.draft.audience === 'authenticated') {
      return 'O aviso fica ativo para utilizadores autenticados até ser removido ou expirar.';
    }

    return 'O aviso fica ativo para todos os utilizadores abrangidos pelo backend até ser removido ou expirar.';
  }

  publish(): void {
    if (this.isSaving || !this.canSubmit) {
      return;
    }

    const payload = this.buildPayload();
    this.isSaving = true;

    this.notices
      .create(payload)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (response) => {
          this.draft = this.createEmptyDraft();

          const connections = response.recipientSockets;
          if (typeof connections === 'number') {
            const label = connections === 1 ? 'ligação autenticada' : 'ligações autenticadas';
            this.toast.success(`Aviso criado com sucesso e enviado a ${connections} ${label}.`);
            return;
          }

          this.toast.success(response.message || 'Aviso criado com sucesso.');
        },
        error: (error: unknown) => {
          this.toast.error(this.getErrorMessage(error, 'Não foi possível criar o aviso geral.'));
        },
      });
  }

  loadActiveNotices(showErrorToast = true): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;

    this.notices
      .loadMine()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        error: (error: unknown) => {
          if (showErrorToast) {
            this.toast.error(
              this.getErrorMessage(error, 'Não foi possível carregar os avisos ativos.'),
            );
          }
        },
      });
  }

  removeNotice(notice: SystemNotice): void {
    if (this.deletingNoticeIds.has(notice.id)) {
      return;
    }

    this.deletingNoticeIds.add(notice.id);

    this.notices
      .remove(notice.id)
      .pipe(finalize(() => this.deletingNoticeIds.delete(notice.id)))
      .subscribe({
        next: () => this.toast.success('Aviso removido com sucesso.'),
        error: (error: unknown) => {
          this.toast.error(this.getErrorMessage(error, 'Não foi possível remover o aviso.'));
        },
      });
  }

  isDeleting(noticeId: string): boolean {
    return this.deletingNoticeIds.has(noticeId);
  }

  typeLabel(type: SystemNoticeType): string {
    switch (type) {
      case 'warning':
        return 'Aviso';
      case 'error':
        return 'Erro';
      default:
        return 'Informação';
    }
  }

  audienceLabel(audience: SystemNoticeAudience): string {
    return audience === 'authenticated' ? 'Autenticados' : 'Todos';
  }

  trackByNoticeId(_index: number, notice: SystemNotice): string {
    return notice.id;
  }

  private buildPayload(): SystemNoticeCreateInput {
    return {
      title: this.normalizeText(this.draft.title),
      message: this.normalizeText(this.draft.message),
      type: this.draft.type,
      audience: this.draft.audience,
      deferWhileCriticalRequest: Boolean(this.draft.deferWhileCriticalRequest),
      expiresAt: this.normalizeDateTime(this.draft.expiresAt),
    };
  }

  private createEmptyDraft(): SystemNoticeDraft {
    return {
      title: '',
      message: '',
      type: 'info',
      audience: 'all',
      deferWhileCriticalRequest: true,
      expiresAt: '',
    };
  }

  private normalizeDateTime(value: unknown): string | null {
    const normalized = this.normalizeText(value);

    if (!normalized) {
      return null;
    }

    const timestamp = new Date(normalized).getTime();
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  }

  private normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    if (!error.error || typeof error.error !== 'object') {
      return fallback;
    }

    const body = error.error as { message?: unknown };
    return this.normalizeText(body.message) || fallback;
  }
}
