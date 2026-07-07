import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { roleIncludesGuard } from './role-includes-guard';

describe('roleIncludesGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => roleIncludesGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
