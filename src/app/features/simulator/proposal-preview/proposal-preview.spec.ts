import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalPreview } from './proposal-preview';

describe('ProposalPreview', () => {
  let component: ProposalPreview;
  let fixture: ComponentFixture<ProposalPreview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProposalPreview],
    }).compileComponents();

    fixture = TestBed.createComponent(ProposalPreview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
