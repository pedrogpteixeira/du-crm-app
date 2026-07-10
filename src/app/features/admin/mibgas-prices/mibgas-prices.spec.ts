import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MibgasPrices } from './mibgas-prices';

describe('MibgasPrices', () => {
  let component: MibgasPrices;
  let fixture: ComponentFixture<MibgasPrices>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MibgasPrices],
    }).compileComponents();

    fixture = TestBed.createComponent(MibgasPrices);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
