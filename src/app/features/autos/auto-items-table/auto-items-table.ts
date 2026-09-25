import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

import {
  AUTO_COLUMNS_BY_PROVIDER,
  AutoItem,
  AutoItemColumnKey,
  AutoProvider,
} from '../../../core/services/auto';

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
  state: 'Estado',
  registrationName: 'Nome Registo CE',
  registrationCode: 'Código Registo CE',
  movementType: 'Movimento',
  commission: 'Comissão',
};

@Component({
  selector: 'app-auto-items-table',
  imports: [CommonModule],
  templateUrl: './auto-items-table.html',
  styleUrl: './auto-items-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoItemsTable {
  @Input({ required: true }) provider!: AutoProvider;
  @Input() items: readonly AutoItem[] = [];
  @Input() maxHeight: string | null = null;

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
      return 'Retorno';
    }

    return 'Sem movimento';
  }

  formatCurrency(value: number | null | undefined): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(Number(value ?? 0));
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

  trackItem(index: number, item: AutoItem): string {
    return item.id ?? item.contractId ?? String(index);
  }
}
