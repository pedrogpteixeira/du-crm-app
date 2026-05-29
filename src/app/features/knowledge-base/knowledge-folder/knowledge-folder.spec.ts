import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KnowledgeFolder } from './knowledge-folder';

describe('KnowledgeFolder', () => {
  let component: KnowledgeFolder;
  let fixture: ComponentFixture<KnowledgeFolder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KnowledgeFolder],
    }).compileComponents();

    fixture = TestBed.createComponent(KnowledgeFolder);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
