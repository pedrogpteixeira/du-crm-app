import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Auth } from '../../../core/services/auth';
import { ProposalPdfService } from '../../../core/services/proposal-pdf';
import { getSimulationCalculationBasisLabel } from '../../../core/utils/simulation-calculation-basis';
import {
  InvoiceComparisonOffer,
  SimulationCalculationProfile,
  SimulationCommercialContext,
} from '../../../core/services/simulator';
import { ProposalComparisonMeta } from '../proposal-document/proposal-document.types';
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

  offer = history.state.offer as InvoiceComparisonOffer;
  current = history.state.current;

  discountConditions = history.state.discountConditions || {};

  commercialContext = (history.state.commercialContext ??
    null) as SimulationCommercialContext | null;

  comparisonMeta = (history.state.comparisonMeta ?? null) as ProposalComparisonMeta | null;

  calculationProfile = (history.state.calculationProfile ??
    null) as SimulationCalculationProfile | null;

  isGeneratingPdf = false;

  pdfErrorMessage = '';
  validationErrorMessage = '';

  submitted = false;

  client = {
    name: '',
    nif: '',
    email: '',
    phone: '',
    address: '',

    crc: '',
    cpe: '',
    cui: '',
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

  get isBusinessProposal(): boolean {
    return this.offer?.tariff?.segment === 'business';
  }

  get hasElectricity(): boolean {
    const productType = this.offer?.tariff?.productType;

    return productType === 'electricity' || productType === 'dual';
  }

  get hasGas(): boolean {
    const productType = this.offer?.tariff?.productType;

    return productType === 'gas' || productType === 'dual';
  }

  isClientFieldInvalid(
    field: 'name' | 'nif' | 'email' | 'phone' | 'address' | 'crc' | 'cpe' | 'cui',
  ): boolean {
    if (!this.submitted) {
      return false;
    }

    const value = this.client[field]?.trim();

    if (field === 'crc') {
      return false;
    }

    if (field === 'cpe' && !this.hasElectricity) {
      return false;
    }

    if (field === 'cui' && !this.hasGas) {
      return false;
    }

    return !value;
  }

  private isClientDataValid(): boolean {
    const requiredValues = [
      this.client.name,
      this.client.nif,
      this.client.email,
      this.client.phone,
      this.client.address,
    ];

    if (this.hasElectricity) {
      requiredValues.push(this.client.cpe);
    }

    if (this.hasGas) {
      requiredValues.push(this.client.cui);
    }

    return requiredValues.every((value) => Boolean(value?.trim()));
  }

  async exportPdf(): Promise<void> {
    if (this.isGeneratingPdf) {
      return;
    }

    this.submitted = true;
    this.validationErrorMessage = '';
    this.pdfErrorMessage = '';

    if (!this.isClientDataValid()) {
      this.validationErrorMessage =
        'Preenche todos os dados obrigatórios do cliente antes de gerar a proposta.';

      return;
    }

    this.isGeneratingPdf = true;
    this.cdr.detectChanges();

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });

    try {
      await this.proposalPdfService.generate({
        offer: this.offer,
        current: this.current,

        client: {
          ...this.client,

          name: this.client.name.trim(),

          nif: this.client.nif.trim(),

          email: this.client.email.trim(),

          phone: this.client.phone.trim(),

          address: this.client.address.trim(),

          crc: this.isBusinessProposal ? this.client.crc.trim() : '',

          cpe: this.hasElectricity ? this.client.cpe.trim() : '',

          cui: this.hasGas ? this.client.cui.trim() : '',
        },

        commercial: this.commercial,

        discountConditions: this.discountConditions,

        commercialContext: this.commercialContext,

        comparisonMeta: this.comparisonMeta,

        calculationProfile: this.calculationProfile,
      });
    } catch (error) {
      console.error('Erro ao gerar proposta:', error);

      this.pdfErrorMessage = 'Não foi possível gerar a proposta. Tenta novamente.';
    } finally {
      this.ngZone.run(() => {
        this.isGeneratingPdf = false;
        this.cdr.detectChanges();
      });
    }
  }

  formatCurrency(value?: number | null): string {
    if (value === undefined || value === null) {
      return '—';
    }

    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  }

  getInvoicePeriodCost(): number | undefined {
    return this.offer?.invoicePeriodCost ?? this.offer?.simulation?.details?.totalCost;
  }

  getNormalizedMonthlyCost(): number | undefined {
    return this.offer?.normalizedMonthlyCost ?? this.offer?.simulation?.estimatedMonthlyCost;
  }

  getNormalizedAnnualCost(): number | undefined {
    return this.offer?.normalizedAnnualCost;
  }

  getPeriodDays(): number | null {
    return (
      this.comparisonMeta?.periodDays ??
      this.offer?.simulation?.details?.days ??
      this.current?.days ??
      null
    );
  }

  getCalculationBasisLabel(): string | null {
    return getSimulationCalculationBasisLabel(
      this.offer?.simulation?.calculationBasis,
      this.offer?.simulation?.estimated,
    );
  }

  get isAdvancedOffer(): boolean {
    return Boolean(this.offer?.tariff?.calculationProfileId);
  }

  getCalculationProfileLabel(): string {
    if (this.calculationProfile) {
      return `${this.calculationProfile.familyCode} · v${this.calculationProfile.version}`;
    }

    return this.isAdvancedOffer ? 'Perfil avançado' : 'Legacy';
  }

  getValidityLabel(): string {
    const startDate = this.offer?.tariff?.startDate;
    const endDate = this.offer?.tariff?.endDate;

    if (startDate && endDate) {
      return `${this.formatCivilDate(startDate)} — ${this.formatCivilDate(endDate)}`;
    }

    if (startDate) {
      return `Desde ${this.formatCivilDate(startDate)}`;
    }

    if (endDate) {
      return `Até ${this.formatCivilDate(endDate)}`;
    }

    return 'Sem período definido';
  }

  getCommercialConditionLabels(): string[] {
    const labels: string[] = [];

    if (this.commercialContext?.paymentMethod === 'direct_debit') {
      labels.push('DD · Débito Direto');
    } else if (this.commercialContext?.paymentMethod === 'multibanco') {
      labels.push('MB · Multibanco');
    }

    if (this.commercialContext?.invoiceDelivery === 'electronic') {
      labels.push('FE · Fatura eletrónica');
    } else if (this.commercialContext?.invoiceDelivery === 'paper') {
      labels.push('FP · Fatura em papel');
    }

    return labels;
  }

  private formatCivilDate(value: string): string {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!match) {
      return value;
    }

    return `${match[3]}/${match[2]}/${match[1]}`;
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
