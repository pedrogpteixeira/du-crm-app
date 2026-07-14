import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Campaign {
  id: string;
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignRequest {
  companyId: string;
  name: string;
  active: boolean;
  startDate: string;
  endDate: string;
}

export interface UpdateCampaignRequest {
  active?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CampaignService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getCampaignsByCompanyId(companyId: string): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(
      `${this.apiUrl}/api/campaigns/company/${companyId}`,
    );
  }

  createCampaign(payload: CreateCampaignRequest): Observable<Campaign> {
    return this.http.post<Campaign>(
      `${this.apiUrl}/api/campaigns`,
      payload,
    );
  }

  updateCampaign(
    campaignId: string,
    payload: UpdateCampaignRequest,
  ): Observable<Campaign> {
    return this.http.patch<Campaign>(
      `${this.apiUrl}/api/campaigns/${campaignId}`,
      payload,
    );
  }

  deleteCampaign(campaignId: string) {
    return this.http.delete(
      `${this.apiUrl}/api/campaigns/${campaignId}`,
    );
  }
}