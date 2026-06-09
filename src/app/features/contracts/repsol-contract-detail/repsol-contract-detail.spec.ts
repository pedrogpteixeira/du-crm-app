import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RepsolContractDetail } from './repsol-contract-detail';

describe('RepsolContractDetail', () => {
  let component: RepsolContractDetail;
  let fixture: ComponentFixture<RepsolContractDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepsolContractDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(RepsolContractDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
