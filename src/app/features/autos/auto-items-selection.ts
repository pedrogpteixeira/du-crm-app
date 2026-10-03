import {
  AutoItem,
  AutoItemSelection,
  AutoMovementType,
} from '../../core/services/auto';

export type AutoTriStateFilter = 'all' | 'yes' | 'no';
export type AutoDiagnosticFilter = 'all' | 'with' | 'without';

export interface AutoItemFilters {
  search: string;
  registrationNames: string[];
  campaigns: string[];
  states: string[];
  tipoSegmentos: string[];
  movementTypes: AutoMovementType[];
  sva: AutoTriStateFilter;
  powerValues: string[];
  directDebit: AutoTriStateFilter;
  electronicInvoice: AutoTriStateFilter;
  pel: AutoTriStateFilter;
  pelPlus: AutoTriStateFilter;
  mgi: AutoTriStateFilter;
  commissionMin: number | null;
  commissionMax: number | null;
  previousSettledMin: number | null;
  previousSettledMax: number | null;
  diagnostic: AutoDiagnosticFilter;
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
    movementTypes: [],
    sva: 'all',
    powerValues: [],
    directDebit: 'all',
    electronicInvoice: 'all',
    pel: 'all',
    pelPlus: 'all',
    mgi: 'all',
    commissionMin: null,
    commissionMax: null,
    previousSettledMin: null,
    previousSettledMax: null,
    diagnostic: 'all',
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
    movementTypes: [...filters.movementTypes],
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
    filters.movementTypes.length ||
    filters.sva !== 'all' ||
    filters.powerValues.length ||
    filters.directDebit !== 'all' ||
    filters.electronicInvoice !== 'all' ||
    filters.pel !== 'all' ||
    filters.pelPlus !== 'all' ||
    filters.mgi !== 'all' ||
    filters.commissionMin !== null ||
    filters.commissionMax !== null ||
    filters.previousSettledMin !== null ||
    filters.previousSettledMax !== null ||
    filters.diagnostic !== 'all' ||
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
  if (filters.movementTypes.length) count += 1;
  if (filters.sva !== 'all') count += 1;
  if (filters.powerValues.length) count += 1;
  if (filters.directDebit !== 'all') count += 1;
  if (filters.electronicInvoice !== 'all') count += 1;
  if (filters.pel !== 'all') count += 1;
  if (filters.pelPlus !== 'all') count += 1;
  if (filters.mgi !== 'all') count += 1;
  if (filters.commissionMin !== null || filters.commissionMax !== null) count += 1;
  if (filters.previousSettledMin !== null || filters.previousSettledMax !== null) count += 1;
  if (filters.diagnostic !== 'all') count += 1;
  if (filters.signatureDateFrom || filters.signatureDateTo) count += 1;
  return count;
}

