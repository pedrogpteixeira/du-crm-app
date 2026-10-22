import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { ContractExportService } from '../../../core/services/contract-export';
import { ToastService } from '../../../core/services/toast';
import {
  ContractExportField,
  ContractExportMode,
  ContractExportProvider,
  ContractExportRequest,
} from '../../../core/utils/contract-export';
import { ContractApiFilters } from '../../../core/utils/contract-kanban';

interface ContractExportFieldGroup {
  label: string;
  fields: ContractExportField[];
}

@Component({
  selector: 'app-contract-export-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './contract-export-modal.html',
  styleUrl: './contract-export-modal.scss',
})
export class ContractExportModalComponent implements OnInit {
  @Input({ required: true }) provider!: ContractExportProvider;
  @Input({ required: true }) supplierLabel = '';
  @Input() manualSelectedIds: readonly string[] = [];
  @Input() filteredTotal = 0;
  @Input() filters: ContractApiFilters = {};
  @Input() initialMode: ContractExportMode = 'filtered';

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly exported = new EventEmitter<void>();

  private readonly exportService = inject(ContractExportService);
  private readonly toast = inject(ToastService);

  fields: ContractExportField[] = [];
  selectedFieldKeys = new Set<string>();
  exportMode: ContractExportMode = 'filtered';
  searchTerm = '';

  isLoadingFields = true;
  isExporting = false;
  fieldsError = '';
  exportError = '';

  ngOnInit(): void {
    this.exportMode = this.resolveInitialMode();
    this.loadFields();
  }

  get selectedFieldCount(): number {
    return this.selectedFieldKeys.size;
  }

  get selectedContractCount(): number {
    return this.exportMode === 'selected' ? this.manualSelectedIds.length : this.filteredTotal;
  }

  get canExport(): boolean {
    if (this.isLoadingFields || this.isExporting || !this.selectedFieldKeys.size) {
      return false;
    }

    if (this.exportMode === 'selected') {
      return this.manualSelectedIds.length > 0;
    }

    return this.filteredTotal > 0;
  }

  get fieldGroups(): ContractExportFieldGroup[] {
    const query = this.normalizeText(this.searchTerm);
    const visibleFields = query
      ? this.fields.filter((field) =>
          this.normalizeText(`${field.label} ${field.key}`).includes(query),
        )
      : this.fields;
    const groups = new Map<string, ContractExportField[]>();

    visibleFields.forEach((field) => {
      const group = this.getFieldGroup(field);
      const current = groups.get(group) ?? [];
      current.push(field);
      groups.set(group, current);
    });

    return Array.from(groups.entries()).map(([label, fields]) => ({ label, fields }));
  }

  get allFieldsSelected(): boolean {
    return Boolean(this.fields.length) && this.fields.every((field) => this.selectedFieldKeys.has(field.key));
  }

  loadFields(): void {
    this.isLoadingFields = true;
    this.fieldsError = '';

    this.exportService
      .getFields(this.provider)
      .pipe(finalize(() => (this.isLoadingFields = false)))
      .subscribe({
        next: (response) => {
          this.fields = response.fields ?? [];
          this.applyInitialFieldSelection();

          if (!this.fields.length) {
            this.fieldsError = 'Não existem campos disponíveis para exportação.';
          }
        },
        error: () => {
          this.fields = [];
          this.selectedFieldKeys.clear();
          this.fieldsError = 'Não foi possível carregar os campos disponíveis para exportação.';
        },
      });
  }

  setExportMode(mode: ContractExportMode): void {
    if (mode === 'selected' && !this.manualSelectedIds.length) {
      return;
    }

    if (mode === 'filtered' && this.filteredTotal <= 0) {
      return;
    }

    this.exportMode = mode;
    this.exportError = '';
  }

  toggleField(field: ContractExportField, event: Event): void {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.checked) {
      this.selectedFieldKeys.add(field.key);
    } else {
      this.selectedFieldKeys.delete(field.key);
    }

