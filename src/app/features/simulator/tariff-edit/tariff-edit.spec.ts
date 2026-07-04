import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TariffEdit } from './tariff-edit';

describe('TariffEdit', () => {
  let component: TariffEdit;
  let fixture: ComponentFixture<TariffEdit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TariffEdit],
    }).compileComponents();

    fixture = TestBed.createComponent(TariffEdit);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
