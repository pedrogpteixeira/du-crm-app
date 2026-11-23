import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  ContractObservationMessage,
  ContractObservationMessagesService,
  ObservationType,
} from '../../../core/services/contract-observation-messages';
import { Auth } from '../../../core/services/auth';
import { UserService } from '../../../core/services/user';
import { SocketService } from '../../../core/services/socket';
import {
  ObservationHistoryEntry,
  normalizeObservationDraft,
  parseObservationHistory,
} from '../../../core/utils/observation-history';
import {
  ObservationThreadEditRequest,
  ObservationThreadMessage,
} from './observation-thread-message';

const MESSAGE_EDIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 5000;

@Component({
  selector: 'app-observations-thread',
  imports: [CommonModule, FormsModule],
  templateUrl: './observations-thread.html',
  styleUrl: './observations-thread.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObservationsThread implements OnChanges, OnDestroy {
  private readonly observationMessagesService = inject(ContractObservationMessagesService);
  private readonly auth = inject(Auth);
  private readonly userService = inject(UserService);
  private readonly socketService = inject(SocketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() title = 'Observações';
  @Input() value: string | null | undefined = '';
  @Input() messages: ObservationThreadMessage[] | null = null;
  @Input() provider = '';
  @Input() contractId = '';
  @Input() draft = '';
  @Input() currentUserName = '';
  @Input() currentUserId = '';
  @Input() internal = false;
  @Input() canSubmit = false;
  @Input() isSubmitting = false;
  @Input() editingMessageId: string | null = null;
  @Input() deletingMessageId: string | null = null;
  @Input() placeholder = 'Escrever uma observação...';

  @Output() draftChange = new EventEmitter<string>();
  @Output() submitObservation = new EventEmitter<string>();
  @Output() editMessage = new EventEmitter<ObservationThreadEditRequest>();
  @Output() deleteMessage = new EventEmitter<string>();

  @ViewChild('threadBody') private threadBody?: ElementRef<HTMLDivElement>;

  legacyEntries: ObservationHistoryEntry[] = [];
  editingId: string | null = null;
  editDraft = '';
  confirmingDeleteId: string | null = null;
  apiMessages: ObservationThreadMessage[] = [];
  isLoadingMessages = false;
  messagesError = '';
  operationError = '';
  private apiSubmitting = false;
  private apiEditingMessageId: string | null = null;
  private apiDeletingMessageId: string | null = null;
  private authorNames = new Map<string, string>();
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private loadSequence = 0;
  private realtimeSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private realtimeSyncInFlight = false;
  private realtimeSyncQueued = false;

  constructor() {
    this.socketService
      .listenContractObservationMessage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (
          !this.usesApi ||
          event.provider !== this.provider ||
          event.contractId !== this.contractId ||
          event.type !== this.observationType
        ) {
          return;
        }

        this.scheduleRealtimeSync();
      });

    this.socketService
      .listenConnected()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.usesApi) {
          this.scheduleRealtimeSync();
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.legacyEntries = parseObservationHistory(this.value);
    }

    if (changes['provider'] || changes['contractId'] || changes['internal']) {
      this.loadApiMessages();
    }

    if (changes['value'] || changes['messages']) {
      queueMicrotask(() => this.scrollToLatest());
    }

    if (
      changes['messages'] &&
      this.editingId &&
      !this.effectiveMessages.some((message) => message.id === this.editingId && !message.deleted)
    ) {
      this.cancelEdit();
    }
  }

  ngOnDestroy(): void {
    this.clearExpiryTimer();
    this.clearRealtimeSyncTimer();
  }

  get usesApi(): boolean {
    return Boolean(this.provider.trim() && this.contractId.trim());
  }

  get hasApiMessages(): boolean {
    return this.usesApi || this.messages !== null;
  }

  get effectiveMessages(): ObservationThreadMessage[] {
    return this.usesApi ? this.apiMessages : (this.messages ?? []);
  }

  get visibleMessages(): ObservationThreadMessage[] {
    return this.effectiveMessages.filter((message) => !message.deleted);
  }

  get messageCount(): number {
    return this.legacyEntries.length + this.visibleMessages.length;
  }

  get effectiveCurrentUserId(): string {
    if (this.currentUserId) {
      return this.currentUserId;
    }

    const user = this.auth.getCurrentUser() as { id?: string; _id?: string } | null;
    return user?.id ?? user?._id ?? '';
  }

  get effectiveCurrentUserName(): string {
    if (this.currentUserName) {
      return this.currentUserName;
    }

    const user = this.auth.getCurrentUser() as { name?: string; username?: string } | null;
    return user?.name ?? user?.username ?? 'Utilizador';
  }

  get effectiveSubmitting(): boolean {
    return this.usesApi ? this.apiSubmitting : this.isSubmitting;
  }

  get effectiveEditingMessageId(): string | null {
    return this.usesApi ? this.apiEditingMessageId : this.editingMessageId;
  }

  get effectiveDeletingMessageId(): string | null {
    return this.usesApi ? this.apiDeletingMessageId : this.deletingMessageId;
  }

  get canSend(): boolean {
    const content = normalizeObservationDraft(this.draft);
    return (
      this.canSubmit &&
      !this.effectiveSubmitting &&
      !this.isLoadingMessages &&
      Boolean(content) &&
      content.length <= MAX_MESSAGE_LENGTH
    );
  }

  getInitials(author: string): string {
    const words = author
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    return words.map((word) => word.charAt(0).toUpperCase()).join('') || '•';
  }

  isOwnLegacyEntry(entry: ObservationHistoryEntry): boolean {
    const normalize = (value: string) =>
      value
        .trim()
        .toLocaleLowerCase('pt-PT')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    return Boolean(
      this.effectiveCurrentUserName &&
        entry.isStructured &&
        normalize(entry.author) === normalize(this.effectiveCurrentUserName),
    );
  }

  isOwnMessage(message: ObservationThreadMessage): boolean {
    return Boolean(
      this.effectiveCurrentUserId &&
        message.authorId &&
        this.effectiveCurrentUserId === message.authorId,
    );
  }

  canManageMessage(message: ObservationThreadMessage): boolean {
    if (!this.isOwnMessage(message) || message.deleted) {
      return false;
    }

    const createdAt = new Date(message.createdAt).getTime();
    const age = Date.now() - createdAt;

    return Number.isFinite(createdAt) && age >= 0 && age < MESSAGE_EDIT_WINDOW_MS;
  }

  isEdited(message: ObservationThreadMessage): boolean {
    return Boolean(message.editedAt);
  }

  formatDateTime(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  onDraftInput(value: string): void {
    this.draftChange.emit(value);
  }

  submit(): void {
    if (!this.canSend) {
      return;
    }

    const content = normalizeObservationDraft(this.draft);
    if (!content) {
      return;
    }

    if (!this.usesApi) {
      this.submitObservation.emit(content);
      return;
    }

    this.apiSubmitting = true;
    this.operationError = '';
    this.cdr.markForCheck();

    this.observationMessagesService
      .createMessage(this.provider, this.contractId, this.observationType, content)
      .pipe(
        finalize(() => {
          this.apiSubmitting = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ message }) => {
          const mapped = this.mapApiMessage(message);
          this.apiMessages = this.upsertMessage(this.apiMessages, mapped);
          this.resolveAuthorNames([message.authorId]);
          this.draft = '';
          this.draftChange.emit('');
          this.operationError = '';
          this.scheduleExpiryRefresh();
          queueMicrotask(() => this.scrollToLatest());
          this.cdr.markForCheck();
          this.scheduleRealtimeSync(80);
        },
        error: (error) => {
          this.operationError = this.resolveApiError(
            error,
            this.internal
              ? 'Não foi possível publicar a observação interna.'
              : 'Não foi possível publicar a observação.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  startEdit(message: ObservationThreadMessage): void {
    if (
      !this.canManageMessage(message) ||
      this.effectiveEditingMessageId ||
      this.effectiveDeletingMessageId
    ) {
      return;
    }

    this.confirmingDeleteId = null;
    this.editingId = message.id;
    this.editDraft = message.content;
    this.operationError = '';
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editDraft = '';
  }

  saveEdit(message: ObservationThreadMessage): void {
    const content = normalizeObservationDraft(this.editDraft);

    if (
      !content ||
      content.length > MAX_MESSAGE_LENGTH ||
      !this.canManageMessage(message) ||
      this.effectiveEditingMessageId
    ) {
      return;
    }

    if (!this.usesApi) {
      this.editMessage.emit({ id: message.id, content });
      return;
    }

    this.apiEditingMessageId = message.id;
    this.operationError = '';
    this.cdr.markForCheck();

    this.observationMessagesService
      .updateMessage(this.provider, this.contractId, this.observationType, message.id, content)
      .pipe(
        finalize(() => {
          this.apiEditingMessageId = null;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ message: updatedMessage }) => {
          this.apiMessages = this.upsertMessage(this.apiMessages, this.mapApiMessage(updatedMessage));
          this.cancelEdit();
          this.operationError = '';
          this.scheduleExpiryRefresh();
          this.cdr.markForCheck();
          this.scheduleRealtimeSync(80);
        },
        error: (error) => {
          this.operationError = this.resolveApiError(error, 'Não foi possível editar a mensagem.');
          this.cdr.markForCheck();
        },
      });
  }

  requestDelete(message: ObservationThreadMessage): void {
    if (
      !this.canManageMessage(message) ||
      this.effectiveEditingMessageId ||
      this.effectiveDeletingMessageId
    ) {
      return;
    }

    this.cancelEdit();
    this.confirmingDeleteId = message.id;
    this.operationError = '';
  }

  cancelDelete(): void {
    this.confirmingDeleteId = null;
  }

  confirmDelete(message: ObservationThreadMessage): void {
    if (!this.canManageMessage(message) || this.effectiveDeletingMessageId) {
      return;
    }

    if (!this.usesApi) {
      this.deleteMessage.emit(message.id);
      return;
    }

    this.apiDeletingMessageId = message.id;
    this.operationError = '';
    this.cdr.markForCheck();

    this.observationMessagesService
      .deleteMessage(this.provider, this.contractId, this.observationType, message.id)
      .pipe(
        finalize(() => {
          this.apiDeletingMessageId = null;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ deleted, messageId }) => {
          if (deleted) {
            this.apiMessages = this.apiMessages.filter((item) => item.id !== messageId);
          }
          this.confirmingDeleteId = null;
          this.operationError = '';
          this.scheduleExpiryRefresh();
          this.cdr.markForCheck();
          this.scheduleRealtimeSync(80);
        },
        error: (error) => {
          this.operationError = this.resolveApiError(error, 'Não foi possível eliminar a mensagem.');
          this.cdr.markForCheck();
        },
      });
  }

  retryLoad(): void {
    this.loadApiMessages();
  }

  private get observationType(): ObservationType {
    return this.internal ? 'internal' : 'normal';
  }

  private loadApiMessages(): void {
    this.clearExpiryTimer();
    this.cancelEdit();
    this.cancelDelete();
    this.operationError = '';

    if (!this.usesApi) {
      this.apiMessages = [];
      this.isLoadingMessages = false;
      this.messagesError = '';
      this.cdr.markForCheck();
      return;
    }

    const sequence = ++this.loadSequence;
    this.isLoadingMessages = true;
    this.messagesError = '';
    this.apiMessages = [];
    this.cdr.markForCheck();

    this.observationMessagesService
      .getMessages(this.provider, this.contractId, this.observationType)
      .pipe(
        finalize(() => {
          if (sequence === this.loadSequence) {
            this.isLoadingMessages = false;
            this.cdr.markForCheck();
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ messages }) => {
          if (sequence !== this.loadSequence) {
            return;
          }

          const validMessages = Array.isArray(messages) ? messages : [];
          this.apiMessages = validMessages.map((message) => this.mapApiMessage(message));
          this.resolveAuthorNames(validMessages.map((message) => message.authorId));
          this.scheduleExpiryRefresh();
          queueMicrotask(() => this.scrollToLatest());
          this.cdr.markForCheck();
        },
        error: (error) => {
          if (sequence !== this.loadSequence) {
            return;
          }

          this.messagesError = this.resolveApiError(
            error,
            this.internal
              ? 'Não foi possível carregar as observações internas.'
              : 'Não foi possível carregar as observações.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  private scheduleRealtimeSync(delay = 40): void {
    if (!this.usesApi) {
      return;
    }

    this.clearRealtimeSyncTimer();
    this.realtimeSyncTimer = setTimeout(() => {
      this.realtimeSyncTimer = null;
      this.syncApiMessages();
    }, delay);
  }

  private syncApiMessages(): void {
    if (!this.usesApi) {
      return;
    }

    if (this.realtimeSyncInFlight) {
      this.realtimeSyncQueued = true;
      return;
    }

    const provider = this.provider;
    const contractId = this.contractId;
    const type = this.observationType;

    this.realtimeSyncInFlight = true;

    this.observationMessagesService
      .getMessages(provider, contractId, type)
      .pipe(
        finalize(() => {
          this.realtimeSyncInFlight = false;
          if (this.realtimeSyncQueued) {
            this.realtimeSyncQueued = false;
            this.scheduleRealtimeSync(20);
          }
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ messages }) => {
          if (
            provider !== this.provider ||
            contractId !== this.contractId ||
            type !== this.observationType
          ) {
            return;
          }

          const validMessages = Array.isArray(messages) ? messages : [];
          this.apiMessages = validMessages.map((message) => this.mapApiMessage(message));
          this.resolveAuthorNames(validMessages.map((message) => message.authorId));
          this.messagesError = '';
          this.scheduleExpiryRefresh();
          queueMicrotask(() => this.scrollToLatest());
          this.cdr.markForCheck();
        },
        error: (error) => {
          if (error?.status === 403 && this.internal) {
            this.apiMessages = [];
          }
          // Uma falha numa sincronização em tempo real não apaga o estado já confirmado por HTTP.
        },
      });
  }

  private clearRealtimeSyncTimer(): void {
    if (this.realtimeSyncTimer) {
      clearTimeout(this.realtimeSyncTimer);
      this.realtimeSyncTimer = null;
    }
  }

  private mapApiMessage(message: ContractObservationMessage): ObservationThreadMessage {
    return {
      id: message.domainId,
      authorId: message.authorId,
      authorName: this.resolveAuthorName(message.authorId),
      content: message.content,
      createdAt: message.createdAt,
      editedAt: message.editedAt ?? null,
      deleted: Boolean(message.deletedAt),
    };
  }

  private upsertMessage(
    messages: ObservationThreadMessage[],
    nextMessage: ObservationThreadMessage,
  ): ObservationThreadMessage[] {
    const index = messages.findIndex((message) => message.id === nextMessage.id);
    const next = [...messages];

    if (index >= 0) {
      next[index] = nextMessage;
    } else {
      next.push(nextMessage);
    }

    return next.sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() ||
        left.id.localeCompare(right.id),
    );
  }

  private resolveAuthorNames(authorIds: string[]): void {
    const uniqueIds = [...new Set(authorIds.filter(Boolean))];
    if (!uniqueIds.length) {
      return;
    }

    const currentUserId = this.effectiveCurrentUserId;
    if (currentUserId) {
      this.authorNames.set(currentUserId, this.effectiveCurrentUserName);
    }

    const cachedUsers = [
      ...this.userService.getAssignableUsersSnapshot(),
      ...this.userService.getUsersSnapshot(),
    ];

    for (const user of cachedUsers) {
      if (user?.id) {
        this.authorNames.set(user.id, user.name || user.username || 'Utilizador');
      }
    }

    this.refreshAuthorNamesInMessages();

    this.userService
      .getAssignableUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          for (const user of users) {
            if (user?.id) {
              this.authorNames.set(user.id, user.name || user.username || 'Utilizador');
            }
          }
          this.refreshAuthorNamesInMessages();
          this.cdr.markForCheck();
        },
        error: () => {
          // A identificação do autor degrada de forma segura para "Utilizador".
        },
      });
  }

  private refreshAuthorNamesInMessages(): void {
    this.apiMessages = this.apiMessages.map((message) => ({
      ...message,
      authorName: message.authorId ? this.resolveAuthorName(message.authorId) : 'Utilizador',
    }));
  }

  private resolveAuthorName(authorId: string): string {
    if (authorId === this.effectiveCurrentUserId) {
      return this.effectiveCurrentUserName;
    }

    return this.authorNames.get(authorId) ?? 'Utilizador';
  }

  private scheduleExpiryRefresh(): void {
    this.clearExpiryTimer();

    const now = Date.now();
    const expirations = this.apiMessages
      .filter((message) => this.isOwnMessage(message) && !message.deleted)
      .map((message) => new Date(message.createdAt).getTime() + MESSAGE_EDIT_WINDOW_MS)
      .filter((expiry) => Number.isFinite(expiry) && expiry > now)
      .sort((a, b) => a - b);

    if (!expirations.length) {
      return;
    }

    const delay = Math.min(Math.max(expirations[0] - now + 50, 50), 2_147_483_647);
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null;
      this.cdr.markForCheck();
      this.scheduleExpiryRefresh();
    }, delay);
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private resolveApiError(error: any, fallback: string): string {
    const backendMessage = error?.error?.message;
    if (typeof backendMessage === 'string' && backendMessage.trim()) {
      return backendMessage.trim();
    }

    if (error?.status === 403) {
      return 'Não tem permissão para realizar esta operação ou o prazo de uma hora expirou.';
    }

    if (error?.status === 409) {
      return 'A mensagem foi alterada, eliminada ou deixou de poder ser modificada.';
    }

    return fallback;
  }

  private scrollToLatest(): void {
    const element = this.threadBody?.nativeElement;

    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }
}
