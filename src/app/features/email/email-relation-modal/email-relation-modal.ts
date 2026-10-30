import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  debounceTime,
  finalize,
  map,
  Observable,
  of,
  switchMap,
} from 'rxjs';

import { getContractDetailRouteByProvider } from '../../../core/config/contract-detail-route';
import {
  EmailCrmRelation,
  EmailEntitySearchResult,
  EmailRelationEntityType,
} from '../../../core/models/email-relation.model';
import { EmailCrmRelationService } from '../../../core/services/email-crm-relation';
import { ToastService } from '../../../core/services/toast';

@Component({
  selector: 'app-email-relation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './email-relation-modal.html',
  styleUrl: './email-relation-modal.scss',
})
export class EmailRelationModal implements OnChanges {
  private readonly relationService = inject(EmailCrmRelationService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly search$ = new BehaviorSubject<string>('');
  private searchVersion = 0;
  private relationsLoadVersion = 0;

  @Input({ required: true }) accountId = '';
  @Input({ required: true }) messageId = '';
  @Output() closed = new EventEmitter<void>();
  @Output() relationsChanged = new EventEmitter<void>();

  entityType: EmailRelationEntityType = 'contract';
  query = '';
  relations: EmailCrmRelation[] = [];
  results: EmailEntitySearchResult[] = [];
  isLoadingRelations = false;
  isSearching = false;
  searchError = '';
  relationsError = '';
  creatingKey: string | null = null;
  deletingId: string | null = null;
  pendingDeleteId: string | null = null;

  constructor() {
    this.bindSearch();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.deletingId && !this.creatingKey) this.closed.emit();
  }

  trackByRelationId(_: number, relation: EmailCrmRelation): string {
    return relation.id;
  }

  trackBySearchResult(_: number, result: EmailEntitySearchResult): string {
    return this.resultKey(result);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['accountId'] || changes['messageId']) && this.accountId && this.messageId) {
      this.loadRelations();
    }
  }

  setEntityType(type: EmailRelationEntityType): void {
    if (this.entityType === type) return;
    this.entityType = type;
    this.results = [];
    this.searchError = '';
    this.searchVersion++;
    this.search$.next(this.query.trim());
  }

  onQueryChange(value: string): void {
    this.query = value;
    this.search$.next(value.trim());
  }

  relationExists(result: EmailEntitySearchResult): boolean {
    return this.relations.some(
      (relation) =>
        relation.entityType === result.entityType &&
        relation.entityId === result.entityId &&
        (result.entityType !== 'contract' || relation.provider === result.provider),
    );
  }

  addRelation(result: EmailEntitySearchResult): void {
    if (this.relationExists(result) || this.creatingKey) return;
    const key = this.resultKey(result);
    this.creatingKey = key;
    this.relationService
      .createRelation({
        accountId: this.accountId,
        messageId: this.messageId,
        entityType: result.entityType,
        entityId: result.entityId,
        ...(result.entityType === 'contract' ? { provider: result.provider } : {}),
      })
      .pipe(
        finalize(() => (this.creatingKey = null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (relation) => {
          this.relations = [relation, ...this.relations.filter((item) => item.id !== relation.id)];
          this.toast.success(
            result.entityType === 'contract'
              ? 'Email associado ao contrato.'
              : 'Email associado ao ticket.',
          );
          this.relationsChanged.emit();
        },
        error: (error: unknown) => {
          const status = this.httpStatus(error);
          if (status === 409) {
            this.toast.info(
              this.errorMessage(error, 'Este email já está associado a esse registo.'),
            );
            this.loadRelations();
            return;
          }
          this.toast.error(this.errorMessage(error, 'Não foi possível criar a associação.'));
        },
      });
  }

  askRemove(relationId: string): void {
    this.pendingDeleteId = relationId;
  }

  cancelRemove(): void {
    this.pendingDeleteId = null;
  }

  removeRelation(relation: EmailCrmRelation): void {
    if (this.deletingId) return;
    this.deletingId = relation.id;
    this.relationService
      .deleteRelation(relation.id)
      .pipe(
        finalize(() => {
          this.deletingId = null;
          this.pendingDeleteId = null;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.relations = this.relations.filter((item) => item.id !== relation.id);
          this.toast.success('Associação removida.');
          this.relationsChanged.emit();
        },
        error: (error: unknown) =>
          this.toast.error(this.errorMessage(error, 'Não foi possível remover a associação.')),
      });
  }

  openRelation(relation: EmailCrmRelation): void {
    if (relation.entityType === 'ticket') {
      void this.router.navigate(['/home/tickets', relation.entityId]);
      this.closed.emit();
      return;
    }
    if (!relation.provider) return;
    const route = getContractDetailRouteByProvider(relation.provider, relation.entityId);
    if (route) {
      void this.router.navigate(route);
      this.closed.emit();
    }
  }

  ticketType(result: EmailEntitySearchResult): string | null {
    return result.entityType === 'ticket' ? result.tipo : null;
  }

  ticketPriority(result: EmailEntitySearchResult): string | null {
    return result.entityType === 'ticket' ? result.prioridade : null;
  }

  resultKey(result: EmailEntitySearchResult): string {
    return result.entityType === 'contract'
      ? `${result.entityType}:${result.provider}:${result.entityId}`
      : `${result.entityType}:${result.entityId}`;
  }

  retryLoadRelations(): void {
    if (!this.isLoadingRelations) this.loadRelations();
  }

  private bindSearch(): void {
    this.search$
      .pipe(
        debounceTime(300),
        switchMap((query) => {
          const version = ++this.searchVersion;
          this.searchError = '';
          if (query.length < 2) {
            this.isSearching = false;
            return of([] as EmailEntitySearchResult[]);
          }
          this.isSearching = true;
          const request: Observable<EmailEntitySearchResult[]> =
            this.entityType === 'contract'
              ? this.relationService
                  .searchContracts(query)
                  .pipe(map((items) => items as EmailEntitySearchResult[]))
              : this.relationService
                  .searchTickets(query)
                  .pipe(map((items) => items as EmailEntitySearchResult[]));
          return request.pipe(
            catchError((error: unknown) => {
              if (version === this.searchVersion)
                this.searchError = this.errorMessage(error, 'Não foi possível pesquisar no CRM.');
              return of([] as EmailEntitySearchResult[]);
            }),
            finalize(() => {
              if (version === this.searchVersion) this.isSearching = false;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((results) => (this.results = results));
  }

  private loadRelations(): void {
    const version = ++this.relationsLoadVersion;
    const accountId = this.accountId;
    const messageId = this.messageId;
    this.relationsError = '';
    this.isLoadingRelations = true;
    this.relationService
      .getMessageRelations(accountId, messageId)
      .pipe(
        finalize(() => {
          if (version === this.relationsLoadVersion) this.isLoadingRelations = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (relations) => {
          if (
            version === this.relationsLoadVersion &&
            this.accountId === accountId &&
            this.messageId === messageId
          )
            this.relations = relations;
        },
        error: (error: unknown) => {
          if (version !== this.relationsLoadVersion) return;
          this.relationsError = this.errorMessage(
            error,
            'Não foi possível consultar as associações deste email.',
          );
          this.toast.error(this.relationsError);
        },
      });
  }

  private httpStatus(error: unknown): number | null {
    if (!error || typeof error !== 'object') return null;
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : null;
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
