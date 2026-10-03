import {
  AutoItem,
  AutoItemFilterRequest,
  AutoItemSelection,
  AutoMovementType,
} from '../../core/services/auto';

export type AutoTriStateFilter = 'all' | 'yes' | 'no';
export interface AutoItemFilters {
  search: string;
  registrationNames: string[];
  campaigns: string[];
  states: string[];
  tipoSegmentos: string[];
  productTypes: string[];
  movementTypes: AutoMovementType[];
  calculationStatuses: string[];
  sva: AutoTriStateFilter;
  powerValues: string[];
  directDebit: AutoTriStateFilter;
  electronicInvoice: AutoTriStateFilter;
  pel: AutoTriStateFilter;
  pelPlus: AutoTriStateFilter;
  mgi: AutoTriStateFilter;
  refundOutsideChargeback: AutoTriStateFilter;
  commissionMin: number | null;
  commissionMax: number | null;
  previousSettledMin: number | null;
  previousSettledMax: number | null;
  signatureDateFrom: string;
  signatureDateTo: string;
}

export type LocalAutoSelectionMode = 'all' | 'include' | 'exclude';

export interface LocalAutoSelection {
  mode: LocalAutoSelectionMode;
  itemIds: Set<string>;
}

export interface AutoSelectionFinancialSummary {
  selectedLoadedCount: number;
  paymentCount: number;
  refundCount: number;
  zeroCount: number;
  totalPositive: number;
  totalNegative: number;
  totalNet: number;
}

export function createEmptyAutoItemFilters(): AutoItemFilters {
  return {
    search: '',
    registrationNames: [],
    campaigns: [],
    states: [],
    tipoSegmentos: [],
    productTypes: [],
    movementTypes: [],
    calculationStatuses: [],
    sva: 'all',
    powerValues: [],
    directDebit: 'all',
    electronicInvoice: 'all',
    pel: 'all',
    pelPlus: 'all',
    mgi: 'all',
    refundOutsideChargeback: 'all',
    commissionMin: null,
    commissionMax: null,
    previousSettledMin: null,
    previousSettledMax: null,
    signatureDateFrom: '',
    signatureDateTo: '',
  };
}

export function cloneAutoItemFilters(filters: AutoItemFilters): AutoItemFilters {
  return {
    ...filters,
    registrationNames: [...filters.registrationNames],
    campaigns: [...filters.campaigns],
    states: [...filters.states],
    tipoSegmentos: [...filters.tipoSegmentos],
    productTypes: [...filters.productTypes],
    movementTypes: [...filters.movementTypes],
    calculationStatuses: [...filters.calculationStatuses],
    powerValues: [...filters.powerValues],
  };
}

export function hasActiveAutoItemFilters(filters: AutoItemFilters): boolean {
  return Boolean(
    filters.search.trim() ||
    filters.registrationNames.length ||
    filters.campaigns.length ||
    filters.states.length ||
    filters.tipoSegmentos.length ||
    filters.productTypes.length ||
    filters.movementTypes.length ||
    filters.calculationStatuses.length ||
    filters.sva !== 'all' ||
    filters.powerValues.length ||
    filters.directDebit !== 'all' ||
    filters.electronicInvoice !== 'all' ||
    filters.pel !== 'all' ||
    filters.pelPlus !== 'all' ||
    filters.mgi !== 'all' ||
    filters.refundOutsideChargeback !== 'all' ||
    filters.commissionMin !== null ||
    filters.commissionMax !== null ||
    filters.previousSettledMin !== null ||
    filters.previousSettledMax !== null ||
    filters.signatureDateFrom ||
    filters.signatureDateTo,
  );
}

