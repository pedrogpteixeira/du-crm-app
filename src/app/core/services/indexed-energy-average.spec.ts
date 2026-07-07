import { TestBed } from '@angular/core/testing';

import { IndexedEnergyAverage } from './indexed-energy-average';

describe('IndexedEnergyAverage', () => {
  let service: IndexedEnergyAverage;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndexedEnergyAverage);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