    this.selectedFieldKeys = new Set(this.selectedFieldKeys);
    this.exportError = '';
  }

  selectAllFields(): void {
    this.selectedFieldKeys = new Set(this.fields.map((field) => field.key));
  }

  clearFieldSelection(): void {
    this.selectedFieldKeys = new Set<string>();
  }

  closeModal(): void {
    if (!this.isExporting) {
      this.close.emit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  export(): void {
    if (!this.canExport) {
      return;
    }

    const fields = this.fields
      .filter((field) => this.selectedFieldKeys.has(field.key))
      .map((field) => field.key);

    const payload: ContractExportRequest =
      this.exportMode === 'selected'
        ? {
            mode: 'selected',
            ids: [...this.manualSelectedIds],
            fields,
          }
        : {
            mode: 'filtered',
            filters: { ...this.filters },
            fields,
          };

    this.isExporting = true;
    this.exportError = '';

    this.exportService
      .exportContracts(this.provider, payload)
      .pipe(finalize(() => (this.isExporting = false)))
      .subscribe({
        next: (response) => {
          const fallback = `contratos-${this.provider}-${this.todayForFilename()}.xlsx`;
          const filename = this.extractFilename(response.headers.get('Content-Disposition')) ?? fallback;

          if (!response.body) {
            this.exportError = 'O ficheiro exportado não foi recebido.';
            return;
          }

          this.downloadBlob(response.body, filename);
          this.exportService.setFieldPreference(this.provider, fields);
          this.toast.success('Exportação concluída com sucesso.');
          this.exported.emit();
        },
        error: (error: HttpErrorResponse) => {
          void this.resolveExportError(error).then((message) => {
            this.exportError = message;
          });
        },
      });
  }

  private resolveInitialMode(): ContractExportMode {
    if (this.initialMode === 'selected' && this.manualSelectedIds.length) {
      return 'selected';
    }

    return 'filtered';
  }

  private applyInitialFieldSelection(): void {
    const available = new Set(this.fields.map((field) => field.key));
    const preference = this.exportService
      .getFieldPreference(this.provider)
      ?.filter((key) => available.has(key));

    if (preference?.length) {
      this.selectedFieldKeys = new Set(preference);
      return;
    }

    const defaults: string[] = [];
    const addIfAvailable = (key: string): void => {
      if (available.has(key) && !defaults.includes(key)) {
        defaults.push(key);
      }
    };

    if (available.has('domainId')) {
      addIfAvailable('domainId');
    } else {
      addIfAvailable('id');
    }

    addIfAvailable('nomeClienteEmpresa');
    addIfAvailable('nif');
    addIfAvailable('estado');
    addIfAvailable('nomeRegistoCE');

    if (available.has('dataAssinatura')) {
      addIfAvailable('dataAssinatura');
    } else {
      addIfAvailable('dataContrato');
    }

    this.selectedFieldKeys = new Set(defaults.length ? defaults : this.fields.slice(0, 6).map((field) => field.key));
  }

  private getFieldGroup(field: ContractExportField): string {
    const key = field.key.toLocaleLowerCase('pt');
    const label = field.label.toLocaleLowerCase('pt');
    const text = `${key} ${label}`;

    if (/data|date|estado|status|created|updated|agendamento|assinatura|ativacao|baixa/.test(text)) {
      return 'Datas e estados';
    }

    if (/instala|painel|bateria|microinvers|wallbox|desloca|balanceamento/.test(text)) {
      return 'Instalação';
    }

    if (/cpe|cui|pot[eê]ncia|escalao|escal[aã]o|ciclo|tens[aã]o|tarifa|energia|g[aá]s|luz/.test(text)) {
      return 'Energia e características técnicas';
    }

    if (/campanha|registo|comercial|contrata|produto|segmento|fornecedor|provider|company/.test(text)) {
      return 'Contrato e comercializadora';
    }

    if (/nif|cliente|empresa|email|telefone|morada|iban|nib|cae|crc|cart[aã]o|nome/.test(text)) {
      return 'Identificação e cliente';
    }

    if (/d[eé]bito|fatura|sva|pagamento|qualidade|observa/.test(text)) {
      return 'Dados comerciais';
    }

    return 'Outros campos';
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('pt');
  }

  private extractFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) {
      return null;
    }

    const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utfMatch?.[1]) {
      return decodeURIComponent(utfMatch[1].replace(/["']/g, '').trim());
    }

    const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
    return match?.[1]?.trim() ?? null;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }

  private todayForFilename(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async resolveExportError(error: HttpErrorResponse): Promise<string> {
    if (error.status === 413) {
      return 'A exportação excede o limite de 50 000 contratos. Aplique filtros mais restritos.';
    }

    const backendMessage = await this.extractBlobErrorMessage(error.error);
    if (backendMessage) {
      return backendMessage;
    }

    if (error.status === 0) {
      return 'Não foi possível comunicar com a API para preparar a exportação.';
    }

    if (error.status === 401 || error.status === 403) {
      return 'Não tem permissão para exportar estes contratos.';
    }

    if (error.status === 400) {
      return 'Os filtros ou campos selecionados não são válidos para esta exportação.';
    }

    return 'Não foi possível gerar o ficheiro Excel. Tente novamente.';
  }

  private async extractBlobErrorMessage(value: unknown): Promise<string | null> {
    if (!(value instanceof Blob)) {
      if (value && typeof value === 'object' && 'message' in value) {
        const message = (value as { message?: unknown }).message;
        return typeof message === 'string' && message.trim() ? message.trim() : null;
      }

      return null;
    }

    try {
      const text = await value.text();
      if (!text.trim()) {
        return null;
      }

      try {
        const parsed = JSON.parse(text) as { message?: unknown };
        return typeof parsed.message === 'string' && parsed.message.trim()
          ? parsed.message.trim()
          : null;
      } catch {
        return text.trim();
      }
    } catch {
      return null;
    }
  }
}
