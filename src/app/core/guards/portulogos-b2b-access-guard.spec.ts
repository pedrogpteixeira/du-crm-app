import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { PORTULOGOS_B2B_TEAM_ID } from '../config/portulogos-b2b-access';
import type { AuthUser } from '../models/auth-user';
import { Auth } from '../services/auth';
import { portulogosB2BAccessGuard } from './portulogos-b2b-access-guard';

describe('portulogosB2BAccessGuard', () => {
  const user = (role: string, teamIds: string[] = []): AuthUser => ({
    id: 'usr_test',
    username: 'test',
    name: 'Test',
    role,
    email: 'test@example.com',
    phone: '',
    active: true,
    defaultTeam: null,
    teams: teamIds.map((id) => ({ id, name: id })),
  });

  let currentUser: AuthUser | null;
  const authMock = {
    getCurrentUser: () => currentUser,
  };
  const routerMock = {
    createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue('DENIED'),
  };

  beforeEach(() => {
    currentUser = null;
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: authMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  it('allows Super Admin', () => {
    currentUser = user('Super Admin');
    const result = TestBed.runInInjectionContext(() =>
      portulogosB2BAccessGuard({} as never, {} as never),
    );
    expect(result).toBeTrue();
  });

  it('allows a member of the Arlindo Esmeriz team', () => {
    currentUser = user('Comercial', [PORTULOGOS_B2B_TEAM_ID]);
    const result = TestBed.runInInjectionContext(() =>
      portulogosB2BAccessGuard({} as never, {} as never),
    );
    expect(result).toBeTrue();
  });

  it('denies other users', () => {
    currentUser = user('Comercial', ['tea_other']);
    const result = TestBed.runInInjectionContext(() =>
      portulogosB2BAccessGuard({} as never, {} as never),
    );
    expect(result).toBe('DENIED' as never);
  });
});
