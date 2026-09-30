import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

import {
  AUTO_COLUMNS_BY_PROVIDER,
  AutoItem,
  AutoItemColumnKey,
  AutoItemPayment,
  AutoProvider,
} from '../../../core/services/auto';
import { getContractDetailRouteByProvider } from '../../../core/config/contract-detail-route';

const COLUMN_LABELS: Readonly<Record<AutoItemColumnKey, string>> = {
  contractId: 'ID',
  clientName: 'Nome Cliente',
  signatureDate: 'Data Assinatura',
  cpe: 'CPE',
  cui: 'CUI',
  campaign: 'Campanha',
  power: 'Potência',
  nif: 'NIF',
  electronicInvoice: 'Fatura Eletrónica',
  directDebit: 'Débito Direto',
  sva: 'SVA',
  PEL: 'PEL',
  PELPlus: 'PEL Plus',
  MGI: 'MGI',
  state: 'Estado',
  registrationName: 'Nome Registo CE',
  tipoSegmento: 'Tipo Segmento',
  movementType: 'Movimento',
  commission: 'Comissão',
};

export type AutoItemPaymentViewStatus =
  | 'unpaid'
  | 'paid'
  | 'refund-pending'
  | 'refunded'
  | 'not-applicable'
  | 'loading'
  | 'unavailable';

export interface AutoItemPaymentView {
  payment?: AutoItemPayment;
  paymentLabel: string;
  paymentStatus: AutoItemPaymentViewStatus;
  paymentHint?: string;
}

export interface AutoItemPaymentActionEvent {
  item: AutoItem;
  payment: AutoItemPayment;
}

@Component({
  selector: 'app-auto-items-table',
  imports: [CommonModule, RouterLink],
  templateUrl: './auto-items-table.html',
  styleUrl: './auto-items-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoItemsTable {
  @Input({ required: true }) provider!: AutoProvider;
  @Input() items: readonly AutoItem[] = [];
  @Input() maxHeight: string | null = null;

  @Input() showPayments = false;
  @Input() canManagePayments = false;
  @Input() paymentsLoading = false;
  @Input() paymentsUnavailable = false;
  @Input() paymentsByAutoItemId: ReadonlyMap<string, AutoItemPayment> = new Map();

  @Output() registerPayment = new EventEmitter<AutoItem>();
  @Output() viewPayment = new EventEmitter<AutoItemPaymentActionEvent>();

  get columns(): readonly AutoItemColumnKey[] {
    return AUTO_COLUMNS_BY_PROVIDER[this.provider];
  }

  columnLabel(column: AutoItemColumnKey): string {
    return COLUMN_LABELS[column];
  }

  movementLabel(type: AutoItem['movementType']): string {
    if (type === 'payment') {
      return 'Comissão';
    }

    if (type === 'refund') {
      return 'Reembolso';
    }

    return 'Sem movimento';
  }

  formatCurrency(value: number | null | undefined): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(Number(value ?? 0));
  }

  formatCommission(value: number | null | undefined): string {
    const numericValue = Number(value ?? 0);
    const formatted = this.formatCurrency(numericValue);
    return numericValue > 0 ? `+${formatted}` : formatted;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  formatBoolean(value: boolean | undefined): string {
    if (value === undefined) {
      return '—';
    }

    return value ? 'Sim' : 'Não';
  }

  formatSva(value: AutoItem['sva']): string {
    if (value === true) {
      return 'Sim';
    }

    if (value === false) {
      return 'Não';
    }

    return value || '—';
  }

  contractRoute(item: AutoItem): string[] | null {
    return getContractDetailRouteByProvider(this.provider, item.contractId);
  }

  autoItemId(item: AutoItem): string {
    return item.domainId ?? item.id ?? '';
  }

  paymentView(item: AutoItem): AutoItemPaymentView {
    if (Number(item.commission) <= 0) {
      return {
        paymentLabel: 'Não aplicável',
        paymentStatus: 'not-applicable',
      };
    }

    if (this.paymentsLoading) {
      return {
        paymentLabel: 'A carregar...',
        paymentStatus: 'loading',
      };
    }

    if (this.paymentsUnavailable) {
      return {
        paymentLabel: 'Indisponível',
        paymentStatus: 'unavailable',
      };
    }

    const itemId = this.autoItemId(item);
    const payment = itemId ? this.paymentsByAutoItemId.get(itemId) : undefined;

    // Um pagamento já realizado tem sempre prioridade histórica sobre um refund posterior.
    if (payment) {
      return {
        payment,
        paymentLabel: 'Pago',
        paymentStatus: 'paid',
      };
    }

    if (item.paymentBlocked === true) {
      if (item.paymentBlockReason === 'refunded') {
        return {
          paymentLabel: 'Reembolsado',
          paymentStatus: 'refunded',
          paymentHint: 'Esta comissão já foi revertida por um Auto posterior.',
        };
      }

      return {
        paymentLabel: 'Reembolso pendente',
        paymentStatus: 'refund-pending',
        paymentHint: 'Esta comissão está associada a um processo de reembolso e já não pode ser paga.',
      };
    }

    return {
      paymentLabel: 'Por pagar',
      paymentStatus: 'unpaid',
    };
  }

  refundContextLabel(item: AutoItem): string | null {
    if (item.movementType !== 'refund' || !item.refundOfAutoItemId) {
      return null;
    }

    return 'Reembolso de comissão anterior';
  }

  paymentStatusClass(status: AutoItemPaymentViewStatus): string {
    return `payment-${status}`;
  }

  onRegisterPayment(event: MouseEvent, item: AutoItem): void {
    event.stopPropagation();
    this.registerPayment.emit(item);
  }

  onViewPayment(
    event: MouseEvent,
    item: AutoItem,
    payment: AutoItemPayment,
  ): void {
    event.stopPropagation();
    this.viewPayment.emit({ item, payment });
  }

  trackItem(index: number, item: AutoItem): string {
    return item.domainId ?? item.id ?? item.contractId ?? String(index);
  }
}
