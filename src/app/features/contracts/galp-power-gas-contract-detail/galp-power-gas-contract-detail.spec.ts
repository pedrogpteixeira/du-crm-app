import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GalpPowerGasContractDetail } from './galp-power-gas-contract-detail';

describe('GalpPowerGasContractDetail', () => {
  let component: GalpPowerGasContractDetail;
  let fixture: ComponentFixture<GalpPowerGasContractDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalpPowerGasContractDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(GalpPowerGasContractDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
