import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvoiceComparisonOffer } from '../../../core/services/simulator';

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
  it('includes the calculation basis in proposal pricing metadata', () => {
    const offer = {
      tariff: {
        id: 'tariff-1',
        provider: { id: 'provider-1', name: 'Provider' },
        name: 'Tarifa',
        productType: 'electricity',
        calculationProfileId: 'profile-1',
        active: true,
      },
      simulation: {
        estimatedMonthlyCost: 90,
        calculationBasis: 'daily_average',
        estimated: true,
        details: {
          days: 30,
          fixedCost: 10,
          energyCostBeforeDiscount: 80,
          discountValue: 0,
          energyCost: 80,
          totalCost: 90,
        },
      },
      comparison: {
        monthlySaving: 10,
        yearlySaving: 120,
        savingPercentage: 10,
        isBetterOffer: true,
      },
    } satisfies InvoiceComparisonOffer;

    component.proposal = {
      offer,
      current: {
        invoiceAmount: 100,
        days: 30,
      },
      client: {
        name: 'Cliente',
        nif: '123456789',
        email: 'cliente@example.com',
        phone: '910000000',
        address: 'Morada',
      },
      commercial: {
        name: 'Comercial',
        email: 'comercial@example.com',
        phone: '910000001',
      },
    };

    expect(component.getCalculationBasisLabel()).toBe('Estimativa baseada em média diária');
    expect(component.getPricingMetadataItems()).toContain({
      label: 'Base do cálculo',
      value: 'Estimativa baseada em média diária',
    });
  });
});
