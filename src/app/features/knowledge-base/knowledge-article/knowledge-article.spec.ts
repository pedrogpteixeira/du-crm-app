import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KnowledgeArticle } from './knowledge-article';

describe('KnowledgeArticle', () => {
  let component: KnowledgeArticle;
  let fixture: ComponentFixture<KnowledgeArticle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KnowledgeArticle],
    }).compileComponents();

    fixture = TestBed.createComponent(KnowledgeArticle);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
