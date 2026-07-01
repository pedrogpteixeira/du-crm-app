import { TestBed } from '@angular/core/testing';

import { ProposalPdf } from './proposal-pdf';

describe('ProposalPdf', () => {
  let service: ProposalPdf;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProposalPdf);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
