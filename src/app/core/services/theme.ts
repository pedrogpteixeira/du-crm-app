import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppTheme = 'light' | 'dark';

const DEFAULT_THEME: AppTheme = 'light';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'theme';

  private readonly themeSubject = new BehaviorSubject<AppTheme>(
    this.readCachedTheme(),
  );

  readonly theme$ = this.themeSubject.asObservable();

  constructor() {
    this.applyTheme(this.themeSubject.value);
  }

  getCurrentTheme(): AppTheme {
    return this.themeSubject.value;
  }

  setTheme(theme: AppTheme, persist = true): void {
    this.applyTheme(theme);

    if (persist) {
      this.persistTheme(theme);
    }
  }

  applyTheme(theme: AppTheme): void {
    const normalizedTheme = this.normalizeTheme(theme);
    const root = this.document.documentElement;

    root.dataset['theme'] = normalizedTheme;
    root.style.colorScheme = normalizedTheme;

    if (this.themeSubject.value !== normalizedTheme) {
      this.themeSubject.next(normalizedTheme);
    }
  }

  persistTheme(theme: AppTheme): void {
    const normalizedTheme = this.normalizeTheme(theme);

    try {
      localStorage.setItem(this.storageKey, normalizedTheme);
    } catch {
      // The API remains the source of truth. Local storage is only used to
      // prevent a visual flash while the authenticated session is restored.
    }
  }

  resetTheme(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Ignore storage failures and still reset the DOM theme below.
    }

    this.applyTheme(DEFAULT_THEME);
  }

  private readCachedTheme(): AppTheme {
    try {
      return this.normalizeTheme(localStorage.getItem(this.storageKey));
    } catch {
      return DEFAULT_THEME;
    }
  }

  private normalizeTheme(theme: unknown): AppTheme {
    return theme === 'dark' ? 'dark' : DEFAULT_THEME;
  }
}
