import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export const SUPPLY_POINT_PREFLIGHT_PROVIDERS = [
  'repsol',
  'galp-power-gas',
  'iberdrola',
  'yes-energy',
  'meo-energias',
  'vodafone',
  'portulogos',
] as const;

export type ContractPreflightProvider = (typeof SUPPLY_POINT_PREFLIGHT_PROVIDERS)[number];
export type ContractPreflightProductType = 'Luz' | 'Luz + Gás' | 'Gás';

export interface ContractPreflightRequest {
  companyId: string;
  tipoProduto: ContractPreflightProductType;
  cpe?: string;
  cui?: string;
}

export interface ContractPreflightError {
  code: string;
  message: string;
}

export interface SupplyPointReentryWarning {
  code: 'supply-point-reentry-window';
  supplyPointType: 'CPE' | 'CUI';
  identifier: string;
  previousContractId: string;
  previousClientName?: string;
  referenceDate: string;
  referenceDateSource: 'deactivation' | 'activation';
  requiredDays: number;
  elapsedDays: number;
  remainingDays: number;
  eligibleAt: string;
  message: string;
}

export interface ContractPreflightResponse {
  canProceed: boolean;
  warnings: SupplyPointReentryWarning[];
  errors: ContractPreflightError[];
}

/**
 * The final POST keeps returning the created contract itself. The backend may
 * append the same validation metadata after re-checking the supply point.
 */
export type ContractCreationResponse<TContract> = TContract & {
  canProceed?: boolean;
  warnings?: SupplyPointReentryWarning[];
  errors?: ContractPreflightError[];
};

export interface ContractPreflightSource {
  companyId: string;
  tipoProduto: ContractPreflightProductType;
  cpe?: string | null;
  cui?: string | null;
}

export function supportsContractPreflight(provider: string): provider is ContractPreflightProvider {
  return (SUPPLY_POINT_PREFLIGHT_PROVIDERS as readonly string[]).includes(provider);
}

export function buildContractPreflightRequest(
  source: ContractPreflightSource,
): ContractPreflightRequest {
  const payload: ContractPreflightRequest = {
    companyId: source.companyId,
    tipoProduto: source.tipoProduto,
  };

  if (source.tipoProduto !== 'Gás') {
    const cpe = source.cpe?.trim();
    if (cpe) {
      payload.cpe = cpe;
    }
  }

  if (source.tipoProduto !== 'Luz') {
    const cui = source.cui?.trim();
    if (cui) {
      payload.cui = cui;
    }
  }

  return payload;
}


export function getNewSupplyPointReentryWarnings(
  finalWarnings: SupplyPointReentryWarning[],
  preflightWarnings: SupplyPointReentryWarning[],
): SupplyPointReentryWarning[] {
  const preflightKeys = new Set(preflightWarnings.map(buildWarningIdentity));

  return finalWarnings.filter((warning) => !preflightKeys.has(buildWarningIdentity(warning)));
}

function buildWarningIdentity(warning: SupplyPointReentryWarning): string {
  return [
    warning.code,
    warning.supplyPointType,
    warning.identifier,
    warning.previousContractId,
    warning.referenceDate,
    warning.referenceDateSource,
    warning.requiredDays,
    warning.eligibleAt,
  ].join('|');
}

@Injectable({ providedIn: 'root' })
export class ContractPreflightService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  preflightContract(
    provider: ContractPreflightProvider,
    payload: ContractPreflightRequest,
  ): Observable<ContractPreflightResponse> {
    return this.http.post<ContractPreflightResponse>(
      `${this.apiUrl}/api/contracts/${provider}/preflight`,
      payload,
    );
  }
}
