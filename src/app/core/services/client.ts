import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type ClientContractProvider =
  | 'repsol'
  | 'portulogos'
  | 'wallbox'
  | 'yes-energy'
  | 'galp-power-gas'
  | 'galp-solar'
  | 'iberdrola'
  | 'iberdrola-solar'
  | 'meo-energias';

export interface ClientContractUser {
  id?: string;
  name?: string;
}

export interface ClientContract {
  id: string;
  clientId: string;
  companyId: string;
  provider: ClientContractProvider;

  estado?: string;
  tipoProduto?: string;
  tipoSegmento?: string;
  user?: ClientContractUser | null;

  createdAt?: string;
  updatedAt?: string;

  [key: string]: unknown;
}

export interface Client {
  id: string;
  name: string;
  nif: number;
  createdAt: string;
  updatedAt: string;

  email?: string | null;
  phone?: string | null;
  telefone?: string | null;
  address?: string | null;
  morada?: string | null;

  [key: string]: unknown;
}

export interface ClientDetails extends Client {
  contracts: ClientContract[];
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

  getClientById(clientId: string): Observable<ClientDetails> {
    return this.http.get<ClientDetails>(
      `${this.apiUrl}/api/clients/${encodeURIComponent(clientId)}`,
    );
  }

  getClientByNif(nif: number): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/api/clients/nif/${nif}`);
  }

  createClient(payload: CreateClientRequest): Observable<Client> {
    return this.http.post<Client>(`${this.apiUrl}/api/clients`, payload);
  }
}
