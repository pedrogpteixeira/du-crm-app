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
  repsolContractsDefaultView: 'table',
  repsolContractDetailsCollapsedByDefault: false,
};

  successMessage = '';

  ngOnInit(): void {
    this.preferences = this.preferencesService.getPreferences();
  }

  updateSidebarPreference(value: boolean): void {
    this.preferences.sidebarCollapsedByDefault = value;

    this.savePreferences();
  }

  updateContractsView(value: ContractsDefaultView): void {
    this.preferences.repsolContractsDefaultView = value;

    this.savePreferences();
  }

  private savePreferences(): void {
    this.preferencesService.updatePreferences(this.preferences);

    this.successMessage = 'Preferências atualizadas.';

    setTimeout(() => {
      this.successMessage = '';
    }, 2500);
  }

  updateContractDetailsSectionsPreference(value: boolean): void {
    this.preferences.repsolContractDetailsCollapsedByDefault = value;

    this.savePreferences();
  }
}