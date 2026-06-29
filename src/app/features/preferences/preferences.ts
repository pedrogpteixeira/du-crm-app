import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ContractLayout,
  ContractsDefaultView,
  PreferencesService,
  UserPreferences,
} from '../../core/services/preferences';

@Component({
  selector: 'app-preferences',
  imports: [CommonModule, FormsModule],
  templateUrl: './preferences.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './preferences.scss',
})
export class Preferences implements OnInit {
  private readonly preferencesService = inject(PreferencesService);

  preferences: UserPreferences = {
    sidebarCollapsedByDefault: false,
    contractsDefaultView: 'table',
    contractDetailsCollapsedByDefault: false,
    contractLayout: 'light',
  };

  successMessage = '';
  errorMessage = '';

  hasUnsavedChanges = false;
  isSaving = false;

  ngOnInit(): void {
    this.preferences = this.preferencesService.getPreferences();
  }

  updateSidebarPreference(value: boolean): void {
    this.preferences = {
      ...this.preferences,
      sidebarCollapsedByDefault: value,
    };

    this.savePreferencesLocally();
  }

  updateContractsView(value: ContractsDefaultView): void {
    this.preferences = {
      ...this.preferences,
      contractsDefaultView: value,
    };

    this.savePreferencesLocally();
  }

  updateContractDetailsSectionsPreference(value: boolean): void {
    this.preferences = {
      ...this.preferences,
      contractDetailsCollapsedByDefault: value,
    };

    this.savePreferencesLocally();
  }

  updateContractLayout(value: ContractLayout): void {
    this.preferences = {
      ...this.preferences,
      contractLayout: value,
    };

    this.savePreferencesLocally();
  }

  persistPreferences(): void {
    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.preferencesService.syncPreferences().subscribe({
      next: () => {
        this.hasUnsavedChanges = false;
        this.successMessage = 'Preferências guardadas com sucesso.';
      },
      error: () => {
        this.errorMessage = 'Não foi possível guardar as preferências.';
      },
      complete: () => {
        this.isSaving = false;
      },
    });
  }

  private savePreferencesLocally(): void {
    this.preferencesService.updateLocalPreferences(this.preferences);

    this.hasUnsavedChanges = true;
    this.successMessage = '';
    this.errorMessage = '';
  }
}
