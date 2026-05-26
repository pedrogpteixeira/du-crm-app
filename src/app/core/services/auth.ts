import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly tokenKey = 'token';

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();

    if (!token) {
      return false;
    }

    if (this.isTokenExpired(token)) {
      this.logout();
      return false;
    }

    return true;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      if (!payload.exp) {
        return false;
      }

      const expiryTime = payload.exp * 1000;

      return Date.now() >= expiryTime;
    } catch {
      return true;
    }
  }
}