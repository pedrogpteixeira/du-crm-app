import {
  ApplicationRef,
  ComponentRef,
  EnvironmentInjector,
  Injectable,
  createComponent,
  inject,
} from '@angular/core';

import { ProposalDocument } from '../../features/simulator/proposal-document/proposal-document';
import { ProposalData } from '../../features/simulator/proposal-document/proposal-document.types';

@Injectable({
  providedIn: 'root',
})
export class ProposalPdfService {
  private readonly appRef =
    inject(ApplicationRef);

  private readonly environmentInjector =
    inject(EnvironmentInjector);

  async generate(
    data: ProposalData,
  ): Promise<void> {
    const [
      { default: html2canvas },
      { default: jsPDF },
    ] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const componentRef =
      this.createDocumentComponent(data);

    const hostElement =
      componentRef.location
        .nativeElement as HTMLElement;

    document.body.appendChild(
      hostElement,
    );

    try {
      await document.fonts.ready;

      await this.waitForImages(
        hostElement,
      );

      await this.wait(250);

      const pageElements =
        hostElement
          .querySelectorAll<HTMLElement>(
            '.proposal-page',
          );

      const pages =
        Array.from(pageElements).filter(
          (page) =>
            page.innerText.trim() !== '',
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
        compress: true,
      });

      for (
        let index = 0;
        index < pages.length;
        index++
      ) {
        const canvas =
          await html2canvas(
            pages[index],
            {
              scale: 1.5,
              useCORS: true,
              allowTaint: false,
              backgroundColor:
                '#ffffff',
              logging: false,

              imageTimeout: 8000,

              removeContainer: true,
            },
          );

        const image =
          canvas.toDataURL(
            'image/jpeg',
            0.82,
          );

        if (index > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          image,
          'JPEG',
          0,
          0,
          210,
          297,
          undefined,
          'FAST',
        );

        canvas.width = 0;
        canvas.height = 0;
      }

      const clientName =
        this.sanitizeFileName(
          data.client.name ||
            'cliente',
        );

      pdf.save(
        `proposta-${clientName}.pdf`,
      );

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
      createComponent(
        ProposalDocument,
        {
          environmentInjector:
            this.environmentInjector,
        },
      );

    componentRef.instance.proposal =
      data;

    this.appRef.attachView(
      componentRef.hostView,
    );

    componentRef.changeDetectorRef
      .detectChanges();

    return componentRef;
  }

  private destroyDocumentComponent(
    componentRef:
      ComponentRef<ProposalDocument>,

    hostElement: HTMLElement,
  ): void {
    this.appRef.detachView(
      componentRef.hostView,
    );

    componentRef.destroy();

    if (hostElement.parentNode) {
      hostElement.parentNode
        .removeChild(hostElement);
    }
  }

  private async waitForImages(
    hostElement: HTMLElement,
  ): Promise<void> {
    const images = Array.from(
      hostElement.querySelectorAll(
        'img',
      ),
    );

    await Promise.all(
      images.map((image) => {
        if (
          image.complete &&
          image.naturalWidth > 0
        ) {
          return Promise.resolve();
        }

        return new Promise<void>(
          (resolve) => {
            const finish = () => {
              image.removeEventListener(
                'load',
                finish,
              );

              image.removeEventListener(
                'error',
                finish,
              );

              resolve();
            };

            image.addEventListener(
              'load',
              finish,
              {
                once: true,
              },
            );

            image.addEventListener(
              'error',
              finish,
              {
                once: true,
              },
            );
          },
        );
      }),
    );
  }

  private wait(
    milliseconds: number,
  ): Promise<void> {
    return new Promise<void>(
      (resolve) => {
        window.setTimeout(
          resolve,
          milliseconds,
        );
      },
    );
  }

  private sanitizeFileName(
    value: string,
  ): string {
    return value
      .trim()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )
      .replace(
        /[<>:"/\\|?*]+/g,
        '',
      )
      .replace(/\s+/g, '-')
      .toLowerCase();
  }
}