import { TestBed } from '@angular/core/testing';

import { PortulogosContractService } from './portulogos-contract';

describe('PortulogosContractService', () => {
  let service: PortulogosContractService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PortulogosContractService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
