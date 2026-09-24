import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortulogosContracts } from './portulogos-contracts';

describe('PortulogosContracts', () => {
  let component: PortulogosContracts;
  let fixture: ComponentFixture<PortulogosContracts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortulogosContracts],
    }).compileComponents();

    fixture = TestBed.createComponent(PortulogosContracts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
