import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment.development';

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
  private readonly preferencesSubject =
    new BehaviorSubject<UserPreferences>(this.getPreferences());

  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  preferences$ = this.preferencesSubject.asObservable();

  getPreferences(): UserPreferences {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    return {
      ...DEFAULT_PREFERENCES,
      ...(user.preferences || {}),
    };
  }

  updateLocalPreferences(preferences: Partial<UserPreferences>): void {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const updatedPreferences = {
      ...this.getPreferences(),
      ...preferences,
    };

    const updatedUser = {
      ...user,
      preferences: updatedPreferences,
    };

    localStorage.setItem('user', JSON.stringify(updatedUser));

    this.preferencesSubject.next(updatedPreferences);
  }

  syncPreferences() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const payload = {
      sidebarCollapsedByDefault:
        user.preferences.sidebarCollapsedByDefault,

      repsolContractsDefaultView:
        user.preferences.repsolContractsDefaultView,

      repsolContractDetailsCollapsedByDefault:
        user.preferences.repsolContractDetailsCollapsedByDefault,

      contractLayout:
        user.preferences.contractLayout,
    };

    return this.http.patch(
      `${this.apiUrl}/api/user-preferences/user/${user.id}`,
      payload,
    );
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