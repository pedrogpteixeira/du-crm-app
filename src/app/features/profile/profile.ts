import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment.development';

interface ProfileUser {
  id: string;
  username: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  active: boolean;
  defaultTeam: string;
  profilePicture?: string;
  createdAt?: string;
  lastAccess?: string;
}

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  isEditing = false;

  user: ProfileUser = this.getStoredUser();

  editableUser: ProfileUser = { ...this.user };

  toggleEdit(): void {
    this.isEditing = true;
    this.editableUser = { ...this.user };
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.editableUser = { ...this.user };
  }

  save(): void {
    this.user = { ...this.editableUser };
    localStorage.setItem('user', JSON.stringify(this.user));
    this.isEditing = false;
  }

  get userInitial(): string {
    return this.user.name?.charAt(0).toUpperCase() || '?';
  }

  get profilePictureUrl(): string | null {
    if (!this.user.profilePicture) {
      return null;
    }

    console.log('Profile picture path:', environment.apiUrl + this.user.profilePicture);
    return environment.apiUrl + this.user.profilePicture;
  }

  private getStoredUser(): ProfileUser {
    const storedUser = localStorage.getItem('user');

    if (storedUser) {
      return JSON.parse(storedUser);
    }

    return {
      id: '',
      username: '',
      name: 'Unknown User',
      role: '',
      email: '',
      phone: '',
      active: false,
      defaultTeam: '',
    };
  }
}