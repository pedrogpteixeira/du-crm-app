import { TestBed } from '@angular/core/testing';

import { Simulator } from './simulator';

describe('Simulator', () => {
  let service: Simulator;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Simulator);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
