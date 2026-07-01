import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { ProposalData } from './proposal-document.types';

@Component({
  selector: 'app-proposal-document',
  imports: [CommonModule],
  templateUrl: './proposal-document.html',
  styleUrl: './proposal-document.scss',
})
export class ProposalDocument {
  @Input({ required: true }) proposal!: ProposalData;

  get theme() {
    const provider = this.proposal.offer.tariff.provider.name;

    if (provider === 'Meo Energias' || provider === 'MEO') {
      return {
        logo: 'assets/companies/meo.png',
        primary: '#0050a4',
        secondary: '#00b8d9',
        light: '#eaf6ff',
        name: 'MEO Energia',
      };
    }

    return {
      logo: 'assets/companies/repsol.png',
      primary: '#ff7a00',
      secondary: '#18a957',
      light: '#c8f3e9',
      name: 'Repsol',
    };
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value || 0);
  }

  formatDate(date = new Date()): string {
    return new Intl.DateTimeFormat('pt-PT').format(date);
  }

  getProductLabel(value?: string): string {
    const labels: Record<string, string> = {
      electricity: 'Eletricidade',
      gas: 'Gás',
      dual: 'Luz + Gás',
    };

    return value ? labels[value] || value : '—';
  }

  getTariffLabel(value?: string): string {
    const labels: Record<string, string> = {
      simple: 'Simples',
      bi_hourly: 'Bi-horário',
      tri_hourly: 'Tri-horário',
      tetra_hourly: 'Tetra-horário',
    };

    return value ? labels[value] || value : '—';
  }

  formatPrice(value?: number, suffix = '€/kWh'): string {
    if (value === undefined || value === null) {
      return '—';
    }

    return `${new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value)} ${suffix}`;
  }
}