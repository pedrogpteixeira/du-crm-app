import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  Client,
  ClientService,
} from '../../../core/services/client';

@Component({
  selector: 'app-repsol-contract-create',
  imports: [CommonModule, FormsModule],
  templateUrl: './repsol-contract-create.html',
  styleUrl: './repsol-contract-create.scss',
})
export class RepsolContractCreate {
  private readonly clientService = inject(ClientService);

  nif: number | null = null;
  clientName = '';

  client: Client | null = null;

  isCheckingClient = false;
  isCreatingClient = false;

  clientChecked = false;
  clientNotFound = false;

  errorMessage = '';
  successMessage = '';

  checkClientByNif(): void {
    if (!this.nif) {
      this.errorMessage = 'O NIF é obrigatório.';
      return;
    }

    this.isCheckingClient = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.client = null;
    this.clientChecked = false;
    this.clientNotFound = false;

    this.clientService.getClientByNif(this.nif).subscribe({
      next: (client) => {
        this.client = client;
        this.clientName = client.name;
        this.clientChecked = true;
        this.clientNotFound = false;
        this.successMessage = 'Cliente encontrado.';
      },
      error: (error) => {
        this.clientChecked = true;

        if (error?.status === 404) {
          this.clientNotFound = true;
          this.client = null;
          this.clientName = '';
          return;
        }

        this.errorMessage = 'Não foi possível verificar o cliente.';
      },
      complete: () => {
        this.isCheckingClient = false;
      },
    });
  }

  createClient(): void {
    if (!this.nif || !this.clientName.trim()) {
      this.errorMessage = 'O NIF e o nome do cliente são obrigatórios.';
      return;
    }

    this.isCreatingClient = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.clientService
      .createClient({
        name: this.clientName.trim(),
        nif: this.nif,
      })
      .subscribe({
        next: (client) => {
          this.client = client;
          this.clientName = client.name;
          this.clientNotFound = false;
          this.clientChecked = true;
          this.successMessage = 'Cliente criado com sucesso.';
        },
        error: () => {
          this.errorMessage = 'Não foi possível criar o cliente.';
        },
        complete: () => {
          this.isCreatingClient = false;
        },
      });
  }
}