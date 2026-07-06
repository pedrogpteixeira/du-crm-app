import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { ProposalData } from './proposal-document.types';

interface ProposalTheme {
  name: string;

  logo: string;

  primary: string;
  secondary: string;
  light: string;

  coverGradient: string;
  savingCard: string;

  accentIcon: string;

  fontColor: string;
}

@Component({
  selector: 'app-proposal-document',
  imports: [CommonModule],
  templateUrl: './proposal-document.html',
  styleUrl: './proposal-document.scss',
})
export class ProposalDocument {
  @Input({ required: true }) proposal!: ProposalData;

  get theme(): ProposalTheme {
    const provider = this.normalizeProviderName(
      this.proposal.offer.tariff.provider.name,
    );

    console.log('Provider:', provider);

    const themes: Record<string, ProposalTheme> = {
      repsol: {
        name: 'Repsol',
        logo: 'assets/companies/repsol.png',
        primary: '#ff7a00',
        secondary: '#18a957',
        light: '#c8f3e9',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      'meo energias': {
        name: 'MEO Energia',
        logo: 'assets/companies/meo.png',
        primary: '#0050a4',
        secondary: '#00b8d9',
        light: '#eaf6ff',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      meo: {
        name: 'MEO Energia',
        logo: 'assets/companies/meo.png',
        primary: '#0050a4',
        secondary: '#00b8d9',
        light: '#eaf6ff',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      galp: {
        name: 'Galp',
        logo: 'assets/companies/galp.png',
        primary: '#f36f21',
        secondary: '#ff8a00',
        light: '#fff1e7',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      iberdrola: {
        name: 'Iberdrola',
        logo: 'assets/companies/iberdrola.png',
        primary: '#00843d',
        secondary: '#7ab800',
        light: '#edf8ef',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      'yes energy': {
        name: 'Yes Energy',
        logo: 'assets/companies/yes.png',
        primary: '#6b21a8',
        secondary: '#9333ea',
        light: '#f3e8ff',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      endesa: {
        name: 'Endesa',
        logo: 'assets/companies/endesa.png',
        primary: '#005eb8',
        secondary: '#00a3e0',
        light: '#eaf6ff',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      portulogos: {
        name: 'Portulogos',
        logo: 'assets/companies/portulogos.png',
        primary: '#0066a4',
        secondary: '#00a7d8',
        light: '#eaf8ff',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      'nossa energia': {
        name: 'Nossa Energia',
        logo: 'assets/companies/nossa-energia.png',
        primary: '#e53935',
        secondary: '#f6a800',
        light: '#fff5e5',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      ezu: {
        name: 'Ezu',
        logo: 'assets/companies/ezu.png',
        primary: '#E30613',
        secondary: '#C80012',
        light: '#FDEBEC',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      audax: {
        name: 'Audax',
        logo: 'assets/companies/audax.png',
        primary: '#d71920',
        secondary: '#f37021',
        light: '#fff1ec',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },

      plenitude: {
        name: 'Plenitude',
        logo: 'assets/companies/plenitude.png',
        primary: '#006b3f',
        secondary: '#b7d800',
        light: '#f3fae8',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      },
    };

    return (
      themes[provider] || {
        name: this.proposal.offer.tariff.provider.name,
        logo: 'assets/companies/default.png',
        primary: '#008db1',
        secondary: '#00b894',
        light: '#eef6fa',
        coverGradient: '',
        savingCard: '',
        accentIcon: '',
        fontColor: '#243646',
      }
    );
  }

  private normalizeProviderName(provider?: string): string {
    return (provider || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
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

  getSegmentLabel(value?: string): string {
    const labels: Record<string, string> = {
      business: 'Empresa',
      residential: 'Cliente particular',
      condominium: 'Condomínio',
    };

    return value ? labels[value] || value : 'Cliente';
  }

  getCoverTitle(): string {
    const segment = this.proposal.offer.tariff.segment;

    const titles: Record<string, string> = {
      business: 'A energia certa\npara o seu negócio.',
      residential: 'A energia certa\npara a sua casa.',
      condominium: 'A energia certa\npara o seu condomínio.',
    };

    return titles[segment || ''] || 'A energia certa\npara si.';
  }

  getCoverIntro(): string {
    const segment = this.proposal.offer.tariff.segment;

    const intros: Record<string, string> = {
      business:
        'Proposta personalizada com base na fatura atual e nos consumos indicados para o seu negócio.',
      residential:
        'Proposta personalizada com base na fatura atual e nos consumos indicados para a sua casa.',
      condominium:
        'Proposta personalizada com base na fatura atual e nos consumos indicados para o seu condomínio.',
    };

    return (
      intros[segment || ''] ||
      'Proposta personalizada com base na fatura atual e nos consumos indicados.'
    );
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