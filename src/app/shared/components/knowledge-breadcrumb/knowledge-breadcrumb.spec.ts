import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KnowledgeBreadcrumb } from './knowledge-breadcrumb';

describe('KnowledgeBreadcrumb', () => {
  let component: KnowledgeBreadcrumb;
  let fixture: ComponentFixture<KnowledgeBreadcrumb>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KnowledgeBreadcrumb],
    }).compileComponents();

    fixture = TestBed.createComponent(KnowledgeBreadcrumb);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
