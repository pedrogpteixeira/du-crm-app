import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../../../environments/environment.development';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  @Input() collapsed = false;
  @Output() toggle = new EventEmitter<void>();

  user = this.getUser();

  private getUser() {
    const user = localStorage.getItem('user');

    if (!user) {
      return null;
    }

    return JSON.parse(user);
  }

  get userInitial(): string {
    if (!this.user?.name) {
      return '?';
    }

    return this.user.name.charAt(0).toUpperCase();
  }

  get profilePictureUrl(): string | null {
    if (!this.user?.profilePicture) {
      return null;
    }

    return `${environment.apiUrl}/api/users/${this.user.id}/profile-picture`;
  }
}