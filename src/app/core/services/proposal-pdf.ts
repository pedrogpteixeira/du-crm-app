import {
  ApplicationRef,
  ComponentRef,
  EnvironmentInjector,
  Injectable,
  createComponent,
  inject,
} from '@angular/core';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { ProposalDocument } from '../../features/simulator/proposal-document/proposal-document';
import { ProposalData } from '../../features/simulator/proposal-document/proposal-document.types';

@Injectable({
  providedIn: 'root',
})
export class ProposalPdfService {
  private readonly appRef = inject(ApplicationRef);

  private readonly environmentInjector =
    inject(EnvironmentInjector);

  async generate(data: ProposalData): Promise<void> {
    const componentRef =
      this.createDocumentComponent(data);

    const hostElement =
      componentRef.location.nativeElement as HTMLElement;

    document.body.appendChild(hostElement);

    try {
      await document.fonts.ready;

      // Dá tempo ao Angular, às imagens e ao layout
      // para terminarem de renderizar.
      await this.wait(500);

      const pageElements =
        hostElement.querySelectorAll<HTMLElement>(
          '.proposal-page',
        );

      const pages = Array.from(pageElements).filter(
        (page) => page.innerText.trim() !== '',
      );

      if (!pages.length) {
        throw new Error(
          'Não foram encontradas páginas para gerar a proposta.',
        );
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      for (
        let index = 0;
        index < pages.length;
        index++
      ) {
        const canvas = await html2canvas(
          pages[index],
          {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
          },
        );

        const image = canvas.toDataURL(
          'image/png',
        );

        if (index > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          image,
          'PNG',
          0,
          0,
          210,
          297,
        );
      }

      const clientName =
        this.sanitizeFileName(
          data.client.name || 'cliente',
        );

      pdf.save(`proposta-${clientName}.pdf`);

      // Permite ao browser iniciar o download antes
      // de resolver a Promise e remover o loading.
      await this.wait(250);
    } finally {
      this.destroyDocumentComponent(
        componentRef,
        hostElement,
      );
    }
  }

  private createDocumentComponent(
    data: ProposalData,
  ): ComponentRef<ProposalDocument> {
    const componentRef =
      createComponent(ProposalDocument, {
        environmentInjector:
          this.environmentInjector,
      });

    componentRef.instance.proposal = data;

    this.appRef.attachView(
      componentRef.hostView,
    );

    // Garante a renderização inicial do componente.
    componentRef.changeDetectorRef.detectChanges();

    return componentRef;
  }

  private destroyDocumentComponent(
    componentRef: ComponentRef<ProposalDocument>,
    hostElement: HTMLElement,
  ): void {
    this.appRef.detachView(
      componentRef.hostView,
    );

    componentRef.destroy();

    if (hostElement.parentNode) {
      hostElement.parentNode.removeChild(
        hostElement,
      );
    }
  }

  private wait(milliseconds: number): Promise<void> {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  private sanitizeFileName(
    value: string,
  ): string {
    return value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[<>:"/\\|?*]+/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }
}