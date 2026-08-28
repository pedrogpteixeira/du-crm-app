import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GalpPowerGasContractCreate } from './galp-power-gas-contract-create';

describe('GalpPowerGasContractCreate', () => {
  let component: GalpPowerGasContractCreate;
  let fixture: ComponentFixture<GalpPowerGasContractCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalpPowerGasContractCreate],
    }).compileComponents();

    fixture = TestBed.createComponent(GalpPowerGasContractCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
