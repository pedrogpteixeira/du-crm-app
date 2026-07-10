import { TestBed } from '@angular/core/testing';

import { IndexedGasPrice } from './indexed-gas-price';

describe('IndexedGasPrice', () => {
  let service: IndexedGasPrice;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndexedGasPrice);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
