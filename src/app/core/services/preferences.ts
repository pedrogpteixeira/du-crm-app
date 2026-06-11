import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ContractsDefaultView = 'table' | 'kanban';

export interface UserPreferences {
  sidebarCollapsedByDefault: boolean;
  repsolContractsDefaultView: ContractsDefaultView;
  repsolContractDetailsCollapsedByDefault: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  sidebarCollapsedByDefault: false,
  repsolContractsDefaultView: 'table',
  repsolContractDetailsCollapsedByDefault: false,
};

@Injectable({
  providedIn: 'root',
})
export class PreferencesService {
  private readonly storageKey = 'user_preferences';

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

  updatePreferences(preferences: Partial<UserPreferences>): void {
    const currentPreferences = this.getPreferences();

    const updatedPreferences = {
      ...currentPreferences,
      ...preferences,
    };

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(updatedPreferences),
    );

    this.preferencesSubject.next(updatedPreferences);
  }

  getSidebarCollapsedByDefault(): boolean {
    return this.getPreferences().sidebarCollapsedByDefault;
  }

  getRepsolContractsDefaultView(): ContractsDefaultView {
    return this.getPreferences().repsolContractsDefaultView;
  }
}