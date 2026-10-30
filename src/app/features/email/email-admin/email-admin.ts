import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import {
  CreateEmailAccountPayload,
  EmailAccountUserAccess,
  EmailAdminAccount,
  EmailConnectionTestResult,
} from '../../../core/models/email-admin.model';
import { EmailAdminService } from '../../../core/services/email-admin';
import { ToastService } from '../../../core/services/toast';
import { ProfileUser, UserService } from '../../../core/services/user';

interface AccountForm {
  address: string;
  displayName: string;
  imapHost: string;
  smtpHost: string;
  username: string;
  password: string;
}

@Component({
  selector: 'app-email-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './email-admin.html',
  styleUrl: './email-admin.scss',
})
export class EmailAdmin {
  private readonly adminService = inject(EmailAdminService);
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private accountUsersLoadVersion = 0;

  accounts: EmailAdminAccount[] = [];
  users: ProfileUser[] = [];
  accountUsers: EmailAccountUserAccess[] = [];
  selectedAccount: EmailAdminAccount | null = null;
  selectedUserId = '';
  editDisplayName = '';
  newPassword = '';
  createOpen = false;
  isLoading = true;
  accountsLoadError = '';
  isLoadingUsers = false;
  accountUsersLoadError = '';
  isSaving = false;
  isTesting = false;
  connectionTest: EmailConnectionTestResult | null = null;
  connectionTestError = '';
  isSavingAccess = false;
  removingUserId: string | null = null;

  form: AccountForm = this.emptyForm();
  access = { canRead: true, canSend: false, canManageMessages: false };
  savedAccess: { canRead: boolean; canSend: boolean; canManageMessages: boolean } | null = null;

