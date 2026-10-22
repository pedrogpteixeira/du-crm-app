import { ContractApiFilters } from './contract-kanban';

export type ContractExportProvider =
  | 'repsol'
  | 'portulogos'
  | 'galp-power-gas'
  | 'galp-solar'
  | 'iberdrola'
  | 'iberdrola-solar'
  | 'yes-energy'
  | 'meo-energias'
  | 'wallbox'
  | 'vodafone';

export type ContractExportMode = 'selected' | 'filtered';

export interface ContractExportField {
  key: string;
  label: string;
  type: string;
}

export interface ContractExportFieldsResponse {
  provider: ContractExportProvider | string;
  fields: ContractExportField[];
}

export interface SelectedContractExportRequest {
  mode: 'selected';
  ids: string[];
  fields: string[];
}

export interface FilteredContractExportRequest {
  mode: 'filtered';
  filters: ContractApiFilters;
  fields: string[];
}

export type ContractExportRequest = SelectedContractExportRequest | FilteredContractExportRequest;

export interface ContractExportSelectableItem {
  id: string;
}

export function buildContractExportFilters(
  filters: ContractApiFilters,
  statuses: readonly string[],
): ContractApiFilters {
  const next: ContractApiFilters = { ...filters };
  const normalizedStatuses = statuses.map((status) => status.trim()).filter(Boolean);

  if (normalizedStatuses.length === 1) {
    next['estado'] = normalizedStatuses[0];
  } else if (normalizedStatuses.length > 1) {
    next['estado'] = normalizedStatuses;
  }

  return next;
}

export class ContractExportSelection {
  readonly selectedIds = new Set<string>();

  mode: ContractExportMode = 'selected';
  modalOpen = false;

  get manualCount(): number {
    return this.selectedIds.size;
  }

  get selectedIdsArray(): string[] {
    return Array.from(this.selectedIds);
  }

  get effectiveMode(): ContractExportMode {
    if (this.mode === 'filtered') {
      return 'filtered';
    }

    return this.selectedIds.size ? 'selected' : 'filtered';
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleFromEvent(id: string, event: Event): void {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.mode = 'selected';

    if (target.checked) {
      this.selectedIds.add(id);
      return;
    }

    this.selectedIds.delete(id);
  }

  toggleVisibleFromEvent(items: readonly ContractExportSelectableItem[], event: Event): void {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.mode = 'selected';

    items.forEach((item) => {
      if (target.checked) {
        this.selectedIds.add(item.id);
      } else {
        this.selectedIds.delete(item.id);
      }
    });
  }

  areAllVisibleSelected(items: readonly ContractExportSelectableItem[]): boolean {
    return Boolean(items.length) && items.every((item) => this.selectedIds.has(item.id));
  }

  isVisibleSelectionIndeterminate(items: readonly ContractExportSelectableItem[]): boolean {
    if (!items.length) {
      return false;
    }

    const selectedVisible = items.filter((item) => this.selectedIds.has(item.id)).length;
    return selectedVisible > 0 && selectedVisible < items.length;
  }

  activateFiltered(): void {
    this.mode = 'filtered';
  }

  clear(): void {
    this.selectedIds.clear();
    this.mode = 'selected';
  }

  openModal(): void {
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
  }
}
