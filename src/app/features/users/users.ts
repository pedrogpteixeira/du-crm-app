import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SocketService } from '../../core/services/socket';
import { ProfileUser, UserService } from '../../core/services/user';
import { environment } from '../../../environments/environment.development';

@Component({
  selector: 'app-users',
  imports: [CommonModule, RouterLink],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users implements OnInit {
  private readonly userService = inject(UserService);
  private readonly socketService = inject(SocketService);

  users: ProfileUser[] = [];
  onlineUsers$ = this.socketService.onlineUsers$;

  isLoading = false;
  errorMessage = '';

  currentUserId = this.getCurrentUserId();

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar os utilizadores.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  private getCurrentUserId(): string | null {
    const storedUser = localStorage.getItem('user');

    if (!storedUser) {
      return null;
    }

    return JSON.parse(storedUser).id;
  }

  getProfilePictureUrl(user: ProfileUser): string | null {
    if (!user.profilePicture) {
      return null;
    }

    return `${environment.apiUrl}${user.profilePicture}`;
  }

  getInitial(name: string): string {
    return name?.charAt(0).toUpperCase() || '?';
  }

  isOnline(userId: string, onlineUsers: string[] | null): boolean {
    return !!onlineUsers?.includes(userId);
  }
}