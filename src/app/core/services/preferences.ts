import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { environment } from '../../../environments/environment.development';
import { Auth } from './auth';

export type ContractsDefaultView = 'table' | 'kanban';
export type ContractLayout = 'light' | 'pro';

export interface UserPreferences {
  sidebarCollapsedByDefault: boolean;
  contractsDefaultView: ContractsDefaultView;
  contractDetailsCollapsedByDefault: boolean;
  contractLayout: ContractLayout;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  sidebarCollapsedByDefault: false,
  contractsDefaultView: 'table',
  contractDetailsCollapsedByDefault: false,
  contractLayout: 'light',
};

@Injectable({
  providedIn: 'root',
})
export class PreferencesService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly apiUrl = environment.apiUrl;
  private readonly storageKey = 'preferences';

  private readonly preferencesSubject =
    new BehaviorSubject<UserPreferences>(this.getPreferences());

  preferences$ = this.preferencesSubject.asObservable();

  getPreferences(): UserPreferences {
    const storedPreferences = localStorage.getItem(this.storageKey);

    if (!storedPreferences) {
      return DEFAULT_PREFERENCES;
    }

    return {
      ...DEFAULT_PREFERENCES,
      ...JSON.parse(storedPreferences),
    };
  }

  setLocalPreferences(preferences: Partial<UserPreferences>): void {
    const updatedPreferences = {
      ...this.getPreferences(),
      ...preferences,
    };

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(updatedPreferences),
    );

    this.preferencesSubject.next(updatedPreferences);
  }

  updateLocalPreferences(preferences: Partial<UserPreferences>): void {
    this.setLocalPreferences(preferences);
  }

  syncPreferences() {
    const user = this.auth.getCurrentUser();

    if (!user?.id) {
      throw new Error('Authenticated user not found.');
    }

    const preferences = this.getPreferences();

    return this.http.patch(
      `${this.apiUrl}/api/user-preferences/user/${user.id}`,
      preferences,
    );
  }

  clearLocalPreferences(): void {
    localStorage.removeItem(this.storageKey);
    this.preferencesSubject.next(DEFAULT_PREFERENCES);
  }

  getSidebarCollapsedByDefault(): boolean {
    return this.getPreferences().sidebarCollapsedByDefault;
  }

  getContractsDefaultView(): ContractsDefaultView {
    return this.getPreferences().contractsDefaultView;
  }

  getContractDetailsCollapsedByDefault(): boolean {
    return this.getPreferences().contractDetailsCollapsedByDefault;
  }

  getContractLayout(): ContractLayout {
    return this.getPreferences().contractLayout;
  }
}