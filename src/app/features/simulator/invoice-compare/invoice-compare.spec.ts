import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { Auth } from '../../../core/services/auth';
import {
  InvoiceComparisonOffer,
  InvoiceComparisonRequest,
  SimulatorService,
} from '../../../core/services/simulator';
import { ToastService } from '../../../core/services/toast';

import { InvoiceCompare } from './invoice-compare';

describe('InvoiceCompare', () => {
  let component: InvoiceCompare;
  let fixture: ComponentFixture<InvoiceCompare>;
  let simulatorService: jasmine.SpyObj<SimulatorService>;

  beforeEach(async () => {
    simulatorService = jasmine.createSpyObj<SimulatorService>('SimulatorService', [
      'compareInvoice',
      'getCalculationProfiles',
    ]);

    simulatorService.compareInvoice.and.returnValue(
      of({
        current: {
          invoiceAmount: 100,
          days: 30,
        },
        offers: [],
      }),
    );
    simulatorService.getCalculationProfiles.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [InvoiceCompare],
      providers: [
        {
          provide: SimulatorService,
          useValue: simulatorService,
        },
        {
          provide: Auth,
          useValue: {
            roleIncludes: () => false,
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate'),
          },
        },
        {
          provide: ToastService,
          useValue: {
            error: jasmine.createSpy('error'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoiceCompare);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sends aggregate electricity consumption without requiring intervals', () => {
    component.form.currentInvoiceAmount = 100;
    component.form.electricityConsumptionKwh = 320;
    component.includeElectricityConsumptionProfile = false;

    component.compareInvoice();

    expect(simulatorService.compareInvoice).toHaveBeenCalledTimes(1);

    const payload = simulatorService.compareInvoice.calls.mostRecent()
      .args[0] as InvoiceComparisonRequest;

    expect(payload.electricityConsumptionKwh).toBe(320);
    expect(payload.electricityConsumptionProfile).toBeUndefined();
  });

  it('sends tariff-period consumptions and intervals together', () => {
    component.form.currentInvoiceAmount = 100;
    component.form.tariffType = 'tri_hourly';
    component.onTariffTypeChange();

    component.form.ponta = 40;
    component.form.cheias = 120;
    component.form.vazio = 80;

    component.includeElectricityConsumptionProfile = true;
    component.form.electricityConsumptionProfile.intervalMinutes = 60;
    component.form.electricityConsumptionProfile.intervalsText = [
      '2026-10-01T00:00;1,25;vazio',
      '2026-10-01T01:00;0,92;vazio',
    ].join('\n');

    component.compareInvoice();

    expect(simulatorService.compareInvoice).toHaveBeenCalledTimes(1);

    const payload = simulatorService.compareInvoice.calls.mostRecent()
      .args[0] as InvoiceComparisonRequest;

    expect(payload.electricityConsumption).toEqual({
      ponta: 40,
      cheias: 120,
      vazio: 80,
    });
    expect(payload.electricityConsumptionProfile?.intervals).toEqual([
      {
        startAt: '2026-10-01T00:00',
        consumptionKwh: 1.25,
        tariffPeriod: 'vazio',
      },
      {
        startAt: '2026-10-01T01:00',
        consumptionKwh: 0.92,
        tariffPeriod: 'vazio',
      },
    ]);
  });

  it('presents calculation basis metadata returned by the backend', () => {
    const offer = {
      tariff: {
        id: 'tariff-1',
        provider: { id: 'provider-1', name: 'Provider' },
        name: 'Tarifa',
        productType: 'electricity',
        active: true,
      },
      simulation: {
        estimatedMonthlyCost: 90,
        calculationBasis: 'monthly_average',
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

    expect(component.getCalculationBasisLabel(offer)).toBe('Estimativa baseada em média mensal');
    expect(component.isEstimatedCalculation(offer)).toBeTrue();
  });

  it('shows every included-component flag returned by advanced pricing', () => {
    const offer = {
      tariff: {
        id: 'tariff-advanced',
        provider: { id: 'provider-1', name: 'Provider' },
        name: 'Advanced',
        productType: 'dual',
        calculationProfileId: 'profile-1',
        active: true,
      },
      simulation: {
        estimatedMonthlyCost: 90,
        details: {
          days: 30,
          fixedCost: 10,
          energyCostBeforeDiscount: 80,
          discountValue: 0,
          energyCost: 80,
          totalCost: 90,
        },
      },
      pricingBreakdown: {
        includedComponents: {
          networkAccessPower: true,
          networkAccessFixedTerm: false,
          networkAccessEnergy: true,
          losses: false,
          renSystemCosts: true,
        },
      },
      comparison: {
        monthlySaving: 10,
        yearlySaving: 120,
        savingPercentage: 10,
        isBetterOffer: true,
      },
    } satisfies InvoiceComparisonOffer;

    expect(component.getIncludedComponentStatuses(offer)).toEqual([
      { label: 'TAR de potência', included: true },
      { label: 'Termo fixo TAR gás', included: false },
      { label: 'TAR de energia', included: true },
      { label: 'Perdas', included: false },
      { label: 'REN / ERC', included: true },
    ]);
  });

  it('does not let intervals replace required tariff-period consumptions', () => {
    component.form.currentInvoiceAmount = 100;
    component.form.tariffType = 'tri_hourly';
    component.onTariffTypeChange();

    component.form.ponta = 40;
    component.form.cheias = null;
    component.form.vazio = 80;

    component.includeElectricityConsumptionProfile = true;
    component.form.electricityConsumptionProfile.intervalMinutes = 60;
    component.form.electricityConsumptionProfile.intervalsText = '2026-10-01T00:00;1,25;vazio';

    component.compareInvoice();

    expect(simulatorService.compareInvoice).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('Cheias');
  });
});
