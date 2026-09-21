import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { getContractProviderByCompanyId } from '../config/contract-detail-route';

interface ContractStatusResponse {
  estado?: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class ContractAccessService {
  private readonly http = inject(HttpClient);

  getContractStatus(companyId: string, contractId: string): Observable<string | null> {
    const provider = getContractProviderByCompanyId(companyId);

    if (!provider || !contractId) {
      return of(null);
    }

    return this.http
      .get<ContractStatusResponse>(
        `${environment.apiUrl}/api/contracts/${provider}/${encodeURIComponent(contractId)}`,
      )
      .pipe(
        map((contract) =>
          typeof contract?.estado === 'string' ? contract.estado : null,
        ),
      );
  }
}
