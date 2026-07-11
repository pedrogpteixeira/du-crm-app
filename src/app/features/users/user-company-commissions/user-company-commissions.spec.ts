import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserCompanyCommissions } from './user-company-commissions';

describe('UserCompanyCommissions', () => {
  let component: UserCompanyCommissions;
  let fixture: ComponentFixture<UserCompanyCommissions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCompanyCommissions],
    }).compileComponents();

    fixture = TestBed.createComponent(UserCompanyCommissions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