export function filterAutoItems(
  items: readonly AutoItem[],
  filters: AutoItemFilters,
): AutoItem[] {
  if (!hasActiveAutoItemFilters(filters)) {
    return [...items];
  }

  const search = normalizeText(filters.search);
  const registrationNames = new Set(filters.registrationNames);
  const campaigns = new Set(filters.campaigns);
  const states = new Set(filters.states);
  const segments = new Set(filters.tipoSegmentos);
  const movementTypes = new Set(filters.movementTypes);
  const powerValues = new Set(filters.powerValues);
  const signatureFrom = parseDateBoundary(filters.signatureDateFrom, false);
  const signatureTo = parseDateBoundary(filters.signatureDateTo, true);

  return items.filter((item) => {
    if (search && !matchesSearch(item, search)) {
      return false;
    }

    if (
      registrationNames.size &&
      (!item.registrationName || !registrationNames.has(item.registrationName))
    ) {
      return false;
    }

    if (campaigns.size && (!item.campaign || !campaigns.has(item.campaign))) {
      return false;
    }

    if (states.size && (!item.state || !states.has(item.state))) {
      return false;
    }

    if (
      segments.size &&
      (!item.tipoSegmento || !segments.has(item.tipoSegmento))
    ) {
      return false;
    }

    if (movementTypes.size && !movementTypes.has(item.movementType)) {
      return false;
    }

    if (!matchesSvaTriState(item.sva, filters.sva)) {
      return false;
    }

    if (powerValues.size && !powerValues.has(String(item.power ?? '').trim())) {
      return false;
    }

    if (!matchesTriState(item.directDebit, filters.directDebit)) {
      return false;
    }

    if (!matchesTriState(item.electronicInvoice, filters.electronicInvoice)) {
      return false;
    }

    if (!matchesTriState(item.PEL, filters.pel)) {
      return false;
    }

    if (!matchesTriState(item.PELPlus, filters.pelPlus)) {
      return false;
    }

    if (!matchesTriState(item.MGI, filters.mgi)) {
      return false;
    }

    const commission = Number(item.commission ?? 0);
    if (
      filters.commissionMin !== null &&
      commission < filters.commissionMin
    ) {
      return false;
    }
    if (
      filters.commissionMax !== null &&
      commission > filters.commissionMax
    ) {
      return false;
    }

    if (
      filters.previousSettledMin !== null ||
      filters.previousSettledMax !== null
    ) {
      if (item.previousSettledAmount === undefined) {
        return false;
      }

      const previousSettled = Number(item.previousSettledAmount);
      if (
        filters.previousSettledMin !== null &&
        previousSettled < filters.previousSettledMin
      ) {
        return false;
      }
      if (
        filters.previousSettledMax !== null &&
        previousSettled > filters.previousSettledMax
      ) {
        return false;
      }
    }

    if (filters.diagnostic !== 'all') {
      const hasDiagnostic = Boolean(item.diagnostic?.trim());
      if (filters.diagnostic === 'with' && !hasDiagnostic) {
        return false;
      }
      if (filters.diagnostic === 'without' && hasDiagnostic) {
        return false;
      }
    }

    if (signatureFrom !== null || signatureTo !== null) {
      if (!item.signatureDate) {
        return false;
      }
      const signatureDate = new Date(item.signatureDate).getTime();
      if (Number.isNaN(signatureDate)) {
        return false;
      }
      if (signatureFrom !== null && signatureDate < signatureFrom) {
        return false;
      }
      if (signatureTo !== null && signatureDate > signatureTo) {
        return false;
      }
    }

    return true;
  });
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

function matchesSvaTriState(
  value: AutoItem['sva'],
  filter: AutoTriStateFilter,
): boolean {
  if (filter === 'all') {
    return true;
  }

  const normalized = normalizeSvaBoolean(value);
  return filter === 'yes' ? normalized === true : normalized === false;
}

function normalizeSvaBoolean(value: AutoItem['sva']): boolean | undefined {
  if (value === true || value === false) {
    return value;
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return undefined;
  }

  if (['nao', 'não', 'false', '0', 'no', 'sem sva'].includes(normalized)) {
    return false;
  }

  if (['sim', 'true', '1', 'yes', 'com sva'].includes(normalized)) {
    return true;
  }

  // Alguns providers devolvem o nome/descrição do SVA em vez de um booleano.
  // Um valor textual não vazio significa que existe SVA associado.
  return true;
}

function matchesSearch(item: AutoItem, normalizedSearch: string): boolean {
  return [
    item.clientName,
    item.contractId,
    item.cpe,
    item.cui,
    item.campaign,
    item.registrationName,
    item.state,
    item.tipoSegmento,
    item.power,
    item.nif,
    item.movementType,
  ].some((value) => normalizeText(value).includes(normalizedSearch));
}

function matchesTriState(
  value: boolean | undefined,
  filter: AutoTriStateFilter,
): boolean {
  if (filter === 'all') {
    return true;
  }
  return filter === 'yes' ? value === true : value === false;
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-PT');
}

function parseDateBoundary(value: string, endOfDay: boolean): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(
    `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`,
  ).getTime();

  return Number.isNaN(parsed) ? null : parsed;
}
