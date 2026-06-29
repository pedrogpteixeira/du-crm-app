import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  RepsolContractDetail as RepsolContractDetailModel,
  RepsolContractService,
  RepsolContractStatus,
  RepsolContractDocument,
} from '../../../core/services/repsol-contract';
import { PreferencesService } from '../../../core/services/preferences';
import { SocketService } from '../../../core/services/socket';

@Component({
  selector: 'app-repsol-contract-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './repsol-contract-detail.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './repsol-contract-detail.scss',
})
export class RepsolContractDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly repsolContractService = inject(RepsolContractService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly socketService = inject(SocketService);

  contract: RepsolContractDetailModel | null = null;
  collapsedSections = this.buildCollapsedSections(false);

  isLoading = false;
  errorMessage = '';
  socketMessage = '';

  contractId = '';

  lastSocketUpdate = '';

  ngOnInit(): void {
    const collapseByDefault =
      this.preferencesService.getPreferences().contractDetailsCollapsedByDefault;

    this.collapsedSections = this.buildCollapsedSections(collapseByDefault);
    this.route.paramMap.subscribe((params) => {
      this.contractId = params.get('id') as string;

      if (this.contractId) {
        this.loadContract(this.contractId);
      }
    });

    this.socketService.listenRepsolContractUpdated().subscribe((event) => {
      if (event.contractId !== this.contractId) {
        return;
      }

      this.socketMessage = `Este contrato foi atualizado por outro utilizador às ${new Date().toLocaleTimeString('pt-PT')}.`;

      this.loadContract(this.contractId);
      this.lastSocketUpdate = new Date().toLocaleTimeString('pt-PT');

      setTimeout(() => {
        this.lastSocketUpdate = '';
      }, 5000);

      setTimeout(() => {
        this.socketMessage = '';
      }, 5000);
    });
  }

  loadContract(contractId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.repsolContractService.getRepsolContractById(contractId).subscribe({
      next: (contract) => {
        this.contract = contract;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o contrato Repsol.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  private buildCollapsedSections(value: boolean) {
    return {
      client: value,
      contract: value,
      billing: value,
      energy: value,
      attachments: value,
      observations: value,
    };
  }

  toggleSection(section: keyof typeof this.collapsedSections): void {
    this.collapsedSections[section] = !this.collapsedSections[section];
  }

  getStatusClass(status: RepsolContractStatus): string {
    return {
      'Pedido de Chamada': 'status-call-request',
      'Em validação': 'status-validation',
      'Chamada Efetuada': 'status-call-done',
      'Pendente Assinatura Digital': 'status-signature',
      'Não Conformidade': 'status-non-compliance',
      'Pendente Docs': 'status-docs',
      'Documentos Enviados': 'status-docs-sent',
      Atribuído: 'status-assigned',
    }[status];
  }

  downloadDocument(file: RepsolContractDocument): void {
    if (!this.contract?.id) {
      return;
    }

    this.repsolContractService.downloadDocument(this.contract.id, file).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);

        const link = window.document.createElement('a');
        link.href = url;
        link.download = file.originalName || file.fileName;

        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);

        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.errorMessage = 'Não foi possível descarregar o anexo.';
      },
    });
  }

  formatBoolean(value: boolean): string {
    return value ? 'Sim' : 'Não';
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  getValue(value: string | number | null | undefined): string | number {
    return value || '-';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  getFileIcon(mimetype: string): string {
    if (mimetype.startsWith('audio/')) {
      return '🎧';
    }

    if (mimetype.includes('pdf')) {
      return '📄';
    }

    if (mimetype.includes('word')) {
      return '📝';
    }

    if (mimetype.startsWith('image/')) {
      return '🖼️';
    }

    return '📎';
  }
}
