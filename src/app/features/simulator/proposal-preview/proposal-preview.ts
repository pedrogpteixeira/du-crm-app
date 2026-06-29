import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-proposal-preview',
  imports: [CommonModule, FormsModule],
  templateUrl: './proposal-preview.html',
  styleUrl: './proposal-preview.scss',
})
export class ProposalPreview {
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

  exportPdf(): void {
    const element = document.getElementById('proposal-document');

    if (!element) {
      return;
    }

    html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);

      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`proposta-${this.client.name || 'cliente'}.pdf`);
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