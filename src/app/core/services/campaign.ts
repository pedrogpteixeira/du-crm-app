import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment.development';

export interface Campaign {
  id: string;
  name: string;
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
}