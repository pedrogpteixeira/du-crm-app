import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortulogosContractCreate } from './portulogos-contract-create';

describe('PortulogosContractCreate', () => {
  let component: PortulogosContractCreate;
  let fixture: ComponentFixture<PortulogosContractCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortulogosContractCreate],
    }).compileComponents();

    fixture = TestBed.createComponent(PortulogosContractCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