export function countActiveAutoItemFilters(filters: AutoItemFilters): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.registrationNames.length) count += 1;
  if (filters.campaigns.length) count += 1;
  if (filters.states.length) count += 1;
  if (filters.tipoSegmentos.length) count += 1;
  if (filters.productTypes.length) count += 1;
  if (filters.movementTypes.length) count += 1;
  if (filters.calculationStatuses.length) count += 1;
  if (filters.sva !== 'all') count += 1;
  if (filters.powerValues.length) count += 1;
  if (filters.directDebit !== 'all') count += 1;
  if (filters.electronicInvoice !== 'all') count += 1;
  if (filters.pel !== 'all') count += 1;
  if (filters.pelPlus !== 'all') count += 1;
  if (filters.mgi !== 'all') count += 1;
  if (filters.refundOutsideChargeback !== 'all') count += 1;
  if (filters.commissionMin !== null || filters.commissionMax !== null) count += 1;
  if (filters.previousSettledMin !== null || filters.previousSettledMax !== null) count += 1;
  if (filters.signatureDateFrom || filters.signatureDateTo) count += 1;
  return count;
}

export function toAutoItemFilterRequest(
  filters: AutoItemFilters,
): AutoItemFilterRequest | undefined {
  const request: AutoItemFilterRequest = {};
  const search = filters.search.trim();

  if (search) request.search = search;
  if (filters.registrationNames.length) request.registrationNames = [...filters.registrationNames];
  if (filters.campaigns.length) request.campaigns = [...filters.campaigns];
  if (filters.states.length) request.states = [...filters.states];
  if (filters.tipoSegmentos.length) request.tipoSegmentos = [...filters.tipoSegmentos];
  if (filters.productTypes.length) request.productTypes = [...filters.productTypes];
  if (filters.movementTypes.length) request.movementTypes = [...filters.movementTypes];
  if (filters.calculationStatuses.length) request.calculationStatuses = [...filters.calculationStatuses];
  if (filters.powerValues.length) request.powers = [...filters.powerValues];

  assignTriState(request, 'directDebit', filters.directDebit);
  assignTriState(request, 'electronicInvoice', filters.electronicInvoice);
  assignTriState(request, 'sva', filters.sva);
  assignTriState(request, 'PEL', filters.pel);
  assignTriState(request, 'PELPlus', filters.pelPlus);
  assignTriState(request, 'MGI', filters.mgi);
  assignTriState(request, 'refundOutsideChargeback', filters.refundOutsideChargeback);

  if (filters.commissionMin !== null) request.commissionMin = filters.commissionMin;
  if (filters.commissionMax !== null) request.commissionMax = filters.commissionMax;
  if (filters.previousSettledMin !== null) request.previousSettledAmountMin = filters.previousSettledMin;
  if (filters.previousSettledMax !== null) request.previousSettledAmountMax = filters.previousSettledMax;
  if (filters.signatureDateFrom) request.signatureDateFrom = filters.signatureDateFrom;
  if (filters.signatureDateTo) request.signatureDateTo = filters.signatureDateTo;

  return Object.keys(request).length ? request : undefined;
}

function assignTriState<K extends keyof AutoItemFilterRequest>(
  target: AutoItemFilterRequest,
  key: K,
  value: AutoTriStateFilter,
): void {
  if (value === 'all') {
    return;
  }

  (target as Record<string, unknown>)[key] = value === 'yes';
}

export function createDefaultAutoSelection(): LocalAutoSelection {
  return {
    mode: 'all',
    itemIds: new Set<string>(),
  };
}

export function clearAutoSelection(): LocalAutoSelection {
  return {
    mode: 'include',
    itemIds: new Set<string>(),
  };
}

export function isAutoItemSelected(
  selection: LocalAutoSelection,
  itemId: string,
): boolean {
  if (!itemId) {
    return false;
  }

  if (selection.mode === 'all') {
    return true;
  }

  const contains = selection.itemIds.has(itemId);
  return selection.mode === 'include' ? contains : !contains;
}

export function setAutoItemSelected(
  selection: LocalAutoSelection,
  itemId: string,
  selected: boolean,
): LocalAutoSelection {
  if (!itemId) {
    return selection;
  }

  const nextIds = new Set(selection.itemIds);

  if (selection.mode === 'all') {
    if (selected) {
      return selection;
    }

    nextIds.add(itemId);
    return { mode: 'exclude', itemIds: nextIds };
  }

  if (selection.mode === 'include') {
    if (selected) {
      nextIds.add(itemId);
    } else {
      nextIds.delete(itemId);
    }
    return { mode: 'include', itemIds: nextIds };
  }

  if (selected) {
    nextIds.delete(itemId);
  } else {
    nextIds.add(itemId);
  }
  return nextIds.size
    ? { mode: 'exclude', itemIds: nextIds }
    : createDefaultAutoSelection();
}

