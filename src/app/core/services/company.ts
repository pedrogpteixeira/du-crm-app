import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  tap,
} from 'rxjs';

import { environment } from '../../../environments/environment';
import { canAccessB2BContracts, isRestrictedB2BCompany } from '../config/portulogos-b2b-access';
import { canAccessEdp, isEdpCompany } from '../config/edp-access';
import { Auth } from './auth';

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
  active?: boolean;
  supplyPointReentryDays?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly apiUrl = environment.apiUrl;
  private readonly cacheTtlMs = 60_000;

  private companiesCache: { value: Company[]; loadedAt: number } | null = null;
  private companiesRequest$: Observable<Company[]> | null = null;
  private readonly companiesSubject = new BehaviorSubject<Company[]>([]);

  /** Raw company state shared by the current browser session. */
  readonly companies$ = this.companiesSubject.asObservable();

  getCompanies(): Observable<Company[]> {
    return this.getCompaniesCached().pipe(
      map((companies) => this.filterRestrictedCompanies(companies)),
      catchError(() => of(this.filterRestrictedCompanies(this.getEnvironmentCompanies()))),
    );
  }

  /** Company list for contract creation: permissions + active status. */
  getActiveCompanies(): Observable<Company[]> {
    return this.getCompanies().pipe(map((companies) => companies.filter((company) => company.active)));
  }

  /**
   * Administrative Company management always uses persisted API data. The
   * successful response also refreshes the shared in-memory cache so other
   * components update without a manual page refresh.
   */
  getCompaniesFromApi(): Observable<Company[]> {
    return this.http.get<CompanyApiResponse[]>(`${this.apiUrl}/api/companies`).pipe(
      map((companies) => companies.map((company) => this.normalizeCompany(company))),
      tap((companies) => this.setCompaniesCache(companies)),
    );
  }

  updateCompany(
    companyId: string,
    payload: UpdateCompanyRequest,
  ): Observable<Partial<Company> | null> {
    return this.http
      .patch<Partial<Company> | null>(`${this.apiUrl}/api/companies/${companyId}`, payload)
      .pipe(
        tap((response) => {
          this.patchCompanyInCache(companyId, {
            ...payload,
            ...(response ?? {}),
          });
        }),
      );
  }

  getCompanyActiveSnapshot(companyId: string): boolean | null {
    const company = this.findCompanySnapshot(companyId);
    return company ? company.active : null;
  }

  isCompanyActive(companyId: string): Observable<boolean> {
    const snapshot = this.getCompanyActiveSnapshot(companyId);

    if (snapshot !== null) {
      return of(snapshot);
    }

    return this.getCompaniesCached().pipe(
      map((companies) => this.findCompany(companies, companyId)?.active ?? true),
      catchError(() => of(true)),
    );
  }

  /** Used after a COMPANY_INACTIVE response to immediately synchronize the UI. */
  markCompanyInactive(companyId: string): void {
    this.patchCompanyInCache(companyId, { active: false });
  }

  private getCompaniesCached(): Observable<Company[]> {
    if (this.companiesCache && Date.now() - this.companiesCache.loadedAt < this.cacheTtlMs) {
      return of(this.companiesCache.value);
    }

    if (this.companiesRequest$) {
      return this.companiesRequest$;
    }

    const request$ = this.http.get<CompanyApiResponse[]>(`${this.apiUrl}/api/companies`).pipe(
      map((companies) => companies.map((company) => this.normalizeCompany(company))),
      tap((companies) => this.setCompaniesCache(companies)),
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

  private filterRestrictedCompanies(companies: Company[]): Company[] {
    const user = this.auth.getCurrentUser();
    const canAccessB2B = canAccessB2BContracts(user);
    const canAccessEdpCompanies = canAccessEdp(user);

    return companies.filter((company) => {
      const companyId = company.domainId || company.id;

      if (isRestrictedB2BCompany(companyId) && !canAccessB2B) {
        return false;
      }

      if (isEdpCompany(companyId) && !canAccessEdpCompanies) {
        return false;
      }

      return true;
    });
  }

  private setCompaniesCache(companies: Company[]): void {
    const value = companies.map((company) => ({ ...company }));
    this.companiesCache = { value, loadedAt: Date.now() };
    this.companiesSubject.next(value);
  }

  private patchCompanyInCache(companyId: string, patch: Partial<Company>): void {
    const current = this.companiesCache?.value.length
      ? this.companiesCache.value
      : this.companiesSubject.value.length
        ? this.companiesSubject.value
        : this.getEnvironmentCompanies();

    let found = false;
    const next = current.map((company) => {
      if (!this.matchesCompanyId(company, companyId)) {
        return company;
      }

      found = true;
      return this.normalizeCompany({ ...company, ...patch });
    });

    if (!found) {
      // Keep an unknown backend company out of the cache rather than inventing
      // its name/metadata. A later GET /api/companies will reconcile it.
      this.companiesCache = null;
      return;
    }

    this.setCompaniesCache(next);
  }

  private findCompanySnapshot(companyId: string): Company | null {
    const companies = this.companiesCache?.value ?? this.companiesSubject.value;
    return this.findCompany(companies, companyId);
  }

  private findCompany(companies: Company[], companyId: string): Company | null {
    return companies.find((company) => this.matchesCompanyId(company, companyId)) ?? null;
  }

  private matchesCompanyId(company: Company, companyId: string): boolean {
    return company.id === companyId || company.domainId === companyId;
  }

  private getEnvironmentCompanies(): Company[] {
    return (environment.companies ?? []).map((company) =>
      this.normalizeCompany({
        ...company,
        domainId: company.id,
        supplyPointReentryDays: null,
      }),
    );
  }

  private normalizeCompany(company: CompanyApiResponse): Company {
    const domainId = company.domainId ?? company.id ?? '';

    return {
      id: company.id ?? domainId,
      domainId,
      name: company.name,
      // Backwards compatibility: only an explicit false means inactive.
      active: company.active !== false,
      supplyPointReentryDays: company.supplyPointReentryDays ?? null,
    };
  }
}
