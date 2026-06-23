import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { SocketService } from '../../../core/services/socket';
import { ProfileUser, UserService } from '../../../core/services/user';
import { environment } from '../../../../environments/environment.development';

@Component({
  selector: 'app-user-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss',
})
export class UserDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly userService = inject(UserService);
  private readonly socketService = inject(SocketService);

  user: ProfileUser | null = null;
  isUserOnline$!: Observable<boolean>;

  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id');

    if (!userId) {
      this.errorMessage = 'Utilizador não encontrado.';
      return;
    }

    this.isUserOnline$ = this.socketService.isOnline$(userId);
    this.loadUser(userId);
  }

  loadUser(userId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.userService.getUserById(userId).subscribe({
      next: (user) => {
        this.user = user;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o utilizador.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  get profilePictureUrl(): string | null {
    if (!this.user?.profilePicture) {
      return null;
    }

    return `${environment.apiUrl}/api/users/${this.user.id}/profile-picture`;
  }

  get userInitial(): string {
    return this.user?.name?.charAt(0).toUpperCase() || '?';
  }

  formatCreatedAt(date?: string): string {
    if (!date) {
      return 'Não disponível';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  formatLastAccess(date?: string): string {
    if (!date) {
      return 'Não disponível';
    }

    const accessDate = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - accessDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const formattedTime = accessDate.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (diffDays === 0) {
      return `Hoje às ${formattedTime}`;
    }

    if (diffDays === 1) {
      return `Ontem às ${formattedTime}`;
    }

    if (diffDays < 7) {
      return `Há ${diffDays} dias`;
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(accessDate);
  }
}