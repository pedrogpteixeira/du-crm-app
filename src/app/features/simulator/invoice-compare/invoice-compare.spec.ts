import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvoiceCompare } from './invoice-compare';

describe('InvoiceCompare', () => {
  let component: InvoiceCompare;
  let fixture: ComponentFixture<InvoiceCompare>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoiceCompare],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoiceCompare);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
