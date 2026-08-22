import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type TeamCommissionSegment =
  | 'residential'
  | 'business'
  | 'condominium';

export interface ElectricityPowerCommission {
  powerKva: number;
  commission: number;
}

export interface TeamCommission {
  id: string;

  teamId: string;
  companyId: string;

  segment: TeamCommissionSegment;

  electricityCommission: number;

  electricityPowerCommissions:
    ElectricityPowerCommission[];

  gasCommission: number;

  directDebitCommission: number;
  electronicInvoiceCommission: number;

  SVACommission: number;

  PELCommission: number;
  PGICommission: number;
  MGICommission: number;
  PELPlusCommission: number;

  active: boolean;

  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTeamCommissionRequest {
  teamId: string;
  companyId: string;

  segment: TeamCommissionSegment;

  electricityCommission: number;

  electricityPowerCommissions:
    ElectricityPowerCommission[];

  gasCommission: number;

  directDebitCommission: number;
  electronicInvoiceCommission: number;

  SVACommission: number;

  PELCommission: number;
  PGICommission: number;
  MGICommission: number;
  PELPlusCommission: number;
}

export interface UpdateTeamCommissionRequest {
  companyId?: string;

  segment?: TeamCommissionSegment;

  electricityCommission?: number;

  electricityPowerCommissions?:
    ElectricityPowerCommission[];

  gasCommission?: number;

  directDebitCommission?: number;
  electronicInvoiceCommission?: number;

  SVACommission?: number;

  PELCommission?: number;
  PGICommission?: number;
  MGICommission?: number;
  PELPlusCommission?: number;

  active?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class TeamCommissionService {
  private readonly http =
    inject(HttpClient);

  private readonly baseUrl =
    `${environment.apiUrl}/api/team-commissions`;

  getAll(): Observable<TeamCommission[]> {
    return this.http.get<TeamCommission[]>(
      this.baseUrl,
    );
  }

  getById(
    id: string,
  ): Observable<TeamCommission> {
    return this.http.get<TeamCommission>(
      `${this.baseUrl}/${id}`,
    );
  }

  getByTeamId(
    teamId: string,
  ): Observable<TeamCommission[]> {
    return this.http.get<TeamCommission[]>(
      `${this.baseUrl}/team/${teamId}`,
    );
  }

  create(
    payload: CreateTeamCommissionRequest,
  ): Observable<TeamCommission> {
    return this.http.post<TeamCommission>(
      this.baseUrl,
      payload,
    );
  }

  update(
    id: string,
    payload: UpdateTeamCommissionRequest,
  ): Observable<TeamCommission> {
    return this.http.patch<TeamCommission>(
      `${this.baseUrl}/${id}`,
      payload,
    );
  }

  delete(
    id: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${id}`,
    );
  }
}