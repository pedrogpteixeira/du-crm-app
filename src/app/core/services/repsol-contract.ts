import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment.development';

export type RepsolContractStatus =
  | 'Pedido de Chamada'
  | 'Em validação'
  | 'Chamada Efetuada'
  | 'Pendente Assinatura Digital'
  | 'Não Conformidade'
  | 'Pendente Docs'
  | 'Documentos Enviados'
  | 'Atribuído';

export interface RepsolContract {
  id: string;
  clientId: string;
  nomeClienteEmpresa: string;
  nif: number;
  estado: RepsolContractStatus;
  cpe: string;
  cui: string;
}

@Injectable({
  providedIn: 'root',
})
export class RepsolContractService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getRepsolContracts(): Observable<RepsolContract[]> {
    return this.http.get<RepsolContract[]>(
      `${this.apiUrl}/api/contracts/repsol`,
    );
  }
}