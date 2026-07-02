import { ApplicationRef, ComponentRef, Injectable, createComponent } from '@angular/core';
import { EnvironmentInjector, inject } from '@angular/core';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { ProposalData } from '../../features/simulator/proposal-document/proposal-document.types';
import { ProposalDocument } from '../../features/simulator/proposal-document/proposal-document';


@Injectable({
  providedIn: 'root',
})
export class ProposalPdfService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  async generate(data: ProposalData): Promise<void> {
    const componentRef = this.createDocumentComponent(data);

    document.body.appendChild(componentRef.location.nativeElement);

    await document.fonts.ready;

    await new Promise((resolve) => setTimeout(resolve, 500));

    const pageElements =
      componentRef.location.nativeElement.querySelectorAll(
        '.proposal-page',
      ) as NodeListOf<HTMLElement>;

    const pages = Array.from(pageElements).filter(
      (page) => page.innerText.trim() !== '',
    );

    const pdf = new jsPDF('p', 'mm', 'a4');

    for (let index = 0; index < pages.length; index++) {
      const canvas = await html2canvas(pages[index], {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const image = canvas.toDataURL('image/png');

      if (index > 0) {
        pdf.addPage();
      }

      pdf.addImage(image, 'PNG', 0, 0, 210, 297);
    }

    pdf.save(`proposta-${data.client.name || 'cliente'}.pdf`);

    this.appRef.detachView(componentRef.hostView);
    componentRef.destroy();
  }

  private createDocumentComponent(
    data: ProposalData,
  ): ComponentRef<ProposalDocument> {
    const componentRef = createComponent(ProposalDocument, {
      environmentInjector: this.environmentInjector,
    });

    componentRef.instance.proposal = data;

    this.appRef.attachView(componentRef.hostView);

    return componentRef;
  }
}