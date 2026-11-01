import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { PortulogosB2BContractService } from './portulogos-b2b-contract';

describe('PortulogosB2BContractService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  });

  it('should be created', () => {
    expect(TestBed.inject(PortulogosB2BContractService)).toBeTruthy();
  });
});
