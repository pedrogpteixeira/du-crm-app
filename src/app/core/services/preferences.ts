import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Auth } from './auth';
import type { AppTheme } from './theme';

export type ContractsDefaultView = 'table' | 'kanban';
export type ContractLayout = 'light' | 'pro';

export interface UserPreferences {
  id?: string;
  userId?: string;
  sidebarCollapsedByDefault: boolean;
  contractsDefaultView: ContractsDefaultView;
  contractDetailsCollapsedByDefault: boolean;
  contractLayout: ContractLayout;
  theme: AppTheme;
  createdAt?: string;
  updatedAt?: string;
}

export type UserPreferencesPatch = Partial<
  Pick<
    UserPreferences,
    | 'sidebarCollapsedByDefault'
    | 'contractsDefaultView'
    | 'contractDetailsCollapsedByDefault'
    | 'contractLayout'
    | 'theme'
  >
>;

interface LegacyPreferencesShape {
  sidebarCollapsedByDefault?: boolean;
  contractsDefaultView?: ContractsDefaultView;
  contractDetailsCollapsedByDefault?: boolean;
  contractLayout?: ContractLayout;
  theme?: AppTheme;
  repsolContractsDefaultView?: ContractsDefaultView;
  repsolContractDetailsCollapsedByDefault?: boolean;
  id?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  sidebarCollapsedByDefault: false,
  contractsDefaultView: 'table',
  contractDetailsCollapsedByDefault: false,
  contractLayout: 'light',
  theme: 'light',
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

  readonly preferences$ = this.preferencesSubject.asObservable();

  getPreferences(): UserPreferences {
    const storedPreferences = localStorage.getItem(this.storageKey);

    if (!storedPreferences) {
      return { ...DEFAULT_PREFERENCES };
    }

    try {
      return this.normalizePreferences(JSON.parse(storedPreferences));
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  getUserPreferences(userId: string): Observable<UserPreferences> {
    return this.http
      .get<LegacyPreferencesShape>(
        `${this.apiUrl}/api/user-preferences/user/${userId}`,
      )
      .pipe(
        map((preferences) => this.normalizePreferences(preferences)),
      );
  }

  setLocalPreferences(preferences: Partial<UserPreferences>): void {
    const updatedPreferences = this.normalizePreferences({
      ...this.getPreferences(),
      ...preferences,
    });

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(updatedPreferences),
    );

    this.preferencesSubject.next(updatedPreferences);
  }

  updateLocalPreferences(preferences: Partial<UserPreferences>): void {
    this.setLocalPreferences(preferences);
  }

  syncPreferences(
    preferences: UserPreferencesPatch,
  ): Observable<UserPreferences> {
    const user = this.auth.getCurrentUser();

    if (!user?.id) {
      throw new Error('Authenticated user not found.');
    }

    return this.updateUserPreferences(user.id, preferences);
  }

  updateUserPreferences(
    userId: string,
    preferences: UserPreferencesPatch,
  ): Observable<UserPreferences> {
    return this.http
      .patch<LegacyPreferencesShape>(
        `${this.apiUrl}/api/user-preferences/user/${userId}`,
        preferences,
      )
      .pipe(
        map((response) => this.normalizePreferences(response)),
      );
  }

  clearLocalPreferences(): void {
    localStorage.removeItem(this.storageKey);
    this.preferencesSubject.next({ ...DEFAULT_PREFERENCES });
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

  getTheme(): AppTheme {
    return this.getPreferences().theme;
  }

  private normalizePreferences(input: unknown): UserPreferences {
    const source =
      input && typeof input === 'object'
        ? (input as LegacyPreferencesShape)
        : {};

    const contractsDefaultView =
      source.contractsDefaultView ??
      source.repsolContractsDefaultView ??
      DEFAULT_PREFERENCES.contractsDefaultView;

    const contractDetailsCollapsedByDefault =
      source.contractDetailsCollapsedByDefault ??
      source.repsolContractDetailsCollapsedByDefault ??
      DEFAULT_PREFERENCES.contractDetailsCollapsedByDefault;

    return {
      ...(source.id ? { id: source.id } : {}),
      ...(source.userId ? { userId: source.userId } : {}),
      ...(source.createdAt ? { createdAt: source.createdAt } : {}),
      ...(source.updatedAt ? { updatedAt: source.updatedAt } : {}),
      sidebarCollapsedByDefault:
        typeof source.sidebarCollapsedByDefault === 'boolean'
          ? source.sidebarCollapsedByDefault
          : DEFAULT_PREFERENCES.sidebarCollapsedByDefault,
      contractsDefaultView:
        contractsDefaultView === 'kanban' ? 'kanban' : 'table',
      contractDetailsCollapsedByDefault:
        typeof contractDetailsCollapsedByDefault === 'boolean'
          ? contractDetailsCollapsedByDefault
          : DEFAULT_PREFERENCES.contractDetailsCollapsedByDefault,
      contractLayout:
        source.contractLayout === 'pro' ? 'pro' : 'light',
      theme: source.theme === 'dark' ? 'dark' : 'light',
    };
  }
}
