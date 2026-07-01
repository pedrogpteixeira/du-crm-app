import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../../core/services/auth';
import { ProposalPdfService } from '../../../core/services/proposal-pdf';

@Component({
  selector: 'app-proposal-preview',
  imports: [CommonModule, FormsModule],
  templateUrl: './proposal-preview.html',
  styleUrl: './proposal-preview.scss',
})
export class ProposalPreview implements OnInit {
  private readonly auth = inject(Auth);
  private readonly proposalPdfService = inject(ProposalPdfService);
  
  offer = history.state.offer;
  current = history.state.current;

  client = {
    name: '',
    nif: '',
    email: '',
    phone: '',
    address: '',
  };

  commercial = {
    name: '',
    email: '',
    phone: '',
  };

  today = new Date();

  ngOnInit(): void {
    const currentUser = this.auth.getCurrentUser();

    if (!currentUser) {
      return;
    }

    this.commercial = {
      name: currentUser.name || '',
      email: currentUser.email || '',
      phone: currentUser.phone || '',
    };
  }

  exportPdf(): void {
    this.proposalPdfService.generate({
      offer: this.offer,
      current: this.current,
      client: this.client,
      commercial: this.commercial,
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value || 0);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-PT').format(date);
  }

  getProviderLogo(): string {
    const provider = this.offer?.tariff?.provider?.name;

    const logos: Record<string, string> = {
      Repsol: 'assets/companies/repsol.png',
      'Meo Energias': 'assets/companies/meo.png',
      MEO: 'assets/companies/meo.png',
    };

    return logos[provider] || 'assets/companies/repsol.png';
  }
}