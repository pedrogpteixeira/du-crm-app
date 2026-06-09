import { TestBed } from '@angular/core/testing';

import { RepsolContract } from './repsol-contract';

describe('RepsolContract', () => {
  let service: RepsolContract;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RepsolContract);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
