import { TestBed } from '@angular/core/testing';

import { UserCompanyCommission } from './user-company-commission';

describe('UserCompanyCommission', () => {
  let service: UserCompanyCommission;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserCompanyCommission);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
