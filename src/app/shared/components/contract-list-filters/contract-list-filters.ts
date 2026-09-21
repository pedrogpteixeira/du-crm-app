import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ContractFilterFieldDefinition,
  contractFiltersEqual,
  countActiveContractFilters,
} from '../../../core/utils/contract-list-filters';

interface ContractFilterGroup {
  name: string;
  fields: readonly ContractFilterFieldDefinition[];
}

@Component({
  selector: 'app-contract-list-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contract-list-filters.html',
  styleUrl: './contract-list-filters.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractListFiltersComponent implements OnChanges {
  @Input({ required: true }) fields: readonly ContractFilterFieldDefinition[] = [];
  @Input({ required: true }) statuses: readonly string[] = [];
  @Input({ required: true }) value: any = {};
  @Input({ required: true }) appliedValue: any = {};
  @Input() loadedCount = 0;
  @Input() hasMore = false;
  @Input() isLoading = false;

  @Output() readonly valueChange = new EventEmitter<any>();
  @Output() readonly applyFilters = new EventEmitter<void>();
  @Output() readonly resetFilters = new EventEmitter<void>();

  filterGroups: readonly ContractFilterGroup[] = [];
  activeGroup = '';
  visibleFields: readonly ContractFilterFieldDefinition[] = [];
  statusMenuOpen = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields']) {
      this.rebuildGroups();
    }
  }

  get selectedStatuses(): string[] {
    return Array.isArray(this.value['status']) ? (this.value['status'] as string[]) : [];
  }

  get draftFilterCount(): number {
    return countActiveContractFilters(this.value);
  }

  get hasAppliedFilters(): boolean {
    return countActiveContractFilters(this.appliedValue) > 0;
  }

  get hasPendingChanges(): boolean {
    return !contractFiltersEqual(this.value, this.appliedValue);
  }

  get activeFields(): readonly ContractFilterFieldDefinition[] {
    return this.fields.filter((field) => this.hasFieldValue(field));
  }

  get activeGroupFilterCount(): number {
    return this.getGroupFilterCount(this.activeGroup);
  }

  selectGroup(group: string): void {
    if (this.activeGroup === group) {
      return;
    }

    this.activeGroup = group;
    this.visibleFields = this.getFieldsForGroup(group);
    this.statusMenuOpen = false;
  }

  getGroupFilterCount(group: string): number {
    if (!group) {
      return 0;
    }

    return this.getFieldsForGroup(group).reduce(
      (count, field) => count + (this.hasFieldValue(field) ? 1 : 0),
      0,
    );
  }

  updateValue(key: string, nextValue: unknown): void {
    this.valueChange.emit({
      ...this.value,
      [key]: nextValue,
    });
  }

  removeFilter(field: ContractFilterFieldDefinition, event?: MouseEvent): void {
    event?.stopPropagation();
    this.updateValue(field.key, field.type === 'status' ? [] : '');
  }

  toggleStatusMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.statusMenuOpen = !this.statusMenuOpen;
  }

  toggleStatus(status: string, event: MouseEvent): void {
    event.stopPropagation();
    const selected = new Set(this.selectedStatuses);

    if (selected.has(status)) {
      selected.delete(status);
    } else {
      selected.add(status);
    }

    this.updateValue(
      'status',
      this.statuses.filter((candidate) => selected.has(candidate)),
    );
  }

  clearStatuses(event: MouseEvent): void {
    event.stopPropagation();
    this.updateValue('status', []);
  }

  isStatusSelected(status: string): boolean {
    return this.selectedStatuses.includes(status);
  }

  get statusSummary(): string {
    if (!this.selectedStatuses.length) {
      return 'Todos os estados';
    }

    if (this.selectedStatuses.length === 1) {
      return this.selectedStatuses[0];
    }

    return `${this.selectedStatuses.length} estados selecionados`;
  }

  getFilterValueLabel(field: ContractFilterFieldDefinition): string {
    const filterValue = this.value[field.key];

    if (field.type === 'status') {
      const selected = Array.isArray(filterValue) ? filterValue : [];

      if (selected.length === 1) {
        return selected[0];
      }

      return `${selected.length} estados`;
    }

    if (field.type === 'boolean') {
      return filterValue === 'true' ? 'Sim' : 'Não';
    }

    if (field.type === 'select') {
      return field.options?.find((option) => option.value === filterValue)?.label ?? String(filterValue);
    }

    return String(filterValue ?? '');
  }

  apply(): void {
    this.statusMenuOpen = false;
    this.applyFilters.emit();
  }

  reset(): void {
    this.statusMenuOpen = false;
    this.resetFilters.emit();
  }

  trackField(_: number, field: ContractFilterFieldDefinition): string {
    return field.key;
  }

  trackGroup(_: number, group: ContractFilterGroup): string {
    return group.name;
  }

  @HostListener('document:click')
  closeStatusMenu(): void {
    this.statusMenuOpen = false;
  }

  private rebuildGroups(): void {
    const groupMap = new Map<string, ContractFilterFieldDefinition[]>();

    this.fields.forEach((field) => {
      const group = field.group || 'Filtros';
      const groupFields = groupMap.get(group) ?? [];
      groupFields.push(field);
      groupMap.set(group, groupFields);
    });

    this.filterGroups = Array.from(groupMap.entries()).map(([name, groupFields]) => ({
      name,
      fields: groupFields,
    }));

    const activeGroupStillExists = this.filterGroups.some((group) => group.name === this.activeGroup);

    if (!activeGroupStillExists) {
      const groupWithSelection = this.filterGroups.find((group) =>
        group.fields.some((field) => this.hasFieldValue(field)),
      );

      this.activeGroup = groupWithSelection?.name ?? this.filterGroups[0]?.name ?? '';
    }

    this.visibleFields = this.getFieldsForGroup(this.activeGroup);
  }

  private getFieldsForGroup(group: string): readonly ContractFilterFieldDefinition[] {
    return this.filterGroups.find((item) => item.name === group)?.fields ?? [];
  }

  private hasFieldValue(field: ContractFilterFieldDefinition): boolean {
    const fieldValue = this.value?.[field.key];

    if (Array.isArray(fieldValue)) {
      return fieldValue.length > 0;
    }

    if (typeof fieldValue === 'string') {
      return fieldValue.trim().length > 0;
    }

    return fieldValue !== null && fieldValue !== undefined && fieldValue !== false;
  }
}
