import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OmieAverages } from './omie-averages';

describe('OmieAverages', () => {
  let component: OmieAverages;
  let fixture: ComponentFixture<OmieAverages>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OmieAverages],
    }).compileComponents();

    fixture = TestBed.createComponent(OmieAverages);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
