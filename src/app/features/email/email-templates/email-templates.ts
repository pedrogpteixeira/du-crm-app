import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { EmailTemplate, EmailTemplateDraft } from '../../../core/models/email-template.model';
import { EmailTemplateService } from '../../../core/services/email-template';
import { Auth } from '../../../core/services/auth';
import { ToastService } from '../../../core/services/toast';

@Component({
  selector: 'app-email-templates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './email-templates.html',
  styleUrl: './email-templates.scss',
})
export class EmailTemplates {
  private static readonly pageSize = 25;
  private readonly templateService = inject(EmailTemplateService);
  private readonly auth = inject(Auth);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private loadVersion = 0;

  readonly availableVariables = [
    '{{cliente.nome}}',
    '{{contrato.id}}',
    '{{contrato.estado}}',
    '{{comercializadora.nome}}',
    '{{utilizador.nome}}',
  ] as const;
  readonly bodyPlaceholder = 'Boa tarde {{cliente.nome}}, ...';

  templates: EmailTemplate[] = [];
  selectedId: string | null = null;
  isEditing = false;
  form: EmailTemplateDraft = this.emptyForm();
  offset = 0;
  total: number | null = null;
  hasMore = false;
  isLoading = false;
  isRefreshing = false;
  isSaving = false;
  isDeleting = false;
  loadError = '';

  constructor() {
    this.load();
  }

  get selectedTemplate(): EmailTemplate | null {
    return this.templates.find((item) => item.id === this.selectedId) ?? null;
  }

  get canManageSelected(): boolean {
    const template = this.selectedTemplate;
    if (!template || template.shared) return false;
    const currentUserId = this.auth.getCurrentUser()?.id ?? null;
    return !template.ownerId || !currentUserId || template.ownerId === currentUserId;
  }

  get hasPrevious(): boolean {
    return this.offset > 0;
  }

  get currentPage(): number {
    return Math.floor(this.offset / EmailTemplates.pageSize) + 1;
  }

  get totalLabel(): string {
    if (this.total === null) return `${this.templates.length} nesta página`;
    return `${this.total} ${this.total === 1 ? 'template' : 'templates'}`;
  }

  trackByTemplateId(_: number, template: EmailTemplate): string {
    return template.id;
  }

  trackByVariable(_: number, variable: string): string {
    return variable;
  }

  createNew(): void {
    this.selectedId = null;
    this.form = this.emptyForm();
    this.isEditing = true;
  }

  select(template: EmailTemplate): void {
    this.selectedId = template.id;
    this.form = this.toDraft(template);
    this.isEditing = false;
  }

  editSelected(): void {
    const template = this.selectedTemplate;
    if (!template || !this.canManageSelected) return;
    this.form = this.toDraft(template);
    this.isEditing = true;
  }

  cancelEdit(): void {
    const template = this.selectedTemplate;
    if (!template) {
      this.isEditing = false;
      this.form = this.emptyForm();
      return;
    }
    this.select(template);
  }

  save(): void {
    if (this.isSaving || !this.validate()) return;
    if (this.selectedId && !this.canManageSelected) {
      this.toast.warning('Este template é apenas de leitura e não pode ser alterado.');
      return;
    }
    const wasCreating = !this.selectedId;
    this.isSaving = true;
    const request = this.selectedId
      ? this.templateService.update(this.selectedId, this.form)
      : this.templateService.create(this.form);

    request
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (template) => {
          this.selectedId = template.id;
          this.isEditing = false;
          this.toast.success(wasCreating ? 'Template criado.' : 'Template guardado.');
          this.load(template.id);
        },
        error: (error: unknown) =>
          this.toast.error(this.errorMessage(error, 'Não foi possível guardar o template.')),
      });
  }

  toggleActive(): void {
    const template = this.selectedTemplate;
    if (!template || this.isSaving || !this.canManageSelected) return;
    this.isSaving = true;
    this.templateService
      .update(template.id, { ...this.toDraft(template), active: !template.active })
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.toast.success(updated.active ? 'Template ativado.' : 'Template desativado.');
          this.load(updated.id);
        },
        error: (error: unknown) =>
          this.toast.error(
            this.errorMessage(error, 'Não foi possível alterar o estado do template.'),
          ),
      });
  }

  remove(): void {
    const template = this.selectedTemplate;
    if (!template || this.isDeleting || !this.canManageSelected) return;
    this.isDeleting = true;
    this.templateService
      .remove(template.id)
      .pipe(
        finalize(() => {
          this.isDeleting = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.success('Template eliminado.');
          this.selectedId = null;
          this.isEditing = false;
          this.form = this.emptyForm();
          this.load();
        },
        error: (error: unknown) =>
          this.toast.error(this.errorMessage(error, 'Não foi possível eliminar o template.')),
      });
  }

  previous(): void {
    if (!this.hasPrevious || this.isLoading || this.isRefreshing) return;
    this.load(null, Math.max(0, this.offset - EmailTemplates.pageSize));
  }

  retryLoad(): void {
    if (!this.isLoading && !this.isRefreshing) this.load();
  }

  next(): void {
    if (!this.hasMore || this.isLoading || this.isRefreshing) return;
    this.load(null, this.offset + EmailTemplates.pageSize);
  }

  variables(template: EmailTemplate | null): string[] {
    return template
      ? this.templateService.unresolvedVariables(template.subject, template.body)
      : [];
  }

  private load(preferredId: string | null = null, requestedOffset = this.offset): void {
    const version = ++this.loadVersion;
    const hasExistingData = this.templates.length > 0;
    this.isLoading = !hasExistingData;
    this.isRefreshing = hasExistingData;
    this.loadError = '';
    this.templateService
      .list(requestedOffset, EmailTemplates.pageSize)
      .pipe(
        finalize(() => {
          if (version !== this.loadVersion) return;
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (page) => {
          if (version !== this.loadVersion) return;
          this.templates = page.items;
          this.offset = page.offset;
          this.total = page.total;
          this.hasMore = page.hasMore;
          const targetId = preferredId ?? this.selectedId;
          const selected = targetId
            ? (this.templates.find((item) => item.id === targetId) ?? null)
            : null;
          if (selected) this.select(selected);
          else if (this.selectedId && !this.isEditing) this.selectedId = null;
        },
        error: (error: unknown) => {
          if (version !== this.loadVersion) return;
          if (!hasExistingData) {
            this.templates = [];
            this.hasMore = false;
          }
          this.loadError = this.errorMessage(error, 'Não foi possível carregar os templates.');
        },
      });
  }

  private validate(): boolean {
    if (!this.form.name.trim()) {
      this.toast.warning('Indica um nome para o template.');
      return false;
    }
    if (!this.form.subject.trim() && !this.form.body.trim()) {
      this.toast.warning('O template deve ter assunto ou conteúdo.');
      return false;
    }
    const invalidVariables = this.templateService.invalidVariables(
      this.form.subject,
      this.form.body,
    );
    if (invalidVariables.length) {
      this.toast.warning(`Variáveis não suportadas: ${invalidVariables.join(', ')}`);
      return false;
    }
    return true;
  }

  private toDraft(template: EmailTemplate): EmailTemplateDraft {
    return {
      name: template.name,
      subject: template.subject,
      body: template.body,
      active: template.active,
      shared: false,
    };
  }

  private emptyForm(): EmailTemplateDraft {
    return { name: '', subject: '', body: '', active: true, shared: false };
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
