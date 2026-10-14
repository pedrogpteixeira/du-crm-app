import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import {
  CreateSimulationCalculationProfileRequest,
  CreateSimulationCalculationProfileVersionRequest,
  InvoiceComparisonRequest,
  SimulatorService,
} from './simulator';

describe('SimulatorService', () => {
  let service: SimulatorService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(SimulatorService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads calculation profiles from the simulator API', () => {
    service.getCalculationProfiles().subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/api/simulator/calculation-profiles`,
    );

    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('reuses the cached calculation profile list without repeating the GET', () => {
    const url = `${environment.apiUrl}/api/simulator/calculation-profiles`;
    const profiles = [
      {
        id: 'scp_123',
        familyCode: 'example',
        commercializerId: 'cmp_1',
        productType: 'electricity' as const,
        commissionMode: 'team_table' as const,
        active: true,
        version: 1,
      },
    ];

    service.getCalculationProfiles().subscribe();
    httpTesting.expectOne(url).flush(profiles);

    let cachedProfiles: unknown;
    service.getCalculationProfiles().subscribe((value) => {
      cachedProfiles = value;
    });

    httpTesting.expectNone(url);
    expect(cachedProfiles).toEqual(profiles);
  });

  it('bypasses the calculation profile cache when a refresh is forced', () => {
    const url = `${environment.apiUrl}/api/simulator/calculation-profiles`;

    service.getCalculationProfiles().subscribe();
    httpTesting.expectOne(url).flush([]);

    service.getCalculationProfiles(true).subscribe();
    const refreshedRequest = httpTesting.expectOne(url);

    expect(refreshedRequest.request.method).toBe('GET');
    refreshedRequest.flush([]);
  });

  it('invalidates the calculation profile list cache after an update', () => {
    const listUrl = `${environment.apiUrl}/api/simulator/calculation-profiles`;
    const detailUrl = `${listUrl}/scp_123`;
    const profile = {
      id: 'scp_123',
      familyCode: 'example',
      commercializerId: 'cmp_1',
      productType: 'electricity' as const,
      commissionMode: 'team_table' as const,
      active: true,
      version: 1,
    };

    service.getCalculationProfiles().subscribe();
    httpTesting.expectOne(listUrl).flush([profile]);

    service.updateCalculationProfile('scp_123', { active: false }).subscribe();
    httpTesting.expectOne(detailUrl).flush({ ...profile, active: false });

    service.getCalculationProfiles().subscribe();
    const refreshedList = httpTesting.expectOne(listUrl);

    expect(refreshedList.request.method).toBe('GET');
    refreshedList.flush([{ ...profile, active: false }]);
  });

  it('forwards aggregate and interval consumption together without transforming the payload', () => {
    const payload: InvoiceComparisonRequest = {
      productType: 'electricity',
      tariffType: 'tri_hourly',
      currentInvoiceAmount: 120,
      electricityConsumptionKwh: 420,
      electricityConsumption: {
        ponta: 100,
        cheias: 220,
        vazio: 100,
      },
      electricityConsumptionProfile: {
        source: 'customer_profile',
        intervalMinutes: 15,
        intervals: [
          {
            startAt: '2026-10-14T00:00:00+01:00',
            consumptionKwh: 0.25,
          },
        ],
      },
    };

    service.compareInvoice(payload).subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/api/simulator/invoice-compare`,
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({
      current: {
        invoiceAmount: 120,
        days: 30,
      },
      offers: [],
    });
  });

  it('preserves false included-component flags when creating a calculation profile', () => {
    const payload: CreateSimulationCalculationProfileRequest = {
      familyCode: 'indexed-electricity',
      commercializerId: 'cmp_1',
      productType: 'electricity',
      includedComponents: {
        networkAccessPower: false,
        networkAccessEnergy: true,
        losses: false,
        renSystemCosts: true,
        mfrr: false,
        guaranteesOfOrigin: false,
        socialTariffFinancing: false,
      },
    };

    service.createCalculationProfile(payload).subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/api/simulator/calculation-profiles`,
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({
      id: 'scp_200',
      ...payload,
      commissionMode: 'team_table',
      active: true,
      version: 1,
    });
  });

  it('creates a new calculation profile version through the version endpoint', () => {
    const payload: CreateSimulationCalculationProfileVersionRequest = {
      active: true,
    };

    service
      .createCalculationProfileVersion('scp_123', payload)
      .subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/api/simulator/calculation-profiles/scp_123/versions`,
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({
      id: 'scp_124',
      familyCode: 'example',
      commercializerId: 'cmp_1',
      productType: 'electricity',
      commissionMode: 'team_table',
      active: true,
      version: 2,
      previousVersionId: 'scp_123',
    });
  });
});
