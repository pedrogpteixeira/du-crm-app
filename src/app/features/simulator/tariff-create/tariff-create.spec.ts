import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TariffCreate } from './tariff-create';

describe('TariffCreate', () => {
  let component: TariffCreate;
  let fixture: ComponentFixture<TariffCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TariffCreate],
    }).compileComponents();

    fixture = TestBed.createComponent(TariffCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
