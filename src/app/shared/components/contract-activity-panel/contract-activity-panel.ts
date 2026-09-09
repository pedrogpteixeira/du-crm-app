import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { getContractStatusColor } from '../../../core/config/contract-status-colors';
import type {
  ContractFlowEntry,
  ContractTicketSummary,
} from '../../../core/models/contract-activity';
import {
  TicketCreateModal,
  TicketCreateModalResult,
} from '../ticket-create-modal/ticket-create-modal';

type ContractActivityTab = 'flow' | 'tickets';

interface FlowStatePresentation {
  prefix: string;
  state: string;
  color: string;
}

@Component({
  selector: 'app-contract-activity-panel',
  imports: [
    CommonModule,
    RouterLink,
    TicketCreateModal,
  ],
  templateUrl: './contract-activity-panel.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './contract-activity-panel.scss',
})
export class ContractActivityPanel {
  @Input() fluxo: ContractFlowEntry[] | null | undefined = [];
  @Input() tickets: ContractTicketSummary[] | null | undefined = [];
  @Input() contractId = '';
  @Input() companyId = '';
  @Input() statusOptions: readonly string[] | null | undefined = [];

  activeTab: ContractActivityTab = 'flow';
  isCreateTicketModalOpen = false;
  ticketCreateFeedback = '';
  ticketCreateFeedbackType: 'success' | 'warning' = 'success';

  get flowEntries(): ContractFlowEntry[] {
    const entries = [...(this.fluxo ?? [])];

    const isAlreadyDescending = entries.every((entry, index) => {
      if (index === 0) {
        return true;
      }

      return (
        this.getTimestamp(entries[index - 1]?.dataHora) >=
        this.getTimestamp(entry.dataHora)
      );
    });

    if (isAlreadyDescending) {
      return entries;
    }

    return entries.sort(
      (first, second) =>
        this.getTimestamp(second.dataHora) -
        this.getTimestamp(first.dataHora),
    );
  }

  get ticketEntries(): ContractTicketSummary[] {
    return [...(this.tickets ?? [])];
  }

  setActiveTab(tab: ContractActivityTab): void {
    this.activeTab = tab;
  }

  getUserName(userName: string | null | undefined): string {
    return userName?.trim() || 'Utilizador desconhecido';
  }

  formatFlowDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value || '—';
    }

    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isToday) {
      return new Intl.DateTimeFormat('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  getFlowStatePresentation(
    action: string,
  ): FlowStatePresentation | null {
    const match = action
      .trim()
      .match(/^(Atualizou|Alterou) estado para\s+(.+)$/i);

    if (!match) {
      return null;
    }

    const stateFromAction = match[2]?.trim();

    if (!stateFromAction) {
      return null;
    }

    const knownState = (this.statusOptions ?? []).find(
      (status) => status === stateFromAction,
    );

    if (!knownState) {
      return null;
    }

    return {
      prefix: `${match[1]} estado para`,
      state: knownState,
      color: getContractStatusColor(knownState),
    };
  }

  getTicketStatusClass(status: string): string {
    const classes: Record<string, string> = {
      Novo: 'ticket-status-new',
      'Em Tratamento': 'ticket-status-progress',
      Concluído: 'ticket-status-completed',
    };

    return classes[status] ?? 'ticket-status-default';
  }

  getTicketPriorityClass(priority: string): string {
    const classes: Record<string, string> = {
      Baixo: 'ticket-priority-low',
      Normal: 'ticket-priority-normal',
      Alto: 'ticket-priority-high',
      Urgente: 'ticket-priority-urgent',
    };

    return classes[priority] ?? 'ticket-priority-default';
  }

  openCreateTicketModal(): void {
    if (!this.contractId || !this.companyId) {
      return;
    }

    this.ticketCreateFeedback = '';
    this.isCreateTicketModalOpen = true;
  }

  closeCreateTicketModal(): void {
    this.isCreateTicketModalOpen = false;
  }

  onTicketCreated(result: TicketCreateModalResult): void {
    this.isCreateTicketModalOpen = false;
    this.activeTab = 'tickets';

    if (result.attachmentUploadFailed) {
      this.ticketCreateFeedbackType = 'warning';
      this.ticketCreateFeedback =
        'Ticket criado com sucesso, mas não foi possível carregar um ou mais anexos.';
      return;
    }

    this.ticketCreateFeedbackType = 'success';
    this.ticketCreateFeedback = result.attachmentsUploaded
      ? 'Ticket e anexos criados com sucesso. A lista será sincronizada automaticamente.'
      : 'Ticket criado com sucesso. A lista será sincronizada automaticamente.';
  }


  private getTimestamp(value: string | undefined): number {
    if (!value) {
      return 0;
    }

    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
}
