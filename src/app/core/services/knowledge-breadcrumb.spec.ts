import { TestBed } from '@angular/core/testing';

import { KnowledgeBreadcrumb } from './knowledge-breadcrumb';

describe('KnowledgeBreadcrumb', () => {
  let service: KnowledgeBreadcrumb;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KnowledgeBreadcrumb);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
