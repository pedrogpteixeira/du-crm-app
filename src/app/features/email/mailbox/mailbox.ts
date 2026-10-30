import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, EMPTY, finalize, forkJoin, map, of, switchMap } from 'rxjs';

import {
  EmailAccountSummary,
  EmailAddress,
  EmailAttachmentSummary,
  EmailDraftPage,
  EmailDraftSummary,
  EmailFolder,
  EmailFolderSummary,
  EmailMessageDetail,
  EmailMessagePage,
  EmailMessageSummary,
  EmailReadChangedEvent,
  EmailSentEvent,
  EmailSyncCompletedEvent,
  EmailSyncFailedEvent,
} from '../../../core/models/email.model';
import { Auth } from '../../../core/services/auth';
import { EmailService } from '../../../core/services/email';
import { EmailCrmRelationService } from '../../../core/services/email-crm-relation';
import { ToastService } from '../../../core/services/toast';
import { SocketService } from '../../../core/services/socket';
import { EmailComposer, EmailComposerMode, EmailComposerSentEvent } from '../email-composer/email-composer';
import { EmailRelationModal } from '../email-relation-modal/email-relation-modal';

interface MailboxRequest {
  accountId: string;
  folder: EmailFolder;
  offset: number;
  reason: 'initial' | 'refresh' | 'pagination';
}

type MailboxPageResult =
  | { kind: 'messages'; page: EmailMessagePage }
  | { kind: 'drafts'; page: EmailDraftPage };

