import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment.development';

import {
  CreateUserCompanyCommissionRequest,
  UpdateUserCompanyCommissionRequest,
  UserCompanyCommission,
} from '../models/user-company-commission.model';

@Injectable({
  providedIn: 'root',
})
export class UserCompanyCommissionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getByUserId(
    userId: string,
  ): Observable<UserCompanyCommission[]> {
    return this.http.get<UserCompanyCommission[]>(
      `${this.apiUrl}/api/user-company-commissions/user/${userId}`,
    );
  }

  create(
    payload: CreateUserCompanyCommissionRequest,
  ): Observable<UserCompanyCommission> {
    return this.http.post<UserCompanyCommission>(
      `${this.apiUrl}/api/user-company-commissions`,
      payload,
    );
  }

  update(
    commissionId: string,
    payload: UpdateUserCompanyCommissionRequest,
  ): Observable<UserCompanyCommission> {
    return this.http.patch<UserCompanyCommission>(
      `${this.apiUrl}/api/user-company-commissions/${commissionId}`,
      payload,
    );
  }
}