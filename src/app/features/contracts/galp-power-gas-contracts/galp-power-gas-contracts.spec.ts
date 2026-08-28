import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GalpPowerGasContracts } from './galp-power-gas-contracts';

describe('GalpPowerGasContracts', () => {
  let component: GalpPowerGasContracts;
  let fixture: ComponentFixture<GalpPowerGasContracts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalpPowerGasContracts],
    }).compileComponents();

    fixture = TestBed.createComponent(GalpPowerGasContracts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
