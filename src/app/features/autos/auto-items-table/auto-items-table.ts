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
import {
  LocalAutoSelectionMode,
  getAutoItemId,
} from '../auto-items-selection';
import { getContractDetailRouteByProvider } from '../../../core/config/contract-detail-route';
import { AutoMovementDescriptionModal } from '../auto-movement-description-modal/auto-movement-description-modal';

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
  | 'blocked'
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
  imports: [CommonModule, RouterLink, AutoMovementDescriptionModal],
  templateUrl: './auto-items-table.html',
  styleUrl: './auto-items-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoItemsTable {
  @Input({ required: true }) provider!: AutoProvider;

  private _items: readonly AutoItem[] = [];
  hasMovementDescriptions = false;

  @Input()
  set items(value: readonly AutoItem[] | null | undefined) {
    this._items = value ?? [];
    this.hasMovementDescriptions = this._items.some((item) =>
      Boolean(item.movementDescription?.trim()),
    );
  }

  get items(): readonly AutoItem[] {
    return this._items;
  }

  @Input() maxHeight: string | null = null;

  @Input() showPayments = false;
  @Input() canManagePayments = false;
  @Input() paymentsLoading = false;
  @Input() paymentsUnavailable = false;
  @Input() paymentsByAutoItemId: ReadonlyMap<string, AutoItemPayment> = new Map();

  @Input() selectionEnabled = false;
  @Input() selectionMode: LocalAutoSelectionMode = 'all';
  @Input() selectionItemIds: ReadonlySet<string> = new Set<string>();
  @Input() selectionScopeLabel = 'resultados visíveis';

  @Output() itemSelectionChange = new EventEmitter<{ itemId: string; selected: boolean }>();
  @Output() visibleSelectionChange = new EventEmitter<boolean>();
  @Output() registerPayment = new EventEmitter<AutoItem>();
  @Output() viewPayment = new EventEmitter<AutoItemPaymentActionEvent>();

  selectedMovementDescription: {
    description: string;
    movementType: AutoItem['movementType'];
    amount: number;
    refundOutsideChargeback: boolean;
  } | null = null;

  private movementDescriptionTrigger: HTMLElement | null = null;

  get columns(): readonly AutoItemColumnKey[] {
    return AUTO_COLUMNS_BY_PROVIDER[this.provider];
  }

  columnLabel(column: AutoItemColumnKey): string {
    return COLUMN_LABELS[column];
  }

  movementLabel(type: AutoItem['movementType']): string {
    if (type === 'payment') {
      return 'Pagamento';
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
    return getAutoItemId(item);
  }

  isSelected(item: AutoItem): boolean {
    if (!this.selectionEnabled) {
      return true;
    }

    const itemId = this.autoItemId(item);
    if (!itemId) {
      return false;
    }

    if (this.selectionMode === 'all') {
      return true;
    }

    const contains = this.selectionItemIds.has(itemId);
    return this.selectionMode === 'include' ? contains : !contains;
  }

  get allVisibleSelected(): boolean {
    return Boolean(
      this.selectionEnabled &&
      this.items.length &&
      this.items.every((item) => this.isSelected(item)),
    );
  }

  get someVisibleSelected(): boolean {
    if (!this.selectionEnabled || !this.items.length) {
      return false;
    }

    const selected = this.items.reduce(
      (count, item) => count + (this.isSelected(item) ? 1 : 0),
      0,
    );

    return selected > 0 && selected < this.items.length;
  }

  onItemSelectionChange(event: Event, item: AutoItem): void {
    event.stopPropagation();
    const itemId = this.autoItemId(item);
    if (!itemId) {
      return;
    }

    const selected = (event.target as HTMLInputElement).checked;
    this.itemSelectionChange.emit({ itemId, selected });
  }

  onVisibleSelectionChange(event: Event): void {
    event.stopPropagation();
    this.visibleSelectionChange.emit(
      (event.target as HTMLInputElement).checked,
    );
  }

  paymentView(item: AutoItem): AutoItemPaymentView {
    if (item.movementType !== 'payment') {
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

    // Um pagamento efetivamente registado tem prioridade sobre qualquer estado posterior.
    if (payment) {
      return {
        payment,
        paymentLabel: 'Pago',
        paymentStatus: 'paid',
      };
    }

    const allowed = this.isPaymentAllowed(item);
    const payableAmount = this.getPayableAmount(item);

    if (allowed && payableAmount > 0) {
      return {
        paymentLabel: 'Por pagar',
        paymentStatus: 'unpaid',
        paymentHint: `Valor por pagar: ${this.formatCurrency(payableAmount)}.`,
      };
    }

    if (item.paymentBlockReason === 'refunded') {
      return {
        paymentLabel: 'Reembolsado',
        paymentStatus: 'refunded',
        paymentHint: 'O backend indica que esta comissão já foi reembolsada.',
      };
    }

    if (item.paymentBlockReason === 'refund-pending') {
      return {
        paymentLabel: 'Reembolso pendente',
        paymentStatus: 'refund-pending',
        paymentHint: 'O backend indica que existe um reembolso pendente.',
      };
    }

    if (item.paymentAllowed === false || item.paymentBlocked === true || item.paymentBlockReason) {
      return {
        paymentLabel: 'Bloqueado',
        paymentStatus: 'blocked',
        paymentHint: 'O backend não permite o pagamento desta comissão.',
      };
    }

    return {
      paymentLabel: 'Não aplicável',
      paymentStatus: 'not-applicable',
    };
  }

  private isPaymentAllowed(item: AutoItem): boolean {
    if (item.paymentAllowed !== undefined) {
      return item.paymentAllowed === true;
    }

    // Compatibilidade com respostas antigas: só usar a regra legada quando
    // o backend ainda não devolver explicitamente paymentAllowed.
    return (
      item.paymentBlockReason == null &&
      item.paymentBlocked !== true &&
      Number(item.commission) > 0
    );
  }

  private getPayableAmount(item: AutoItem): number {
    if (item.payableAmount !== undefined && item.payableAmount !== null) {
      const payableAmount = Number(item.payableAmount);
      return Number.isFinite(payableAmount) ? payableAmount : 0;
    }

    // Fallback apenas para payloads antigos sem payableAmount.
    const commission = Number(item.commission);
    return Number.isFinite(commission) && commission > 0 ? commission : 0;
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

  hasMovementDescription(item: AutoItem): boolean {
    return Boolean(item.movementDescription?.trim());
  }

  openMovementDescription(event: MouseEvent, item: AutoItem): void {
    event.stopPropagation();

    if (!this.hasMovementDescription(item) || !item.movementDescription) {
      return;
    }

    this.movementDescriptionTrigger = event.currentTarget as HTMLElement;
    this.selectedMovementDescription = {
      description: item.movementDescription,
      movementType: item.movementType,
      amount: item.commission,
      refundOutsideChargeback: item.refundOutsideChargeback === true,
    };
  }

  closeMovementDescription(): void {
    this.selectedMovementDescription = null;
    const trigger = this.movementDescriptionTrigger;
    this.movementDescriptionTrigger = null;

    queueMicrotask(() => trigger?.focus());
  }

  trackItem(index: number, item: AutoItem): string {
    return item.domainId ?? item.id ?? item.contractId ?? String(index);
  }
}
