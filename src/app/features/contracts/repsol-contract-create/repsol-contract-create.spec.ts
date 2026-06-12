import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RepsolContractCreate } from './repsol-contract-create';

describe('RepsolContractCreate', () => {
  let component: RepsolContractCreate;
  let fixture: ComponentFixture<RepsolContractCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepsolContractCreate],
    }).compileComponents();

    fixture = TestBed.createComponent(RepsolContractCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