export function setAutoItemsSelected(
  selection: LocalAutoSelection,
  itemIds: readonly string[],
  selected: boolean,
): LocalAutoSelection {
  const validIds = itemIds.filter(Boolean);
  if (!validIds.length) {
    return selection;
  }

  if (selection.mode === 'all') {
    if (selected) {
      return selection;
    }

    return {
      mode: 'exclude',
      itemIds: new Set(validIds),
    };
  }

  const nextIds = new Set(selection.itemIds);

  if (selection.mode === 'include') {
    for (const itemId of validIds) {
      if (selected) {
        nextIds.add(itemId);
      } else {
        nextIds.delete(itemId);
      }
    }

    return { mode: 'include', itemIds: nextIds };
  }

  for (const itemId of validIds) {
    if (selected) {
      nextIds.delete(itemId);
    } else {
      nextIds.add(itemId);
    }
  }

  return nextIds.size
    ? { mode: 'exclude', itemIds: nextIds }
    : createDefaultAutoSelection();
}

export function getSelectedAutoItemCount(
  selection: LocalAutoSelection,
  totalCount: number,
): number {
  const safeTotal = Math.max(0, totalCount);

  if (selection.mode === 'all') {
    return safeTotal;
  }

  if (selection.mode === 'include') {
    return Math.min(safeTotal, selection.itemIds.size);
  }

  return Math.max(0, safeTotal - selection.itemIds.size);
}

export function buildAutoItemSelection(
  selection: LocalAutoSelection,
  totalCount: number,
  allItemIds?: readonly string[],
): AutoItemSelection | undefined {
  const selectedCount = getSelectedAutoItemCount(selection, totalCount);

  if (selectedCount === 0) {
    throw new Error('Nenhum item selecionado');
  }

  if (selectedCount === totalCount || selection.mode === 'all') {
    return undefined;
  }

  const uniqueAllIds = allItemIds
    ? Array.from(new Set(allItemIds.filter(Boolean)))
    : [];

  // Só podemos inverter include/exclude quando conhecemos realmente o universo.
  if (uniqueAllIds.length === totalCount) {
    const selectedIds = uniqueAllIds.filter((itemId) =>
      isAutoItemSelected(selection, itemId),
    );
    const selectedSet = new Set(selectedIds);
    const excludedIds = uniqueAllIds.filter((itemId) => !selectedSet.has(itemId));

    if (selectedIds.length <= excludedIds.length) {
      return {
        mode: 'include',
        itemIds: selectedIds,
      };
    }

    return {
      mode: 'exclude',
      itemIds: excludedIds,
    };
  }

  // Com paginação parcial, preservar a representação local é a única opção segura.
  return {
    mode: selection.mode,
    itemIds: Array.from(selection.itemIds),
  } as AutoItemSelection;
}

export function summarizeSelectedLoadedItems(
  items: readonly AutoItem[],
  selection: LocalAutoSelection,
): AutoSelectionFinancialSummary {
  const summary: AutoSelectionFinancialSummary = {
    selectedLoadedCount: 0,
    paymentCount: 0,
    refundCount: 0,
    zeroCount: 0,
    totalPositive: 0,
    totalNegative: 0,
    totalNet: 0,
  };

  for (const item of items) {
    const itemId = getAutoItemId(item);
    if (!itemId || !isAutoItemSelected(selection, itemId)) {
      continue;
    }

    summary.selectedLoadedCount += 1;

    if (item.movementType === 'payment') {
      summary.paymentCount += 1;
    } else if (item.movementType === 'refund') {
      summary.refundCount += 1;
    } else {
      summary.zeroCount += 1;
    }

    const value = Number(item.commission ?? 0);
    if (value > 0) {
      summary.totalPositive += value;
    } else if (value < 0) {
      summary.totalNegative += value;
    }
    summary.totalNet += value;
  }

  return summary;
}

export function getAutoItemId(item: AutoItem): string {
  return item.domainId ?? item.id ?? '';
}
