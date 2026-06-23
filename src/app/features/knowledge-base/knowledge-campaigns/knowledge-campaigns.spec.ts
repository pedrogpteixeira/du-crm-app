import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KnowledgeCampaigns } from './knowledge-campaigns';

describe('KnowledgeCampaigns', () => {
  let component: KnowledgeCampaigns;
  let fixture: ComponentFixture<KnowledgeCampaigns>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KnowledgeCampaigns],
    }).compileComponents();

    fixture = TestBed.createComponent(KnowledgeCampaigns);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
