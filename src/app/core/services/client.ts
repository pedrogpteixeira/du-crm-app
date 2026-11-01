import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { canAccessPortulogosB2B, isPortulogosB2BCompany } from '../config/portulogos-b2b-access';
import { Auth } from './auth';

export type ClientContractProvider =
  | 'repsol'
  | 'portulogos'
  | 'portulogos-b2b'
  | 'wallbox'
  | 'yes-energy'
  | 'galp-power-gas'
  | 'galp-solar'
  | 'iberdrola'
  | 'iberdrola-solar'
  | 'meo-energias'
  | 'vodafone';

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
  private readonly auth = inject(Auth);
  private readonly apiUrl = environment.apiUrl;

  getClientById(clientId: string): Observable<ClientDetails> {
    return this.http
      .get<ClientDetails>(`${this.apiUrl}/api/clients/${encodeURIComponent(clientId)}`)
      .pipe(
        map((client) => {
          if (canAccessPortulogosB2B(this.auth.getCurrentUser())) {
            return client;
          }

          return {
            ...client,
            contracts: (client.contracts ?? []).filter(
              (contract) => !isPortulogosB2BCompany(contract.companyId),
            ),
          };
        }),
      );
  }

  getClientByNif(nif: number): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/api/clients/nif/${nif}`);
  }

  createClient(payload: CreateClientRequest): Observable<Client> {
    return this.http.post<Client>(`${this.apiUrl}/api/clients`, payload);
  }
}