  constructor() {
    this.loadAccounts();
    this.userService.ensureAssignableUsersLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.users = users.filter((user) => user.active);
          this.cdr.markForCheck();
        },
        error: () => {
          this.toast.warning('Não foi possível carregar os utilizadores disponíveis para atribuição.');
          this.cdr.markForCheck();
        },
      });
  }

  selectAccount(account: EmailAdminAccount): void {
    this.selectedAccount = account;
    this.editDisplayName = account.displayName ?? '';
    this.newPassword = '';
    this.selectedUserId = '';
    this.access = { canRead: true, canSend: false, canManageMessages: false };
    this.savedAccess = null;
    this.connectionTest = null;
    this.connectionTestError = '';
    this.accountUsersLoadError = '';
    this.loadAccountUsers();
  }

  openCreate(): void {
    this.form = this.emptyForm();
    this.createOpen = true;
  }

  closeCreate(): void {
    if (!this.isSaving) this.createOpen = false;
  }

  createAccount(): void {
    if (this.isSaving) return;
    const payload = this.validateCreate();
    if (!payload) return;

    this.isSaving = true;
    this.adminService.createAccount(payload)
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (account) => {
          this.accounts = [...this.accounts, account].sort((a, b) => a.address.localeCompare(b.address));
          this.createOpen = false;
          this.toast.success('Conta de email criada com sucesso.');
          this.selectAccount(account);
        },
        error: (error: unknown) => this.toast.error(this.errorMessage(error, 'Não foi possível criar a conta de email.')),
      });
  }

  saveAccount(): void {
    const account = this.selectedAccount;
    if (!account || this.isSaving) return;

    this.isSaving = true;
    const payload = {
      displayName: this.editDisplayName.trim(),
      ...(this.newPassword.trim() ? { password: this.newPassword } : {}),
    };
    this.adminService.updateAccount(account.id, payload)
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.replaceAccount(updated);
          this.selectedAccount = updated;
          this.editDisplayName = updated.displayName ?? '';
          this.newPassword = '';
          this.toast.success('Conta atualizada.');
        },
        error: (error: unknown) => this.toast.error(this.errorMessage(error, 'Não foi possível atualizar a conta.')),
      });
  }

  toggleActive(): void {
    const account = this.selectedAccount;
    if (!account || this.isSaving) return;
    this.isSaving = true;
    this.adminService.updateAccount(account.id, { isActive: !account.isActive })
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.replaceAccount(updated);
          this.selectedAccount = updated;
          this.toast.success(updated.isActive ? 'Conta ativada.' : 'Conta desativada.');
        },
        error: (error: unknown) => this.toast.error(this.errorMessage(error, 'Não foi possível alterar o estado da conta.')),
      });
  }

  testConnection(): void {
    const account = this.selectedAccount;
    if (!account || this.isTesting) return;
    this.isTesting = true;
    this.connectionTest = null;
    this.connectionTestError = '';
    this.adminService.testConnection(account.id)
      .pipe(
        finalize(() => {
          this.isTesting = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.connectionTest = result;
          if (result.success) this.toast.success('Ligação IMAP e SMTP validadas com sucesso.');
          else this.toast.warning(result.message || 'Uma ou mais ligações de email falharam.');
        },
        error: (error: unknown) => {
          this.connectionTestError = this.errorMessage(error, 'Não foi possível testar a ligação.');
          this.toast.error(this.connectionTestError);
        },
      });
  }

  onUserSelected(userId: string): void {
    this.selectedUserId = userId;
    const current = this.accountUsers.find((item) => item.userId === userId);
    this.access = current
      ? { canRead: current.canRead, canSend: current.canSend, canManageMessages: current.canManageMessages }
      : { canRead: true, canSend: false, canManageMessages: false };
    this.savedAccess = current
      ? { canRead: current.canRead, canSend: current.canSend, canManageMessages: current.canManageMessages }
      : null;
  }


  onReadPermissionChange(canRead: boolean): void {
    this.access.canRead = canRead;
    if (!canRead) this.access.canManageMessages = false;
  }

  saveUserAccess(): void {
    const account = this.selectedAccount;
    if (!account || !this.selectedUserId || this.isSavingAccess) return;
    if (this.access.canManageMessages && !this.access.canRead) {
      this.toast.warning('A permissão de gestão de mensagens exige permissão de leitura.');
      return;
    }
    this.isSavingAccess = true;
    this.adminService.setAccountUser(account.id, this.selectedUserId, { ...this.access })
      .pipe(
        finalize(() => {
          this.isSavingAccess = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.accountUsers = [
            ...this.accountUsers.filter((item) => item.userId !== saved.userId),
            saved,
          ];
          this.savedAccess = {
            canRead: saved.canRead,
            canSend: saved.canSend,
            canManageMessages: saved.canManageMessages,
          };
          this.access = { ...this.savedAccess };
          this.toast.success('Permissões da conta atualizadas.');
        },
        error: (error: unknown) => this.toast.error(this.errorMessage(error, 'Não foi possível atualizar as permissões.')),
      });
  }

  removeUser(userId: string): void {
    const account = this.selectedAccount;
    if (!account || this.removingUserId) return;
    this.removingUserId = userId;
    this.adminService.removeAccountUser(account.id, userId)
      .pipe(
        finalize(() => {
          this.removingUserId = null;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.accountUsers = this.accountUsers.filter((item) => item.userId !== userId);
          if (this.selectedUserId === userId) this.onUserSelected('');
          this.toast.success('Acesso à conta removido.');
        },
        error: (error: unknown) => this.toast.error(this.errorMessage(error, 'Não foi possível remover o acesso.')),
      });
  }


  get accessDirty(): boolean {
    if (!this.selectedUserId) return false;
    if (!this.savedAccess) return true;
    return this.access.canRead !== this.savedAccess.canRead
      || this.access.canSend !== this.savedAccess.canSend
      || this.access.canManageMessages !== this.savedAccess.canManageMessages;
  }

  get selectedUserHasAccess(): boolean {
    return !!this.selectedUserId && this.savedAccess !== null;
  }

  connectionStatusLabel(value: string | null): string {
    if (!value) return 'Sem teste';
    return value.toLowerCase() === 'ok' ? 'Operacional' : 'Falhou';
  }

  connectionStatusIcon(value: string | null): string {
    if (!value) return 'help';
    return value.toLowerCase() === 'ok' ? 'check_circle' : 'error';
  }

  connectionStatusClass(value: string | null): string {
    if (!value) return 'neutral';
    return value.toLowerCase() === 'ok' ? 'ok' : 'failed';
  }

  retryLoadAccounts(): void {
    if (!this.isLoading) this.loadAccounts();
  }

  retryLoadAccountUsers(): void {
    if (!this.isLoadingUsers && this.selectedAccount) this.loadAccountUsers();
  }

  trackByAccountId(_: number, account: EmailAdminAccount): string {
    return account.id;
  }

  trackByUserId(_: number, user: ProfileUser): string {
    return user.id;
  }

  trackByAccessUserId(_: number, access: EmailAccountUserAccess): string {
    return access.userId;
  }

  userFor(userId: string): ProfileUser | null {
    return this.users.find((user) => user.id === userId) ?? null;
  }

  private loadAccounts(): void {
    this.isLoading = true;
    this.accountsLoadError = '';
    this.adminService.getAccounts()
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (accounts) => {
          this.accounts = accounts;
          if (accounts.length) this.selectAccount(accounts[0]);
        },
        error: (error: unknown) => {
          this.accountsLoadError = this.errorMessage(error, 'Não foi possível carregar as contas de email.');
          this.toast.error(this.accountsLoadError);
        },
      });
  }

  private loadAccountUsers(): void {
    const account = this.selectedAccount;
    if (!account) return;
    const version = ++this.accountUsersLoadVersion;
    const accountId = account.id;
    this.isLoadingUsers = true;
    this.accountUsersLoadError = '';
    this.accountUsers = [];
    this.adminService.getAccountUsers(accountId)
      .pipe(
        finalize(() => {
          if (version === this.accountUsersLoadVersion) {
            this.isLoadingUsers = false;
            this.cdr.markForCheck();
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (items) => {
          if (version === this.accountUsersLoadVersion && this.selectedAccount?.id === accountId) this.accountUsers = items;
        },
        error: (error: unknown) => {
          if (version !== this.accountUsersLoadVersion || this.selectedAccount?.id !== accountId) return;
          this.accountUsersLoadError = this.errorMessage(error, 'Não foi possível carregar os utilizadores desta conta.');
          this.toast.error(this.accountUsersLoadError);
        },
      });
  }

  private validateCreate(): CreateEmailAccountPayload | null {
    const address = this.form.address.trim();
    const imapHost = this.form.imapHost.trim();
    const smtpHost = this.form.smtpHost.trim();
    const username = this.form.username.trim();
    if (!address || !imapHost || !smtpHost || !username || !this.form.password) {
      this.toast.warning('Preenche os campos obrigatórios da conta.');
      return null;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      this.toast.warning('Indica um endereço de email válido.');
      return null;
    }
    return {
      address,
      displayName: this.form.displayName.trim() || undefined,
      imapHost,
      imapPort: 993,
      smtpHost,
      smtpPort: 465,
      username,
      password: this.form.password,
    };
  }

  private emptyForm(): AccountForm {
    return { address: '', displayName: '', imapHost: '', smtpHost: '', username: '', password: '' };
  }

  private replaceAccount(updated: EmailAdminAccount): void {
    this.accounts = this.accounts.map((item) => item.id === updated.id ? updated : item);
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
