import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KnowledgeBaseHome } from './knowledge-base-home';

describe('KnowledgeBaseHome', () => {
  let component: KnowledgeBaseHome;
  let fixture: ComponentFixture<KnowledgeBaseHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KnowledgeBaseHome],
    }).compileComponents();

    fixture = TestBed.createComponent(KnowledgeBaseHome);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
