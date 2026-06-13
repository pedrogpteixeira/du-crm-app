import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ContractsDefaultView,
  PreferencesService,
  UserPreferences,
} from '../../core/services/preferences';

@Component({
  selector: 'app-preferences',
  imports: [CommonModule, FormsModule],
  templateUrl: './preferences.html',
  styleUrl: './preferences.scss',
})
export class Preferences implements OnInit {
  private readonly preferencesService = inject(PreferencesService);

  preferences: UserPreferences = {
  sidebarCollapsedByDefault: false,
  contractsDefaultView: 'table',
  contractDetailsCollapsedByDefault: false,
  contractLayout: 'pro'
};

  successMessage = '';
  errorMessage = '';
  

  hasUnsavedChanges = false;
  isSaving = false;

  ngOnInit(): void {
    this.preferences = this.preferencesService.getPreferences();
  }

  updateSidebarPreference(value: boolean): void {
    this.preferences.sidebarCollapsedByDefault = value;

    this.savePreferences();
  }

  updateContractsView(value: ContractsDefaultView): void {
    this.preferences.contractsDefaultView = value;

    this.savePreferences();
  }

  private savePreferences(): void {
    this.preferencesService.updateLocalPreferences(this.preferences);

    this.hasUnsavedChanges = true;
    this.successMessage = '';
  }

  updateContractDetailsSectionsPreference(value: boolean): void {
    this.preferences.contractDetailsCollapsedByDefault = value;

    this.savePreferences();
  }

  updateContractLayout(value: 'light' | 'pro'): void {
    this.preferences.contractLayout = value;

    this.savePreferences();
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
  }