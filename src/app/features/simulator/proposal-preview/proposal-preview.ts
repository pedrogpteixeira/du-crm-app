import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Auth } from '../../../core/services/auth';
import { ProposalPdfService } from '../../../core/services/proposal-pdf';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-proposal-preview',
  imports: [CommonModule, FormsModule],
  templateUrl: './proposal-preview.html',
  styleUrl: './proposal-preview.scss',
})
export class ProposalPreview implements OnInit {
  private readonly auth = inject(Auth);
  private readonly proposalPdfService = inject(ProposalPdfService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  offer = history.state.offer;
  current = history.state.current;
  discountConditions = history.state.discountConditions || {};

  isGeneratingPdf = false;
  pdfErrorMessage = '';

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
    profilePicture: null as string | null,
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
      profilePicture: currentUser.profilePicture
        ? `${environment.apiUrl}/api/users/${currentUser.id}/profile-picture`
        : null,
    };
  }

  async exportPdf(): Promise<void> {
    if (this.isGeneratingPdf) {
      return;
    }

    this.isGeneratingPdf = true;
    this.pdfErrorMessage = '';
    this.cdr.detectChanges();

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    try {
      await this.proposalPdfService.generate({
        offer: this.offer,
        current: this.current,
        client: this.client,
        commercial: this.commercial,
        discountConditions:
          this.discountConditions,
      });
    } catch (error) {
      console.error(
        'Erro ao gerar proposta:',
        error,
      );

      this.pdfErrorMessage =
        'Não foi possível gerar a proposta. Tenta novamente.';
    } finally {
      this.ngZone.run(() => {
        this.isGeneratingPdf = false;
        this.cdr.detectChanges();
      });
    }
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

  getProviderLogo(providerName: string): string {
    const normalized = (providerName || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const logos: Record<string, string> = {
      repsol: 'assets/companies/repsol.png',
      wallbox: 'assets/companies/wallbox.png',
      meo: 'assets/companies/meo.png',
      'meo energias': 'assets/companies/meo.png',
      galp: 'assets/companies/galp.png',
      iberdrola: 'assets/companies/iberdrola.png',
      yes: 'assets/companies/yes.png',
      'yes energy': 'assets/companies/yes.png',
      endesa: 'assets/companies/endesa.png',
      portulogos: 'assets/companies/portulogos.png',
      'nossa energia': 'assets/companies/nossa-energia.png',
      ezu: 'assets/companies/ezu.png',
      audax: 'assets/companies/audax.png',
      plenitude: 'assets/companies/plenitude.png',
    };

    return logos[normalized] ?? 'assets/companies/default.png';
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
}