@Component({
  selector: 'app-mailbox',
  imports: [CommonModule, EmailComposer, EmailRelationModal],
  templateUrl: './mailbox.html',
  styleUrl: './mailbox.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class Mailbox {
  private static readonly pageSize = 25;
  private static readonly selectedAccountStorageKey = 'crm.email.selectedAccountId';

  private readonly emailService = inject(EmailService);
  private readonly relationService = inject(EmailCrmRelationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(Auth);
  private readonly socket = inject(SocketService);

  private readonly mailboxRequest$ = new BehaviorSubject<MailboxRequest | null>(null);
  private readonly selectedMessageId$ = new BehaviorSubject<string | null>(null);
  private foldersLoadVersion = 0;
  private messageListLoadVersion = 0;
  private messageDetailLoadVersion = 0;
  private attachmentLoadVersion = 0;
  private readOperationVersion = 0;
  private syncOperationVersion = 0;
  private pendingSocketListRefresh = false;

  accounts: EmailAccountSummary[] = [];
  selectedAccount: EmailAccountSummary | null = null;
  folders: EmailFolderSummary[] = [];
  folder: EmailFolder = 'INBOX';
  messages: EmailMessageSummary[] = [];
  drafts: EmailDraftSummary[] = [];
  selectedMessage: EmailMessageDetail | null = null;
  selectedDraft: EmailDraftSummary | null = null;
  messageAttachments: EmailAttachmentSummary[] = [];
  isLoadingAttachments = false;
  attachmentsError = '';
  isLoadingFolders = false;
  foldersError = '';
  isUpdatingRead = false;
  readError = '';
  isSyncingMessages = false;
  syncError = '';
  downloadingAttachmentIndexes = new Set<number>();
  isComposerOpen = false;
  composerMode: EmailComposerMode = 'new';
  composerSourceMessage: EmailMessageDetail | null = null;
  composerDraft: EmailDraftSummary | null = null;
  isRelationModalOpen = false;

  offset = 0;
  private loadedOffset = 0;
  hasMore = false;
  total: number | null = null;

  isLoadingAccounts = true;
  isLoadingMessages = false;
  isRefreshingMessages = false;
  isPagingMessages = false;
  isLoadingMessage = false;
  accountsError = '';
  messagesError = '';
  messageError = '';

  constructor() {
    this.bindMessageList();
    this.bindSelectedMessage();
    this.bindEmailSocketEvents();
    this.loadAccounts();
  }

  get canOpenEmailAdmin(): boolean { return this.auth.roleIncludes(['Super Admin']); }
  get canReadSelectedAccount(): boolean { return Boolean(this.selectedAccount?.isActive && this.selectedAccount.permissions.canRead); }
  get canSendSelectedAccount(): boolean { return Boolean(this.selectedAccount?.isActive && this.selectedAccount.permissions.canSend); }
  get canManageMessagesSelectedAccount(): boolean { return Boolean(this.selectedAccount?.isActive && this.selectedAccount.permissions.canManageMessages); }
  get currentPage(): number { return Math.floor(this.offset / Mailbox.pageSize) + 1; }
  get hasPreviousPage(): boolean { return this.offset > 0; }
  get mailboxTitle(): string { return this.folder === 'INBOX' ? 'Caixa de Entrada' : this.folder === 'SENT' ? 'Enviados' : 'Rascunhos'; }
  get canSyncCurrentFolder(): boolean {
    if (!this.canReadSelectedAccount || this.folder === 'DRAFTS') return false;
    return this.folders.some((item) => item.folder === this.folder && item.remoteSync);
  }
  get visibleItemsCount(): number { return this.folder === 'DRAFTS' ? this.drafts.length : this.messages.length; }
  get selectedAccountPermissionLabel(): string {
    const permissions = this.selectedAccount?.permissions;
    if (!permissions) return 'Sem permissões';
    if (permissions.canManageMessages) return permissions.canSend ? 'Leitura, envio e gestão' : 'Leitura e gestão';
    if (permissions.canRead && permissions.canSend) return 'Leitura e envio';
    if (permissions.canSend) return 'Apenas envio';
    if (permissions.canRead) return 'Só leitura';
    return 'Sem permissões';
  }

  goToTemplates(): void { void this.router.navigate(['/home/email/templates']); }
  goToAdmin(): void { if (this.canOpenEmailAdmin) void this.router.navigate(['/home/email/admin']); }

  folderAvailable(folder: EmailFolder): boolean {
    if (folder === 'DRAFTS' && !this.canSendSelectedAccount) return false;
    if (!this.folders.length) return folder === 'DRAFTS' ? this.canSendSelectedAccount : this.canReadSelectedAccount;
    return this.folders.some((item) => item.folder === folder);
  }


  selectAccount(accountId: string): void {
    const account = this.accounts.find((item) => item.id === accountId) ?? null;
    if (!account || account.id === this.selectedAccount?.id) return;

    this.resetAccountScopedState();
    this.selectedAccount = account;
    sessionStorage.setItem(Mailbox.selectedAccountStorageKey, account.id);
    this.folder = this.resolveFolderForAccount(account, this.resolveInitialFolder());
    this.offset = 0;
    this.loadFolders();
    this.requestMessages('initial');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { account: account.id, folder: this.folder, message: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onAccountChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) this.selectAccount(target.value);
  }

  selectFolder(folder: EmailFolder): void {
    if (this.folder === folder || !this.folderAvailable(folder)) return;
    ++this.syncOperationVersion;
    this.isSyncingMessages = false;
    this.syncError = '';
    this.folder = folder;
    this.offset = 0;
    this.clearSelection();
    this.requestMessages('initial');
    void this.router.navigate([], { relativeTo: this.route, queryParams: { folder, message: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  selectMessage(message: EmailMessageSummary): void {
    if (!this.selectedAccount || !this.canReadSelectedAccount || this.folder === 'DRAFTS') return;
    this.selectedMessage = null;
    this.messageError = '';
    this.selectedMessageId$.next(message.id);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { message: message.id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  openDraft(draft: EmailDraftSummary): void {
    if (!this.canSendSelectedAccount) return;
    this.selectedDraft = draft;
    this.composerDraft = draft;
    this.composerMode = 'draft';
    this.composerSourceMessage = null;
    this.isComposerOpen = true;
  }

  refresh(): void {
    if (this.isLoadingMessages || this.isRefreshingMessages || this.isPagingMessages || this.isSyncingMessages) return;
    this.clearSelection();
    this.loadFolders();
    void this.router.navigate([], { relativeTo: this.route, queryParams: { message: null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.requestMessages('refresh');
  }

  syncCurrentFolder(): void {
    const account = this.selectedAccount;
    if (!account || !this.canSyncCurrentFolder || this.isSyncingMessages || this.isLoadingMessages || this.isRefreshingMessages || this.isPagingMessages) return;

    const accountId = account.id;
    const folder = this.folder as Exclude<EmailFolder, 'DRAFTS'>;
    const version = ++this.syncOperationVersion;
    this.isSyncingMessages = true;
    this.syncError = '';

    this.emailService.syncMessages(accountId, folder).pipe(
      finalize(() => {
        if (version === this.syncOperationVersion) this.isSyncingMessages = false;
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (result) => {
        if (version !== this.syncOperationVersion || this.selectedAccount?.id !== accountId || this.folder !== folder) return;
        const insertedLabel = result.inserted === 1 ? '1 mensagem nova' : `${result.inserted} mensagens novas`;
        this.toast.success(`Sincronização concluída: ${insertedLabel}; ${result.skipped} ignoradas.`);
        this.offset = 0;
        this.clearSelection();
        void this.router.navigate([], { relativeTo: this.route, queryParams: { message: null }, queryParamsHandling: 'merge', replaceUrl: true });
        this.requestMessages('refresh');
      },
      error: (error: unknown) => {
        if (version !== this.syncOperationVersion || this.selectedAccount?.id !== accountId || this.folder !== folder) return;
        this.syncError = this.getErrorMessage(error);
        this.toast.error(this.syncError);
      },
    });
  }

  retryLoadAccounts(): void { if (!this.isLoadingAccounts) this.loadAccounts(); }
  retryLoadFolders(): void { if (!this.isLoadingFolders) this.loadFolders(); }
  retrySelectedMessage(): void {
    const messageId = this.route.snapshot.queryParamMap.get('message');
    if (messageId && this.canReadSelectedAccount && !this.isLoadingMessage) this.selectedMessageId$.next(messageId);
  }
  retryLoadAttachments(): void { if (this.selectedMessage && !this.isLoadingAttachments) this.loadAttachments(this.selectedMessage.id); }
  previousPage(): void { if (this.hasPreviousPage && !this.isPagingMessages) { this.offset = Math.max(0, this.offset - Mailbox.pageSize); this.clearSelection(); this.requestMessages('pagination'); } }
  nextPage(): void { if (this.hasMore && !this.isPagingMessages) { this.offset += Mailbox.pageSize; this.clearSelection(); this.requestMessages('pagination'); } }

  openComposer(mode: EmailComposerMode = 'new'): void {
    if (!this.accounts.some((account) => account.isActive && account.permissions.canSend)) {
      this.toast.warning('Não tens nenhuma conta ativa com permissão de envio.');
      return;
    }
    this.composerMode = mode;
    this.composerSourceMessage = mode === 'new' ? null : this.selectedMessage;
    this.composerDraft = null;
    this.isComposerOpen = true;
  }

  closeComposer(): void {
    this.isComposerOpen = false;
    this.composerSourceMessage = null;
    this.composerDraft = null;
    this.composerMode = 'new';
  }

  onDraftChanged(): void {
    if (this.folder === 'DRAFTS') this.requestMessages('refresh');
  }

  onMessageSent(event: EmailComposerSentEvent): void {
    const sourceMessageId = this.composerSourceMessage?.id ?? null;
    const newMessageId = event.result.messageId;
    const accountId = event.accountId;
    this.closeComposer();
    if (this.folder === 'SENT' || this.folder === 'DRAFTS') {
      this.offset = 0;
      this.requestMessages('refresh');
    }
    if (sourceMessageId && newMessageId) this.copySourceRelations(accountId, sourceMessageId, newMessageId);
  }

  openRelationModal(): void { if (this.selectedAccount && this.selectedMessage) this.isRelationModalOpen = true; }
  closeRelationModal(): void { this.isRelationModalOpen = false; }

  toggleSelectedMessageRead(): void {
    const message = this.selectedMessage;
    if (!message || message.isRead === null || this.isUpdatingRead) return;
    this.updateMessageRead(message.id, !message.isRead, true);
  }

  downloadAttachment(attachment: EmailAttachmentSummary): void {
    const account = this.selectedAccount;
    const message = this.selectedMessage;
    const index = attachment.index;
    if (!account || !message || this.downloadingAttachmentIndexes.has(index)) return;
    const accountId = account.id;
    const messageId = message.id;
    this.downloadingAttachmentIndexes.add(index);
    this.emailService.downloadAttachment(accountId, messageId, index).pipe(
      finalize(() => this.downloadingAttachmentIndexes.delete(index)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (blob) => {
        if (this.selectedAccount?.id !== accountId || this.selectedMessage?.id !== messageId) return;
        this.saveBlob(blob, attachment.filename);
      },
      error: (error: unknown) => {
        if (this.selectedAccount?.id === accountId && this.selectedMessage?.id === messageId) this.toast.error(this.getErrorMessage(error));
      },
    });
  }

  trackByAccountId(_: number, account: EmailAccountSummary): string { return account.id; }
  trackByMessageId(_: number, message: EmailMessageSummary): string { return message.id; }
  trackByDraftId(_: number, draft: EmailDraftSummary): string { return draft.id; }
  trackByAttachmentIndex(_: number, attachment: EmailAttachmentSummary): number { return attachment.index; }

  formatBytes(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatAddress(address: EmailAddress | null): string { return !address ? '—' : address.name ? `${address.name} <${address.address}>` : address.address; }
  formatAddressList(addresses: EmailAddress[]): string { return addresses.length ? addresses.map((address) => this.formatAddress(address)).join(', ') : '—'; }
  getVisibleMessageBody(): string { return this.selectedMessage?.text?.trim() || ''; }

  getMessageCounterLabel(): string {
    if (this.total !== null) {
      const first = this.visibleItemsCount ? this.offset + 1 : 0;
      return `${first}–${this.offset + this.visibleItemsCount} de ${this.total}`;
    }
    return this.visibleItemsCount ? `${this.offset + 1}–${this.offset + this.visibleItemsCount}` : this.folder === 'DRAFTS' ? '0 rascunhos' : '0 mensagens';
  }

  private loadAccounts(): void {
    this.isLoadingAccounts = true;
    this.accountsError = '';
    this.emailService.getMyAccounts().pipe(
      finalize(() => (this.isLoadingAccounts = false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (accounts) => {
        this.resetAccountScopedState();
        this.accounts = accounts;
        this.selectedAccount = this.resolveInitialAccount(accounts);
        if (!this.selectedAccount) {
          sessionStorage.removeItem(Mailbox.selectedAccountStorageKey);
          void this.router.navigate([], { relativeTo: this.route, queryParams: { account: null, message: null }, queryParamsHandling: 'merge', replaceUrl: true });
          return;
        }

        const initialMessageId = this.route.snapshot.queryParamMap.get('message');
        this.folder = this.resolveFolderForAccount(this.selectedAccount, this.resolveInitialFolder());
        sessionStorage.setItem(Mailbox.selectedAccountStorageKey, this.selectedAccount.id);
        this.loadFolders();
        this.requestMessages('initial');
        const canOpenInitialMessage = Boolean(initialMessageId && this.folder !== 'DRAFTS' && this.canReadSelectedAccount);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { account: this.selectedAccount.id, folder: this.folder, message: canOpenInitialMessage ? initialMessageId : null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        if (canOpenInitialMessage && initialMessageId) this.selectedMessageId$.next(initialMessageId);
      },
      error: (error: unknown) => {
        this.resetAccountScopedState();
        this.accounts = [];
        this.selectedAccount = null;
        this.accountsError = this.getErrorMessage(error);
      },
    });
  }

  private loadFolders(): void {
    const account = this.selectedAccount;
    const version = ++this.foldersLoadVersion;

    if (!account?.isActive) {
      this.folders = [];
      this.isLoadingFolders = false;
      return;
    }

    // /messages/folders exige canRead. Uma conta atribuída pode existir apenas com canSend.
    if (!account.permissions.canRead) {
      this.folders = account.permissions.canSend
        ? [{ folder: 'DRAFTS', label: 'Rascunhos', remoteSync: false }]
        : [];
      this.isLoadingFolders = false;
      return;
    }

    const accountId = account.id;
    this.foldersError = '';
    this.isLoadingFolders = true;
    this.emailService.getFolders(accountId).pipe(
      finalize(() => {
        if (version === this.foldersLoadVersion) this.isLoadingFolders = false;
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (folders) => {
        if (version !== this.foldersLoadVersion || this.selectedAccount?.id !== accountId) return;
        this.folders = folders.filter((item) => item.folder !== 'DRAFTS' || account.permissions.canSend);
        if (!this.folderAvailable(this.folder)) {
          this.folder = this.resolveFolderForAccount(account, 'INBOX');
          this.offset = 0;
          this.clearSelection();
          this.requestMessages('initial');
          void this.router.navigate([], { relativeTo: this.route, queryParams: { folder: this.folder, message: null }, queryParamsHandling: 'merge', replaceUrl: true });
        }
      },
      error: (error: unknown) => {
        if (version !== this.foldersLoadVersion || this.selectedAccount?.id !== accountId) return;
        this.folders = account.permissions.canSend
          ? [{ folder: 'DRAFTS', label: 'Rascunhos', remoteSync: false }]
          : [];
        this.foldersError = this.getErrorMessage(error);
        this.toast.error(this.foldersError);
      },
    });
  }

  private bindMessageList(): void {
    this.mailboxRequest$.pipe(
      switchMap((request) => {
        if (!request) {
          this.isLoadingMessages = false;
          this.isRefreshingMessages = false;
          this.isPagingMessages = false;
          return EMPTY;
        }

        const version = ++this.messageListLoadVersion;
        const isInitial = request.reason === 'initial';
        this.messagesError = '';
        this.isLoadingMessages = isInitial;
        this.isRefreshingMessages = request.reason === 'refresh';
        this.isPagingMessages = request.reason === 'pagination';

        if (isInitial) {
          this.messages = [];
          this.drafts = [];
          this.hasMore = false;
          this.total = null;
        }

        const call = request.folder === 'DRAFTS'
          ? this.emailService.getDrafts(request.accountId, request.offset, Mailbox.pageSize).pipe(map((page): MailboxPageResult => ({ kind: 'drafts', page })))
          : this.emailService.getMessages(request.accountId, request.folder, request.offset, Mailbox.pageSize).pipe(map((page): MailboxPageResult => ({ kind: 'messages', page })));

        return call.pipe(
          catchError((error: unknown) => {
            if (version === this.messageListLoadVersion) {
              this.messagesError = this.getErrorMessage(error);
              if (request.reason === 'pagination') this.offset = this.loadedOffset;
            }
            return EMPTY;
          }),
          finalize(() => {
            if (version !== this.messageListLoadVersion) return;
            this.isLoadingMessages = false;
            this.isRefreshingMessages = false;
            this.isPagingMessages = false;
            this.flushPendingSocketListRefresh();
          }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((result) => {
      this.offset = result.page.offset;
      this.loadedOffset = result.page.offset;
      this.hasMore = result.page.hasMore;
      this.total = result.page.total;
      if (result.kind === 'drafts') this.drafts = result.page.items;
      else this.messages = result.page.items;
    });
  }

  private bindSelectedMessage(): void {
    combineLatest([this.mailboxRequest$, this.selectedMessageId$]).pipe(
      switchMap(([request, messageId]) => {
        const version = ++this.messageDetailLoadVersion;
        if (!request || !messageId || request.folder === 'DRAFTS') {
          this.isLoadingMessage = false;
          return EMPTY;
        }
        this.isLoadingMessage = true;
        this.messageError = '';
        return this.emailService.getMessage(request.accountId, messageId).pipe(
          catchError((error: unknown) => {
            if (version === this.messageDetailLoadVersion) this.messageError = this.getErrorMessage(error);
            return EMPTY;
          }),
          finalize(() => {
            if (version === this.messageDetailLoadVersion) this.isLoadingMessage = false;
          }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((message) => {
      this.selectedMessage = message;
      ++this.attachmentLoadVersion;
      this.isLoadingAttachments = false;
      this.messageAttachments = [];
      this.attachmentsError = '';
      if (message.hasAttachments) this.loadAttachments(message.id);
      if (message.isRead === false && this.folder === 'INBOX' && this.canManageMessagesSelectedAccount) this.markOpenedMessageRead(message.id);
    });
  }

  private markOpenedMessageRead(messageId: string): void {
    if (this.isUpdatingRead) return;
    this.updateMessageRead(messageId, true, false);
  }

  private updateMessageRead(messageId: string, read: boolean, notifyOnError: boolean): void {
    const account = this.selectedAccount;
    if (!account || this.isUpdatingRead) return;
    const accountId = account.id;
    const version = ++this.readOperationVersion;
    this.isUpdatingRead = true;
    this.readError = '';
    this.emailService.setMessageRead(accountId, messageId, read).pipe(
      finalize(() => {
        if (version === this.readOperationVersion) this.isUpdatingRead = false;
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (response) => {
        if (version !== this.readOperationVersion || this.selectedAccount?.id !== accountId) return;
        this.applyReadState(response.id, response.read);
      },
      error: (error: unknown) => {
        if (version !== this.readOperationVersion || this.selectedAccount?.id !== accountId) return;
        this.readError = this.getErrorMessage(error);
        if (notifyOnError) this.toast.error(this.readError);
      },
    });
  }

  private applyReadState(messageId: string, isRead: boolean): void {
    if (this.selectedMessage?.id === messageId) this.selectedMessage = { ...this.selectedMessage, isRead };
    this.messages = this.messages.map((item) => item.id === messageId ? { ...item, isRead } : item);
  }

  private loadAttachments(messageId: string): void {
    const account = this.selectedAccount;
    if (!account) return;
    const version = ++this.attachmentLoadVersion;
    const accountId = account.id;
    this.attachmentsError = '';
    this.isLoadingAttachments = true;
    this.emailService.getAttachments(accountId, messageId).pipe(
      catchError((error: unknown) => {
        if (version === this.attachmentLoadVersion && this.selectedMessage?.id === messageId) {
          this.attachmentsError = this.getErrorMessage(error);
        }
        return EMPTY;
      }),
      finalize(() => {
        if (version === this.attachmentLoadVersion) this.isLoadingAttachments = false;
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((attachments) => {
      if (version === this.attachmentLoadVersion && this.selectedAccount?.id === accountId && this.selectedMessage?.id === messageId) {
        this.messageAttachments = attachments;
      }
    });
  }

  private requestMessages(reason: 'initial' | 'refresh' | 'pagination' = 'initial'): void {
    const account = this.selectedAccount;
    const allowed = this.folder === 'DRAFTS' ? this.canSendSelectedAccount : this.canReadSelectedAccount;
    if (!account || !account.isActive || !allowed) {
      this.messages = [];
      this.drafts = [];
      this.hasMore = false;
      this.total = null;
      this.mailboxRequest$.next(null);
      return;
    }
    this.mailboxRequest$.next({ accountId: account.id, folder: this.folder, offset: this.offset, reason });
  }

  private clearSelection(): void {
    ++this.readOperationVersion;
    this.isUpdatingRead = false;
    this.readError = '';
    this.selectedMessage = null;
    this.selectedDraft = null;
    this.messageAttachments = [];
    this.messageError = '';
    this.selectedMessageId$.next(null);
  }

  private resolveInitialAccount(accounts: EmailAccountSummary[]): EmailAccountSummary | null {
    const preferredId = this.route.snapshot.queryParamMap.get('account') || sessionStorage.getItem(Mailbox.selectedAccountStorageKey);
    return accounts.find((account) => account.id === preferredId)
      ?? accounts.find((account) => account.isActive && (account.permissions.canRead || account.permissions.canSend))
      ?? accounts[0]
      ?? null;
  }

  private resolveFolderForAccount(account: EmailAccountSummary, requested: EmailFolder): EmailFolder {
    if (!account.permissions.canRead && account.permissions.canSend) return 'DRAFTS';
    if (requested === 'DRAFTS' && !account.permissions.canSend) return account.permissions.canRead ? 'INBOX' : requested;
    return requested;
  }

  private resetAccountScopedState(): void {
    ++this.foldersLoadVersion;
    ++this.messageListLoadVersion;
    ++this.messageDetailLoadVersion;
    ++this.attachmentLoadVersion;
    ++this.readOperationVersion;
    ++this.syncOperationVersion;
    this.mailboxRequest$.next(null);
    this.selectedMessageId$.next(null);
    this.folders = [];
    this.messages = [];
    this.drafts = [];
    this.selectedMessage = null;
    this.selectedDraft = null;
    this.messageAttachments = [];
    this.messagesError = '';
    this.messageError = '';
    this.foldersError = '';
    this.attachmentsError = '';
    this.readError = '';
    this.downloadingAttachmentIndexes.clear();
    this.hasMore = false;
    this.total = null;
    this.offset = 0;
    this.loadedOffset = 0;
    this.isLoadingFolders = false;
    this.isLoadingMessages = false;
    this.isRefreshingMessages = false;
    this.isPagingMessages = false;
    this.isLoadingMessage = false;
    this.isLoadingAttachments = false;
    this.isUpdatingRead = false;
    this.isSyncingMessages = false;
    this.syncError = '';
    this.pendingSocketListRefresh = false;
  }

  private resolveInitialFolder(): EmailFolder {
    const folder = this.route.snapshot.queryParamMap.get('folder')?.toUpperCase();
    return folder === 'SENT' ? 'SENT' : folder === 'DRAFTS' ? 'DRAFTS' : 'INBOX';
  }


  private bindEmailSocketEvents(): void {
    this.socket.listenEmailReadChanged().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      this.handleEmailReadChanged(event);
    });

    this.socket.listenEmailSyncCompleted().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      this.handleEmailSyncCompleted(event);
    });

    this.socket.listenEmailSyncFailed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      this.handleEmailSyncFailed(event);
    });

    this.socket.listenEmailSent().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      this.handleEmailSent(event);
    });
  }

  private handleEmailReadChanged(event: EmailReadChangedEvent): void {
    if (this.selectedAccount?.id !== event.accountId) return;
    this.applyReadState(event.id, event.read);
  }

  private handleEmailSyncCompleted(event: EmailSyncCompletedEvent): void {
    if (this.selectedAccount?.id !== event.accountId || this.folder !== event.folder) return;

    // O pedido HTTP da sincronização manual já atualiza a lista e apresenta o feedback.
    if (this.isSyncingMessages) return;

    this.syncError = '';
    this.queueSocketListRefresh();
  }

  private handleEmailSyncFailed(event: EmailSyncFailedEvent): void {
    if (this.selectedAccount?.id !== event.accountId || this.folder !== event.folder) return;

    // A sincronização iniciada nesta instância já trata o erro HTTP correspondente.
    if (this.isSyncingMessages) return;

    this.syncError = 'A sincronização remota desta pasta falhou.';
  }

  private handleEmailSent(event: EmailSentEvent): void {
    if (this.selectedAccount?.id !== event.accountId || this.folder !== 'SENT') return;
    this.queueSocketListRefresh();
  }

  private queueSocketListRefresh(): void {
    if (!this.selectedAccount) return;

    if (this.isLoadingMessages || this.isRefreshingMessages || this.isPagingMessages || this.isSyncingMessages) {
      this.pendingSocketListRefresh = true;
      return;
    }

    this.pendingSocketListRefresh = false;
    this.requestMessages('refresh');
  }

  private flushPendingSocketListRefresh(): void {
    if (!this.pendingSocketListRefresh || this.isLoadingMessages || this.isRefreshingMessages || this.isPagingMessages || this.isSyncingMessages) return;
    this.pendingSocketListRefresh = false;
    this.requestMessages('refresh');
  }

  private copySourceRelations(accountId: string, sourceMessageId: string, newMessageId: string): void {
    this.relationService.getMessageRelations(accountId, sourceMessageId).pipe(
      switchMap((relations) => {
        if (!relations.length) return of([]);
        return forkJoin(relations.map((relation) => this.relationService.createRelation({
          accountId,
          messageId: newMessageId,
          entityType: relation.entityType,
          entityId: relation.entityId,
          ...(relation.entityType === 'contract' && relation.provider ? { provider: relation.provider } : {}),
        }).pipe(catchError(() => of(null)))));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage = this.readApiMessage(error.error);
      if (apiMessage) return apiMessage;
      if (error.status === 0) return 'Não foi possível contactar a API. Verifica a ligação e tenta novamente.';
      if (error.status === 401) return 'A sessão deixou de ser válida. Autentica-te novamente.';
      if (error.status === 403) return 'Não tens permissão para executar esta operação.';
      if (error.status === 404) return 'O recurso solicitado não está disponível ou deixou de existir.';
      if (error.status === 409) return 'A operação entrou em conflito com o estado atual do email.';
      if (error.status === 429) return 'Foram efetuados demasiados pedidos. Tenta novamente dentro de alguns instantes.';
      if (error.status === 503) return 'O serviço de email está temporariamente indisponível. Tenta novamente mais tarde.';
      return `O pedido falhou (HTTP ${error.status}).`;
    }
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado. Tenta novamente.';
  }

  private readApiMessage(value: unknown): string | null {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const message = (value as Record<string, unknown>)['message'];
      return typeof message === 'string' && message.trim() ? message.trim() : null;
    }
    return null;
  }
}
