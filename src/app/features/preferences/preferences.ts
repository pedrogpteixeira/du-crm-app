import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ToastService } from '../../core/services/toast';

import { Auth } from '../../core/services/auth';
import {
  ContractLayout,
  ContractsDefaultView,
  PreferencesService,
  UserPreferences,
  UserPreferencesPatch,
} from '../../core/services/preferences';
import { AppTheme, ThemeService } from '../../core/services/theme';

@Component({
  selector: 'app-preferences',
  imports: [CommonModule, FormsModule],
  templateUrl: './preferences.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './preferences.scss',
})
export class Preferences implements OnInit, OnDestroy {
  private readonly preferencesService = inject(PreferencesService);
  private readonly auth = inject(Auth);
  private readonly themeService = inject(ThemeService);

  preferences: UserPreferences = {
    sidebarCollapsedByDefault: false,
    contractsDefaultView: 'table',
    contractDetailsCollapsedByDefault: false,
    contractLayout: 'light',
    theme: 'light',
  };

  private persistedPreferences: UserPreferences = { ...this.preferences };
  private readonly toast = inject(ToastService);

  private _errorMessage = '';
  get errorMessage(): string {
    return this._errorMessage;
  }
  set errorMessage(message: string) {
    this._errorMessage = message ?? '';

    if (this._errorMessage) {
      this.toast.error(this._errorMessage);
    }
  }

  private _successMessage = '';
  get successMessage(): string {
    return this._successMessage;
  }
  set successMessage(message: string) {
    this._successMessage = message ?? '';

    if (this._successMessage) {
      this.toast.success(this._successMessage);
    }
  }

  hasUnsavedChanges = false;
  isSaving = false;
  isSuperAdmin = false;

  get canEditContractLayout(): boolean {
    return this.isSuperAdmin;
  }

  ngOnInit(): void {
    this.isSuperAdmin = this.auth.isSuperAdmin();

    const preferences = this.preferencesService.getPreferences();

    this.preferences = { ...preferences };
    this.persistedPreferences = { ...preferences };
    this.themeService.applyTheme(preferences.theme ?? 'light');
    this.updateUnsavedChangesState();
  }

  ngOnDestroy(): void {
    if (this.preferences.theme === this.persistedPreferences.theme) {
      return;
    }

    this.preferencesService.updateLocalPreferences({
      theme: this.persistedPreferences.theme,
    });
    this.themeService.applyTheme(this.persistedPreferences.theme);
  }

  updateSidebarPreference(value: boolean): void {
    if (this.preferences.sidebarCollapsedByDefault === value) {
      return;
    }

    this.preferences = {
      ...this.preferences,
      sidebarCollapsedByDefault: value,
    };

    this.savePreferencesLocally();
  }

  updateContractsView(value: ContractsDefaultView): void {
    if (this.preferences.contractsDefaultView === value) {
      return;
    }

    this.preferences = {
      ...this.preferences,
      contractsDefaultView: value,
    };

    this.savePreferencesLocally();
  }

  updateContractDetailsSectionsPreference(value: boolean): void {
    if (this.preferences.contractDetailsCollapsedByDefault === value) {
      return;
    }

    this.preferences = {
      ...this.preferences,
      contractDetailsCollapsedByDefault: value,
    };

    this.savePreferencesLocally();
  }

  updateContractLayout(value: ContractLayout): void {
    if (
      !this.canEditContractLayout ||
      this.preferences.contractLayout === value
    ) {
      return;
    }

    this.preferences = {
      ...this.preferences,
      contractLayout: value,
    };

    this.savePreferencesLocally();
  }

  updateTheme(value: AppTheme): void {
    if (this.preferences.theme === value) {
      return;
    }

    this.preferences = {
      ...this.preferences,
      theme: value,
    };

    // Preview immediately, but do not update the dedicated bootstrap cache
    // until the PATCH succeeds.
    this.themeService.setTheme(value, false);
    this.savePreferencesLocally();
  }

  persistPreferences(): void {
    if (this.isSaving || !this.hasUnsavedChanges) {
      return;
    }

    const payload = this.buildAllowedChangedPayload();

    if (!Object.keys(payload).length) {
      this.updateUnsavedChangesState();
      return;
    }

    const preferencesBeingSaved: UserPreferences = {
      ...this.persistedPreferences,
      ...payload,
    };

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.preferencesService.syncPreferences(payload).subscribe({
      next: () => {
        this.persistedPreferences = preferencesBeingSaved;

        if (payload.theme) {
          this.themeService.persistTheme(payload.theme);
          this.themeService.applyTheme(this.preferences.theme);
        }

        this.updateUnsavedChangesState();
        this.successMessage = 'Preferências guardadas com sucesso.';
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;

        if (
          payload.theme &&
          this.preferences.theme === payload.theme
        ) {
          this.preferences = {
            ...this.preferences,
            theme: this.persistedPreferences.theme,
          };
          this.preferencesService.updateLocalPreferences({
            theme: this.persistedPreferences.theme,
          });
          this.themeService.applyTheme(this.persistedPreferences.theme);
        }

        this.updateUnsavedChangesState();
        this.errorMessage = this.getSaveErrorMessage(error, payload);
      },
      complete: () => {
        this.isSaving = false;
      },
    });
  }

  private savePreferencesLocally(): void {
    this.preferencesService.updateLocalPreferences(this.preferences);

    this.updateUnsavedChangesState();
    this.successMessage = '';
    this.errorMessage = '';
  }

  private buildAllowedChangedPayload(): UserPreferencesPatch {
    const payload: UserPreferencesPatch = {};

    if (
      this.preferences.sidebarCollapsedByDefault !==
      this.persistedPreferences.sidebarCollapsedByDefault
    ) {
      payload.sidebarCollapsedByDefault =
        this.preferences.sidebarCollapsedByDefault;
    }

    if (
      this.preferences.contractsDefaultView !==
      this.persistedPreferences.contractsDefaultView
    ) {
      payload.contractsDefaultView = this.preferences.contractsDefaultView;
    }

    if (
      this.preferences.contractDetailsCollapsedByDefault !==
      this.persistedPreferences.contractDetailsCollapsedByDefault
    ) {
      payload.contractDetailsCollapsedByDefault =
        this.preferences.contractDetailsCollapsedByDefault;
    }

    if (
      this.canEditContractLayout &&
      this.preferences.contractLayout !==
        this.persistedPreferences.contractLayout
    ) {
      payload.contractLayout = this.preferences.contractLayout;
    }

    if (this.preferences.theme !== this.persistedPreferences.theme) {
      payload.theme = this.preferences.theme;
    }

    return payload;
  }

  private updateUnsavedChangesState(): void {
    this.hasUnsavedChanges =
      Object.keys(this.buildAllowedChangedPayload()).length > 0;
  }

  private getSaveErrorMessage(
    error: HttpErrorResponse,
    payload: UserPreferencesPatch,
  ): string {
    if (error.status === 403 && payload.contractLayout) {
      return 'Não tem permissão para alterar o layout dos contratos.';
    }

    if (error.status === 403 && payload.theme) {
      return 'O tema só pode ser alterado pelo próprio utilizador.';
    }

    return 'Não foi possível guardar as preferências.';
  }
}
