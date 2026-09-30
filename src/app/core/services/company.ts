import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Company {
  id: string;
  domainId: string;
  name: string;
  active: boolean;
  supplyPointReentryDays: number | null;
}

export interface UpdateCompanyRequest {
  active?: boolean;
  supplyPointReentryDays?: number | null;
}

interface CompanyApiResponse {
  id?: string;
  domainId?: string;
  name: string;
  active: boolean;
  supplyPointReentryDays?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getCompanies(): Observable<Company[]> {
    const environmentCompanies = environment.companies ?? [];

    if (environmentCompanies.length > 0) {
      return of(
        environmentCompanies.map((company) =>
          this.normalizeCompany({
            ...company,
            domainId: company.id,
            supplyPointReentryDays: null,
          }),
        ),
      );
    }

    return this.getCompaniesFromApi();
  }

  /**
   * Administrative Company management must use the persisted API data rather
   * than the static environment fallback used by the rest of the frontend.
   */
  getCompaniesFromApi(): Observable<Company[]> {
    return this.http
      .get<CompanyApiResponse[]>(`${this.apiUrl}/api/companies`)
      .pipe(map((companies) => companies.map((company) => this.normalizeCompany(company))));
  }

  updateCompany(
    companyId: string,
    payload: UpdateCompanyRequest,
  ): Observable<Partial<Company> | null> {
    return this.http.patch<Partial<Company> | null>(
      `${this.apiUrl}/api/companies/${companyId}`,
      payload,
    );
  }

  private normalizeCompany(company: CompanyApiResponse): Company {
    const domainId = company.domainId ?? company.id ?? '';

    return {
      id: company.id ?? domainId,
      domainId,
      name: company.name,
      active: company.active,
      supplyPointReentryDays: company.supplyPointReentryDays ?? null,
    };
  }
}
