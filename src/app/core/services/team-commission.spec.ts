import { TestBed } from '@angular/core/testing';

import { TeamCommission } from './team-commission';

describe('TeamCommission', () => {
  let service: TeamCommission;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TeamCommission);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
