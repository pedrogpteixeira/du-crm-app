import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, concatMap, debounceTime, EMPTY, finalize, Observable, of, Subject, switchMap, tap } from 'rxjs';

import {
  EmailAccountSummary,
  EmailComposePayload,
  EmailDraftAttachment,
  EmailDraftSummary,
  EmailMessageDetail,
  EmailSendResult,
} from '../../../core/models/email.model';
import { EmailTemplate } from '../../../core/models/email-template.model';
import { EmailService } from '../../../core/services/email';
import { EmailTemplateService } from '../../../core/services/email-template';
import { ToastService } from '../../../core/services/toast';

export type EmailComposerMode = 'new' | 'reply' | 'replyAll' | 'forward' | 'draft';

export interface EmailComposerSentEvent {
  accountId: string;
  result: EmailSendResult;
}

@Component({
  selector: 'app-email-composer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './email-composer.html',
  styleUrl: './email-composer.scss',
})
export class EmailComposer implements OnChanges {
  private static readonly maxFiles = 5;
  private static readonly maxFileBytes = 5 * 1024 * 1024;
  private static readonly maxTotalBytes = 6 * 1024 * 1024;

  private readonly emailService = inject(EmailService);
  private readonly toast = inject(ToastService);
  private readonly templateService = inject(EmailTemplateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly autosaveChanges$ = new Subject<void>();

  @Input({ required: true }) accounts: EmailAccountSummary[] = [];
  @Input() selectedAccountId: string | null = null;
  @Input() mode: EmailComposerMode = 'new';
  @Input() sourceMessage: EmailMessageDetail | null = null;
  @Input() draft: EmailDraftSummary | null = null;
  @Input() initialTo = '';
  @Output() closed = new EventEmitter<void>();
  @Output() sent = new EventEmitter<EmailComposerSentEvent>();
  @Output() draftChanged = new EventEmitter<void>();

  accountId = '';
  to = '';
  cc = '';
  bcc = '';
  subject = '';
  text = '';
  files: File[] = [];
  persistedAttachments: EmailDraftAttachment[] = [];
  templates: EmailTemplate[] = [];
  draftId: string | null = null;
  isSending = false;
  isSavingDraft = false;
  isDeletingDraft = false;
  isLoadingDraftAttachments = false;
  isLoadingTemplates = false;
  uploadingAttachments = false;
  deletingAttachmentId: string | null = null;
  downloadingAttachmentId: string | null = null;
  showCc = false;
  showBcc = false;
  autosaveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error' = 'idle';
  autosaveError: string | null = null;
  private lastSavedDraftSignature = '';

  constructor() {
    this.loadTemplates();
    this.autosaveChanges$.pipe(
      debounceTime(900),
      concatMap(() => this.runAutosave()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedAccountId'] || changes['accounts']) this.accountId = this.resolveAccountId();
    if (changes['draft']) this.applyDraft();
    if ((changes['sourceMessage'] || changes['mode']) && this.mode !== 'draft') this.applySourceMessage();
    if (changes['initialTo'] && this.mode === 'new' && !this.to.trim()) this.to = this.initialTo.trim();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.isBusy) this.closed.emit();
  }

  get isBusy(): boolean {
    return this.isSending || this.isSavingDraft || this.isDeletingDraft || this.uploadingAttachments;
  }

  get canPersistDraft(): boolean {
    return this.mode === 'new' || this.mode === 'draft';
  }

  get isThreadedMode(): boolean {
    return this.mode === 'reply' || this.mode === 'replyAll' || this.mode === 'forward';
  }

  get activeTemplates(): EmailTemplate[] {
    return this.templates.filter((item) => item.active);
  }

  get availableAccounts(): EmailAccountSummary[] {
    return this.accounts.filter((account) => account.isActive && account.permissions.canSend);
  }

  get selectedAccount(): EmailAccountSummary | null {
    return this.accounts.find((account) => account.id === this.accountId) ?? null;
  }

  get totalAttachmentBytes(): number {
    return this.files.reduce((total, file) => total + file.size, 0) + this.persistedAttachments.reduce((total, file) => total + file.size, 0);
  }

  trackByAccountId(_: number, account: EmailAccountSummary): string { return account.id; }
  trackByTemplateId(_: number, template: EmailTemplate): string { return template.id; }
  trackByFile(index: number, file: File): string { return `${file.name}:${file.size}:${file.lastModified}:${index}`; }
  trackByPersistedAttachment(_: number, attachment: EmailDraftAttachment): string { return attachment.id; }

  applyTemplate(templateId: string): void {
    const template = this.activeTemplates.find((item) => item.id === templateId);
    if (!template) return;
    this.subject = template.subject;
    this.text = template.body;
    const unresolved = this.templateService.unresolvedVariables(this.subject, this.text);
    if (unresolved.length) this.toast.info(`Template aplicado. Revê as variáveis por resolver antes de enviar: ${unresolved.join(', ')}`);
    else this.toast.success('Template aplicado.');
    this.onDraftFieldChanged();
  }

  onFilesSelected(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files) return;
    const incoming = Array.from(input.files);
    input.value = '';

    const existingKeys = new Set([
      ...this.files.map((file) => `${file.name}:${file.size}`),
      ...this.persistedAttachments.map((file) => `${file.filename}:${file.size}`),
    ]);
    const uniqueIncoming = incoming.filter((file) => !existingKeys.has(`${file.name}:${file.size}`));
    if (uniqueIncoming.length !== incoming.length) this.toast.info('Alguns anexos duplicados foram ignorados.');

    const next = [...this.files, ...uniqueIncoming];
    if (next.length + this.persistedAttachments.length > EmailComposer.maxFiles) {
      this.toast.warning(`Podes anexar no máximo ${EmailComposer.maxFiles} ficheiros.`);
      return;
    }
    const oversized = uniqueIncoming.find((file) => file.size > EmailComposer.maxFileBytes);
    if (oversized) {
      this.toast.warning(`${oversized.name} excede o limite de 5 MB por anexo.`);
      return;
    }
    const total = next.reduce((sum, file) => sum + file.size, 0) + this.persistedAttachments.reduce((sum, file) => sum + file.size, 0);
    if (total > EmailComposer.maxTotalBytes) {
      this.toast.warning('O conjunto dos anexos não pode exceder 6 MB.');
      return;
    }
    this.files = next;
    this.onDraftFieldChanged();
  }

  removeFile(index: number): void {
    this.files = this.files.filter((_, itemIndex) => itemIndex !== index);
    this.onDraftFieldChanged();
  }

  onDraftFieldChanged(): void {
    if (!this.canPersistDraft || this.isDeletingDraft || this.isSending) return;
    this.autosaveState = 'dirty';
    this.autosaveError = null;
    this.autosaveChanges$.next();
  }

  removePersistedAttachment(attachment: EmailDraftAttachment): void {
    if (!this.draftId || !this.accountId || this.deletingAttachmentId) return;
    this.deletingAttachmentId = attachment.id;
    this.emailService.deleteDraftAttachment(this.accountId, this.draftId, attachment.id).pipe(
      finalize(() => (this.deletingAttachmentId = null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.persistedAttachments = this.persistedAttachments.filter((item) => item.id !== attachment.id);
        this.draftChanged.emit();
        this.toast.success('Anexo removido do rascunho.');
      },
      error: (error: unknown) => this.toast.error(this.errorMessage(error, 'Não foi possível remover o anexo.')),
    });
  }

  downloadPersistedAttachment(attachment: EmailDraftAttachment): void {
    if (!this.draftId || !this.accountId || this.downloadingAttachmentId) return;
    this.downloadingAttachmentId = attachment.id;
    this.emailService.downloadDraftAttachment(this.accountId, this.draftId, attachment.id).pipe(
      finalize(() => (this.downloadingAttachmentId = null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (blob) => this.saveBlob(blob, attachment.filename),
      error: (error: unknown) => this.toast.error(this.errorMessage(error, 'Não foi possível descarregar o anexo.')),
    });
  }

  send(): void {
    if (this.isSending || !this.validate()) return;
    const account = this.selectedAccount;
    if (!account?.permissions.canSend || !account.isActive) {
      this.toast.error('A conta selecionada não permite enviar emails.');
      return;
    }

    this.isSending = true;
    const request = this.draftId
      ? this.persistDraft(true)
      : this.files.length
        ? this.emailService.sendMessageWithAttachments(account.id, this.buildPayload(), this.files)
        : this.emailService.sendMessage(account.id, this.buildPayload());

    request.pipe(
      finalize(() => (this.isSending = false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (result) => {
        if (result.savedToWebmail === false) this.toast.warning('Email enviado com sucesso, mas a cópia não foi guardada na pasta Enviados do webmail.');
        else this.toast.success('Email enviado com sucesso.');

        if (result.persisted === false) {
          this.toast.warning('O envio foi aceite, mas o backend não confirmou a persistência da mensagem no CRM.');
        }
        if ((result.rejected ?? 0) > 0) {
          this.toast.warning(`${result.rejected} destinatário(s) foram rejeitados pelo servidor SMTP.`);
        }

        if (this.draftId && result.draftRemoved === false) {
          this.toast.warning('O email foi enviado, mas o backend indicou que o rascunho não foi removido.');
        }
        this.files = [];
        if (!this.draftId || result.draftRemoved !== false) {
          this.persistedAttachments = [];
          this.draftId = null;
        }
        this.sent.emit({ accountId: account.id, result });
        this.draftChanged.emit();
      },
      error: (error: unknown) => this.toast.error(this.errorMessage(error, 'Não foi possível enviar o email. Não voltaremos a tentar automaticamente.')),
    });
  }

  saveDraft(): void {
    if (!this.canPersistDraft) {
      this.toast.info('O backend não persiste o contexto de threading em rascunhos de respostas ou reencaminhamentos.');
      return;
    }
    if (this.isSavingDraft || !this.accountId || (!this.draftId && !this.hasDraftContent())) {
      if (!this.draftId && !this.hasDraftContent()) this.toast.info('Escreve algum conteúdo antes de guardar o rascunho.');
      return;
    }
    const account = this.selectedAccount;
    if (!account?.permissions.canSend || !account.isActive) {
      this.toast.error('A conta selecionada não permite guardar este rascunho.');
      return;
    }
    const contentSignature = this.draftContentSignature();
    const signature = this.composeDraftSignature(contentSignature, this.pendingFilesSignature());
    this.isSavingDraft = true;
    this.autosaveState = 'saving';
    this.autosaveError = null;
    this.persistDraft(false).pipe(
      finalize(() => (this.isSavingDraft = false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        const savedSignature = this.composeDraftSignature(contentSignature, '');
        this.lastSavedDraftSignature = savedSignature;
        this.autosaveState = this.draftSignature() === savedSignature ? 'saved' : 'dirty';
        this.toast.success('Rascunho guardado.');
        this.draftChanged.emit();
      },
      error: (error: unknown) => {
        this.autosaveState = 'error';
        this.autosaveError = this.errorMessage(error, 'Não foi possível guardar o rascunho.');
        this.toast.error(this.autosaveError);
      },
    });
  }

  deleteDraft(): void {
    if (!this.draftId || !this.accountId || this.isDeletingDraft) return;
    this.isDeletingDraft = true;
    this.emailService.deleteDraft(this.accountId, this.draftId).pipe(
      finalize(() => (this.isDeletingDraft = false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.toast.success('Rascunho eliminado.');
        this.draftId = null;
        this.persistedAttachments = [];
        this.files = [];
        this.draftChanged.emit();
        this.closed.emit();
      },
      error: (error: unknown) => this.toast.error(this.errorMessage(error, 'Não foi possível eliminar o rascunho.')),
    });
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private persistDraft(sendAfterSave: boolean): Observable<EmailSendResult> {
    const account = this.selectedAccount;
    if (!account) throw new Error('Conta de email indisponível.');
    const payload = this.buildPayload();
    const saveRequest = this.draftId
      ? this.emailService.updateDraft(account.id, this.draftId, payload)
      : this.emailService.createDraft(account.id, payload);

    return saveRequest.pipe(
      tap((result) => {
        if (result.id) this.draftId = result.id;
        if (!this.draftId) throw new Error('A API não devolveu o identificador do rascunho.');
      }),
      switchMap(() => this.uploadPendingAttachments()),
      switchMap(() => {
        const draftId = this.draftId;
        if (sendAfterSave && draftId) return this.emailService.sendDraft(account.id, draftId);
        return of<EmailSendResult>({
          id: null,
          messageId: null,
          mimeMessageId: null,
          accepted: null,
          rejected: null,
          savedToWebmail: null,
          persisted: null,
          draftRemoved: null,
        });
      }),
    );
  }

  private uploadPendingAttachments(): Observable<EmailDraftAttachment[]> {
    if (!this.files.length || !this.draftId || !this.accountId) return of(this.persistedAttachments);
    this.uploadingAttachments = true;
    const files = [...this.files];
    return this.emailService.uploadDraftAttachments(this.accountId, this.draftId, files).pipe(
      tap((uploaded) => {
        if (uploaded.length) {
          const existingIds = new Set(this.persistedAttachments.map((item) => item.id));
          this.persistedAttachments = [
            ...this.persistedAttachments,
            ...uploaded.filter((item) => !existingIds.has(item.id)),
          ];
        }
        this.files = [];
      }),
      finalize(() => (this.uploadingAttachments = false)),
    );
  }

  private runAutosave(): Observable<EmailSendResult> {
    if (!this.canPersistDraft || this.isBusy || !this.accountId) return EMPTY;
    if (!this.draftId && !this.hasDraftContent()) {
      this.autosaveState = 'idle';
      return EMPTY;
    }
    const account = this.selectedAccount;
    if (!account?.isActive || !account.permissions.canSend) return EMPTY;

    const contentSignature = this.draftContentSignature();
    const signature = this.composeDraftSignature(contentSignature, this.pendingFilesSignature());
    if (signature === this.lastSavedDraftSignature && !this.files.length) {
      this.autosaveState = 'saved';
      return EMPTY;
    }

    this.isSavingDraft = true;
    this.autosaveState = 'saving';
    this.autosaveError = null;
    return this.persistDraft(false).pipe(
      tap(() => {
        const savedSignature = this.composeDraftSignature(contentSignature, '');
        this.lastSavedDraftSignature = savedSignature;
        this.autosaveState = this.draftSignature() === savedSignature ? 'saved' : 'dirty';
        this.draftChanged.emit();
      }),
      catchError((error: unknown) => {
        this.autosaveState = 'error';
        this.autosaveError = this.errorMessage(error, 'Não foi possível guardar automaticamente o rascunho.');
        return EMPTY;
      }),
      finalize(() => (this.isSavingDraft = false)),
    );
  }

  private loadTemplates(): void {
    this.isLoadingTemplates = true;
    this.templateService.list(0, 100).pipe(
      finalize(() => (this.isLoadingTemplates = false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({ next: (page) => (this.templates = page.items), error: () => (this.templates = []) });
  }

  private applyDraft(): void {
    if (!this.draft) return;
    this.mode = 'draft';
    this.draftId = this.draft.id;
    this.accountId = this.draft.accountId || this.selectedAccountId || this.resolveAccountId();
    this.to = this.draft.to.join(', ');
    this.cc = this.draft.cc.join(', ');
    this.bcc = this.draft.bcc.join(', ');
    this.subject = this.draft.subject;
    this.text = this.draft.text;
    this.showCc = Boolean(this.cc);
    this.showBcc = Boolean(this.bcc);
    this.files = [];
    this.lastSavedDraftSignature = this.draftSignature();
    this.autosaveState = 'saved';
    this.autosaveError = null;
    this.loadDraftAttachments();
  }

  private loadDraftAttachments(): void {
    if (!this.draftId || !this.accountId) return;
    this.isLoadingDraftAttachments = true;
    this.emailService.getDraftAttachments(this.accountId, this.draftId).pipe(
      finalize(() => (this.isLoadingDraftAttachments = false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (items) => (this.persistedAttachments = items),
      error: (error: unknown) => this.toast.error(this.errorMessage(error, 'Não foi possível carregar os anexos do rascunho.')),
    });
  }

  private resolveAccountId(): string {
    const preferred = this.accounts.find((account) => account.id === this.selectedAccountId && account.isActive && account.permissions.canSend);
    return preferred?.id ?? this.availableAccounts[0]?.id ?? '';
  }

  private applySourceMessage(): void {
    const message = this.sourceMessage;
    if (!message || this.mode === 'new' || this.mode === 'draft') return;
    const accountAddress = (this.selectedAccount?.address ?? '').trim().toLowerCase();
    const fromAddress = (message.from?.address ?? '').trim();

    if (this.mode === 'reply' || this.mode === 'replyAll') {
      const originalRecipients = this.uniqueAddresses(message.to.map((item) => item.address));
      const primaryReply = fromAddress && fromAddress.toLowerCase() !== accountAddress
        ? fromAddress
        : originalRecipients.find((address) => address.toLowerCase() !== accountAddress) ?? '';
      this.to = primaryReply;
      if (this.mode === 'replyAll') {
        const all = this.uniqueAddresses([fromAddress, ...message.to.map((item) => item.address), ...message.cc.map((item) => item.address)])
          .filter((address) => address.toLowerCase() !== accountAddress && address.toLowerCase() !== primaryReply.toLowerCase());
        this.cc = all.join(', ');
        this.showCc = Boolean(this.cc);
      }
      this.subject = this.withPrefix(message.subject, 'Re:');
    } else if (this.mode === 'forward') {
      this.subject = this.withPrefix(message.subject, 'Fwd:');
      const original = message.text?.trim();
      if (original) this.text = `\n\n---------- Mensagem reencaminhada ----------\nDe: ${message.from?.address ?? '—'}\nData: ${message.date ?? '—'}\nAssunto: ${message.subject}\nPara: ${message.to.map((item) => item.address).join(', ')}\n\n${original}`;
    }
  }

  private withPrefix(subject: string, prefix: string): string {
    return subject.toLowerCase().startsWith(prefix.toLowerCase()) ? subject : `${prefix} ${subject}`;
  }

  private buildPayload(): EmailComposePayload {
    const payload: EmailComposePayload = {
      to: this.parseAddresses(this.to),
      cc: this.parseAddresses(this.cc),
      bcc: this.parseAddresses(this.bcc),
      subject: this.subject.trim(),
      text: this.text,
    };
    const replyToMessageId = this.sourceMessage?.id && (this.mode === 'reply' || this.mode === 'replyAll')
      ? this.sourceMessage.id
      : null;
    const forwardMessageId = this.sourceMessage?.id && this.mode === 'forward'
      ? this.sourceMessage.id
      : null;
    if (replyToMessageId) payload.replyToMessageId = replyToMessageId;
    if (forwardMessageId) payload.forwardMessageId = forwardMessageId;
    return payload;
  }

  private parseAddresses(value: string): string[] {
    return value.split(/[;,\n]+/).map((item) => item.trim()).filter(Boolean);
  }

  private validate(): boolean {
    if (!this.accountId) {
      this.toast.error('Não existe uma conta com permissão de envio disponível.');
      return false;
    }
    const unresolved = this.templateService.unresolvedVariables(this.subject, this.text);
    if (unresolved.length) {
      this.toast.warning(`Existem variáveis por resolver antes do envio: ${unresolved.join(', ')}`);
      return false;
    }
    const to = this.parseAddresses(this.to);
    const cc = this.parseAddresses(this.cc);
    const bcc = this.parseAddresses(this.bcc);
    if (!to.length) {
      this.toast.warning('Indica pelo menos um destinatário no campo Para.');
      return false;
    }
    if (to.length > 30 || cc.length > 30 || bcc.length > 30) {
      this.toast.warning('Cada campo de destinatários aceita no máximo 30 endereços.');
      return false;
    }
    const recipients = [...to, ...cc, ...bcc];
    const invalid = recipients.find((value) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
    if (invalid) {
      this.toast.warning(`O endereço “${invalid}” não é válido.`);
      return false;
    }
    if (this.subject.trim().length > 998) {
      this.toast.warning('O assunto não pode exceder 998 caracteres.');
      return false;
    }
    if (!this.text.trim()) {
      this.toast.warning('Escreve o conteúdo da mensagem antes de enviar.');
      return false;
    }
    if (this.text.length > 200000) {
      this.toast.warning('O corpo da mensagem excede o limite de 200 000 caracteres.');
      return false;
    }
    return true;
  }

  private uniqueAddresses(addresses: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of addresses) {
      const address = raw.trim();
      if (!address) continue;
      const key = address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(address);
    }
    return result;
  }

  private draftSignature(): string {
    return this.composeDraftSignature(this.draftContentSignature(), this.pendingFilesSignature());
  }

  private draftContentSignature(): string {
    return JSON.stringify({
      accountId: this.accountId,
      to: this.parseAddresses(this.to),
      cc: this.parseAddresses(this.cc),
      bcc: this.parseAddresses(this.bcc),
      subject: this.subject,
      text: this.text,
    });
  }

  private pendingFilesSignature(): string {
    return this.files.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join('|');
  }

  private composeDraftSignature(contentSignature: string, pendingFiles: string): string {
    return `${contentSignature}::${pendingFiles}`;
  }

  private hasDraftContent(): boolean {
    return Boolean(this.to.trim() || this.cc.trim() || this.bcc.trim() || this.subject.trim() || this.text.trim() || this.files.length || this.persistedAttachments.length);
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

  private errorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object') {
      const maybeError = error as { error?: unknown; message?: unknown };
      if (typeof maybeError.message === 'string' && maybeError.message.trim()) return maybeError.message.trim();
      if (maybeError.error && typeof maybeError.error === 'object') {
        const message = (maybeError.error as Record<string, unknown>)['message'];
        if (typeof message === 'string' && message.trim()) return message.trim();
      }
    }
    return fallback;
  }
}
