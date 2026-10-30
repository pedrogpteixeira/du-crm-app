import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import type { ClientContractProvider } from '../../../core/services/client';
import type {
  EmailRelationEntityType,
  RelatedEmailMessage,
} from '../../../core/models/email-relation.model';
import type { EmailAccountSummary, EmailAddress } from '../../../core/models/email.model';
import { EmailCrmRelationService } from '../../../core/services/email-crm-relation';
import { EmailService } from '../../../core/services/email';
import { ToastService } from '../../../core/services/toast';
import {
  EmailComposer,
  EmailComposerSentEvent,
} from '../../../features/email/email-composer/email-composer';

@Component({
  selector: 'app-entity-email-panel',
  standalone: true,
  imports: [CommonModule, EmailComposer],
  templateUrl: './entity-email-panel.html',
  styleUrl: './entity-email-panel.scss',
})
export class EntityEmailPanel implements OnChanges {
  private static readonly pageSize = 10;

  private readonly relationService = inject(EmailCrmRelationService);
  private readonly emailService = inject(EmailService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadVersion = 0;

  @Input({ required: true }) entityType: EmailRelationEntityType = 'contract';
  @Input({ required: true }) entityId = '';
  @Input() provider: ClientContractProvider | null = null;
  @Input() recipientEmail: string | null = null;

  items: RelatedEmailMessage[] = [];
  accounts: EmailAccountSummary[] = [];
  offset = 0;
  total: number | null = null;
  hasMore = false;
  isLoading = false;
  loadError = '';
  isComposerOpen = false;
  isLoadingAccounts = false;
  deletingRelationId: string | null = null;
  pendingDeleteId: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['entityId'] || changes['entityType'] || changes['provider']) && this.entityId) {
      this.offset = 0;
      this.load();
    }
  }

  get title(): string {
    return this.entityType === 'contract' ? 'Emails do contrato' : 'Emails do ticket';
  }

  get canPrevious(): boolean {
    return this.offset > 0;
  }

  get counterLabel(): string {
    if (this.total !== null) {
      const first = this.items.length ? this.offset + 1 : 0;
      return `${first}–${this.offset + this.items.length} de ${this.total}`;
    }
    return this.items.length ? `${this.offset + 1}–${this.offset + this.items.length}` : '0 emails';
  }

  refresh(): void {
    this.load();
  }

  previous(): void {
    if (!this.canPrevious || this.isLoading) return;
    this.load(Math.max(0, this.offset - EntityEmailPanel.pageSize));
  }

  next(): void {
    if (!this.hasMore || this.isLoading) return;
    this.load(this.offset + EntityEmailPanel.pageSize);
  }

  openMessage(item: RelatedEmailMessage): void {
    void this.router.navigate(['/home/email'], {
      queryParams: { account: item.accountId, message: item.messageId },
    });
  }

  openComposer(): void {
    if (this.accounts.length) {
      this.isComposerOpen = true;
      return;
    }
    if (this.isLoadingAccounts) return;

    this.isLoadingAccounts = true;
    this.emailService
      .getMyAccounts()
      .pipe(
        finalize(() => (this.isLoadingAccounts = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (accounts) => {
          this.accounts = accounts.filter(
            (account) => account.isActive && account.permissions.canSend,
          );
          if (!this.accounts.length) {
            this.toast.warning('Não tens nenhuma conta ativa com permissão de envio.');
            return;
          }
          this.isComposerOpen = true;
        },
        error: (error: unknown) =>
          this.toast.error(
            this.errorMessage(error, 'Não foi possível consultar as contas de email.'),
          ),
      });
  }

  closeComposer(): void {
    this.isComposerOpen = false;
  }

  onSent(event: EmailComposerSentEvent): void {
    this.isComposerOpen = false;
    const messageId = event.result.messageId;
    if (!messageId) {
      this.toast.info(
        'O email foi enviado, mas a API não devolveu um identificador de mensagem para o associar automaticamente a este registo.',
      );
      return;
    }

    this.relationService
      .createRelation({
        accountId: event.accountId,
        messageId,
        entityType: this.entityType,
        entityId: this.entityId,
        ...(this.entityType === 'contract' && this.provider ? { provider: this.provider } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.load(),
        error: (error: unknown) =>
          this.toast.warning(
            this.errorMessage(
              error,
              'O email foi enviado, mas não foi possível associá-lo automaticamente a este registo.',
            ),
          ),
      });
  }

  askRemove(relationId: string): void {
    this.pendingDeleteId = relationId;
  }

  cancelRemove(): void {
    this.pendingDeleteId = null;
  }

  remove(item: RelatedEmailMessage): void {
    if (this.deletingRelationId) return;
    this.deletingRelationId = item.relationId;
    this.relationService
      .deleteRelation(item.relationId)
      .pipe(
        finalize(() => {
          this.deletingRelationId = null;
          this.pendingDeleteId = null;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.success('Associação de email removida.');
          if (this.items.length === 1 && this.offset > 0)
            this.offset = Math.max(0, this.offset - EntityEmailPanel.pageSize);
          this.load();
        },
        error: (error: unknown) =>
          this.toast.error(this.errorMessage(error, 'Não foi possível remover a associação.')),
      });
  }

  trackByRelationId(_: number, item: RelatedEmailMessage): string {
    return item.relationId;
  }

  formatAddress(address: EmailAddress | null): string {
    if (!address) return 'Remetente desconhecido';
    return address.name ? `${address.name} <${address.address}>` : address.address;
  }

  private load(requestedOffset = this.offset): void {
    if (!this.entityId || (this.entityType === 'contract' && !this.provider)) return;

    const version = ++this.loadVersion;
    const entityType = this.entityType;
    const entityId = this.entityId;
    const provider = this.provider;
    const offset = requestedOffset;
    const hasExistingData = this.items.length > 0;

    this.isLoading = true;
    this.loadError = '';
    this.relationService
      .getEntityRelations(entityType, entityId, provider, offset, EntityEmailPanel.pageSize)
      .pipe(
        finalize(() => {
          if (version === this.loadVersion) this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (page) => {
          if (version !== this.loadVersion) return;
          this.items = page.items;
          this.offset = page.offset;
          this.total = page.total;
          this.hasMore = page.hasMore;
        },
        error: (error: unknown) => {
          if (version !== this.loadVersion) return;
          if (!hasExistingData) {
            this.items = [];
            this.hasMore = false;
            this.total = null;
          }
          this.loadError = this.errorMessage(
            error,
            'Não foi possível carregar a correspondência associada.',
          );
        },
      });
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object') {
      const body = (error as { error?: unknown }).error;
      if (body && typeof body === 'object') {
        const message = (body as Record<string, unknown>)['message'];
        if (typeof message === 'string' && message.trim()) return message.trim();
      }
    }
    return fallback;
  }
}
