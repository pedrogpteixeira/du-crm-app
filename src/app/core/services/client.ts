import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Client {
  id: string;
  name: string;
  nif: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientRequest {
  name: string;
  nif: number;
}

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getClientByNif(nif: number): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/api/clients/nif/${nif}`);
  }

  createClient(payload: CreateClientRequest): Observable<Client> {
    return this.http.post<Client>(`${this.apiUrl}/api/clients`, payload);
  }
}