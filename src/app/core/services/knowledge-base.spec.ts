import { TestBed } from '@angular/core/testing';

import { KnowledgeBase } from './knowledge-base';

describe('KnowledgeBase', () => {
  let service: KnowledgeBase;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KnowledgeBase);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
