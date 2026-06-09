import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RepsolContracts } from './repsol-contracts';

describe('RepsolContracts', () => {
  let component: RepsolContracts;
  let fixture: ComponentFixture<RepsolContracts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepsolContracts],
    }).compileComponents();

    fixture = TestBed.createComponent(RepsolContracts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
