import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { finalize, map, Observable, of, shareReplay, tap } from 'rxjs';

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
  private readonly cacheTtlMs = 60_000;

  private companiesCache: { value: Company[]; loadedAt: number } | null = null;
  private companiesRequest$: Observable<Company[]> | null = null;

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

    return this.getCompaniesCached();
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
    ).pipe(
      tap(() => this.invalidateCompaniesCache()),
    );
  }

  private getCompaniesCached(): Observable<Company[]> {
    if (
      this.companiesCache &&
      Date.now() - this.companiesCache.loadedAt < this.cacheTtlMs
    ) {
      return of(this.companiesCache.value);
    }

    if (this.companiesRequest$) {
      return this.companiesRequest$;
    }

    const request$ = this.getCompaniesFromApi().pipe(
      tap((companies) => {
        this.companiesCache = { value: companies, loadedAt: Date.now() };
      }),
      finalize(() => {
        if (this.companiesRequest$ === request$) {
          this.companiesRequest$ = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.companiesRequest$ = request$;
    return request$;
  }

  private invalidateCompaniesCache(): void {
    this.companiesCache = null;
    this.companiesRequest$ = null;
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
