import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import {
  Observable,
  finalize,
  forkJoin,
} from 'rxjs';

import {
  SocketService,
} from '../../../core/services/socket';

import {
  ProfileUser,
  UserService,
} from '../../../core/services/user';

import {
  environment,
} from '../../../../environments/environment';

import {
  Auth,
} from '../../../core/services/auth';

@Component({
  selector: 'app-user-detail',
  imports: [
    CommonModule,
    RouterLink,
  ],
  templateUrl: './user-detail.html',
  changeDetection:
    ChangeDetectionStrategy.Eager,
  styleUrl: './user-detail.scss',
})
export class UserDetail
  implements OnInit {

  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly userService =
    inject(UserService);

  private readonly socketService =
    inject(SocketService);

  private readonly auth =
    inject(Auth);

  user: ProfileUser | null = null;

  isUserOnline$!:
    Observable<boolean>;

  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    const userId =
      this.route.snapshot.paramMap.get(
        'id',
      );

    if (!userId) {
      void this.router.navigateByUrl(
        '/error',
      );

      return;
    }

    this.validateUserAccess(
      userId,
    );
  }

  private validateUserAccess(
    targetUserId: string,
  ): void {
    const authenticatedUser =
      this.auth.getCurrentUser();

    if (!authenticatedUser?.id) {
      void this.router.navigateByUrl(
        '/error',
      );

      return;
    }

    /*
    * Super Admin pode consultar
    * qualquer perfil.
    */
    if (
      this.auth.roleIncludes(
        'Super Admin',
      )
    ) {
      this.loadUser(
        targetUserId,
      );

      return;
    }

    /*
    * O utilizador pode sempre consultar
    * o próprio perfil.
    */
    if (
      authenticatedUser.id ===
      targetUserId
    ) {
      this.loadUser(
        targetUserId,
      );

      return;
    }

    /*
    * Para consultar outro utilizador,
    * é necessário partilhar pelo menos
    * uma equipa.
    */
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      currentUser:
        this.userService.getUserById(
          authenticatedUser.id,
        ),

      targetUser:
        this.userService.getUserById(
          targetUserId,
        ),
    })
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: ({
          currentUser,
          targetUser,
        }) => {
          if (
            !this.usersShareTeam(
              currentUser,
              targetUser,
            )
          ) {
            void this.router.navigateByUrl(
              '/error',
            );

            return;
          }

          this.setUser(
            targetUser,
          );
        },

        error: () => {
          void this.router.navigateByUrl(
            '/error',
          );
        },
      });
  }

  private usersShareTeam(
    currentUser: ProfileUser,
    targetUser: ProfileUser,
  ): boolean {
    const currentUserTeamIds =
      this.getUserTeamIds(
        currentUser,
      );

    const targetUserTeamIds =
      this.getUserTeamIds(
        targetUser,
      );

    if (
      !currentUserTeamIds.size ||
      !targetUserTeamIds.size
    ) {
      return false;
    }

    return Array.from(
      currentUserTeamIds,
    ).some(
      (teamId) =>
        targetUserTeamIds.has(
          teamId,
        ),
    );
  }

  private getUserTeamIds(
    user: ProfileUser,
  ): Set<string> {
    const teamIds =
      new Set<string>();

    user.teams?.forEach(
      (team) => {
        if (team?.id) {
          teamIds.add(
            team.id,
          );
        }
      },
    );

    /*
     * Incluímos também a defaultTeam
     * por segurança, caso não esteja
     * presente no array teams.
     */
    if (user.defaultTeam?.id) {
      teamIds.add(
        user.defaultTeam.id,
      );
    }

    return teamIds;
  }

  loadUser(
    userId: string,
  ): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.userService
      .getUserById(userId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (user) => {
          this.setUser(
            user,
          );
        },

        error: () => {
          void this.router.navigateByUrl(
            '/error',
          );
        },
      });
  }

  private setUser(
    user: ProfileUser,
  ): void {
    this.user = user;

    this.isUserOnline$ =
      this.socketService.isOnline$(
        user.id,
      );
  }

  get profilePictureUrl():
    string | null {
    if (
      !this.user?.profilePicture
    ) {
      return null;
    }

    return (
      `${environment.apiUrl}` +
      `/api/users/` +
      `${this.user.id}` +
      `/profile-picture`
    );
  }

  get userInitial(): string {
    return (
      this.user?.name
        ?.charAt(0)
        .toUpperCase() ||
      '?'
    );
  }

  formatCreatedAt(
    date?: string,
  ): string {
    if (!date) {
      return 'Não disponível';
    }

    return new Intl.DateTimeFormat(
      'pt-PT',
      {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    ).format(
      new Date(date),
    );
  }

  formatLastAccess(
    date?: string,
  ): string {
    if (!date) {
      return 'Não disponível';
    }

    const accessDate =
      new Date(date);

    const now =
      new Date();

    const diffMs =
      now.getTime() -
      accessDate.getTime();

    const diffDays =
      Math.floor(
        diffMs /
          (
            1000 *
            60 *
            60 *
            24
          ),
      );

    const formattedTime =
      accessDate.toLocaleTimeString(
        'pt-PT',
        {
          hour: '2-digit',
          minute: '2-digit',
        },
      );

    if (diffDays === 0) {
      return (
        `Hoje às ` +
        `${formattedTime}`
      );
    }

    if (diffDays === 1) {
      return (
        `Ontem às ` +
        `${formattedTime}`
      );
    }

    if (diffDays < 7) {
      return (
        `Há ${diffDays} dias`
      );
    }

    return new Intl.DateTimeFormat(
      'pt-PT',
      {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      },
    ).format(
      accessDate,
    );
  }
}