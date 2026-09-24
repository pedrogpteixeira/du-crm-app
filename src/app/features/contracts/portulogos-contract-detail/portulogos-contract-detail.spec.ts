import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortulogosContractDetail } from './portulogos-contract-detail';

describe('PortulogosContractDetail', () => {
  let component: PortulogosContractDetail;
  let fixture: ComponentFixture<PortulogosContractDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortulogosContractDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(PortulogosContractDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
