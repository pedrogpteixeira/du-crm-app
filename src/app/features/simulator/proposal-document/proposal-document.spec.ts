import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalDocument } from './proposal-document';

describe('ProposalDocument', () => {
  let component: ProposalDocument;
  let fixture: ComponentFixture<ProposalDocument>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProposalDocument],
    }).compileComponents();

    fixture = TestBed.createComponent(ProposalDocument);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
