import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, finalize } from 'rxjs';

import {
  AnalyticsBreakdownItem,
  AnalyticsDirectDebitAnalytics,
  AnalyticsDirectDebitItem,
  AnalyticsDistributionItem,
  AnalyticsPeriod,
  AnalyticsPeriodValues,
  AnalyticsProductsAnalytics,
  AnalyticsProviderId,
  AnalyticsRegistrationNamesAnalytics,
  AnalyticsSegmentsAnalytics,
  AnalyticsStatesAnalytics,
  AnalyticsSvaAnalytics,
} from '../../../core/models/analytics.model';
import { AnalyticsService } from '../../../core/services/analytics';
import { AnalyticsExcelExportService } from '../../../core/services/analytics-excel-export';
import { Auth } from '../../../core/services/auth';
import {
  AnalyticsBarChart,
  AnalyticsBarChartItem,
  AnalyticsBarChartViewOption,
} from '../../../shared/components/analytics-bar-chart/analytics-bar-chart';
import { AnalyticsDonutChart } from '../../../shared/components/analytics-donut-chart/analytics-donut-chart';
import { AnalyticsKpiCard } from '../../../shared/components/analytics-kpi-card/analytics-kpi-card';

type DirectDebitView = 'crm-total' | 'team-rate';

type BreakdownSort = 'count-desc' | 'count-asc' | 'alpha-asc' | 'alpha-desc';
type DirectDebitSort =
  'direct-debit-desc' | 'rate-desc' | 'rate-asc' | 'team-total-desc' | 'alpha-asc' | 'alpha-desc';
type ChartTopLimit = 'all' | 5 | 10 | 20;
type MinimumContracts = 0 | 2 | 5 | 10;

interface BreakdownChartFilters {
  selectedLabels: readonly string[] | null;
  sort: BreakdownSort;
  top: ChartTopLimit;
}

interface DirectDebitChartFilters {
  selectedLabels: readonly string[] | null;
  sort: DirectDebitSort;
  top: ChartTopLimit;
  minimumContracts: MinimumContracts;
  hideWithoutDirectDebit: boolean;
}

interface AnalyticsProviderConfig {
  id: AnalyticsProviderId;
  label: string;
}

interface AnalyticsPeriodOption {
  id: AnalyticsPeriod;
  label: string;
  fullLabel: string;
}

interface DirectDebitPeriodItem {
  label: string;
  directDebitCount: number;
  teamTotalContracts: number;
  percentage: number;
  percentageOfTotalContracts: number;
  directDebitRate: number;
}

interface ProviderDashboardState {
  states: WritableSignal<AnalyticsStatesAnalytics | null>;
  registrationNames: WritableSignal<AnalyticsRegistrationNamesAnalytics | null>;
  products: WritableSignal<AnalyticsProductsAnalytics | null>;
  segments: WritableSignal<AnalyticsSegmentsAnalytics | null>;
  directDebit: WritableSignal<AnalyticsDirectDebitAnalytics | null>;
  sva: WritableSignal<AnalyticsSvaAnalytics | null>;

  statesLoading: WritableSignal<boolean>;
  registrationNamesLoading: WritableSignal<boolean>;
  productsLoading: WritableSignal<boolean>;
  segmentsLoading: WritableSignal<boolean>;
  directDebitLoading: WritableSignal<boolean>;
  svaLoading: WritableSignal<boolean>;

  statesError: WritableSignal<string>;
  registrationNamesError: WritableSignal<string>;
  productsError: WritableSignal<string>;
  segmentsError: WritableSignal<string>;
  directDebitError: WritableSignal<string>;
  svaError: WritableSignal<string>;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, AnalyticsKpiCard, AnalyticsBarChart, AnalyticsDonutChart],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly analyticsExcelExportService = inject(AnalyticsExcelExportService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly providers: readonly AnalyticsProviderConfig[] = [
    { id: 'repsol', label: 'Repsol' },
    { id: 'galp-power-gas', label: 'Galp Power & Gás' },
  ];

  readonly periods: readonly AnalyticsPeriodOption[] = [
    { id: 'last7Days', label: '7 dias', fullLabel: 'Últimos 7 dias' },
    { id: 'last30Days', label: '30 dias', fullLabel: 'Últimos 30 dias' },
    { id: 'currentYear', label: 'Ano atual', fullLabel: 'Ano atual' },
    { id: 'all', label: 'Sempre', fullLabel: 'Sempre' },
  ];

  readonly selectedProvider = signal<AnalyticsProviderId>('repsol');
  readonly selectedPeriod = signal<AnalyticsPeriod>('all');
  readonly directDebitView = signal<DirectDebitView>('crm-total');
  readonly isExporting = signal(false);

  readonly stateFilters = signal<BreakdownChartFilters>(this.defaultBreakdownFilters());
  readonly stateFilterDraft = signal<BreakdownChartFilters>(this.defaultBreakdownFilters());
  readonly registrationFilters = signal<BreakdownChartFilters>(this.defaultBreakdownFilters());
  readonly registrationFilterDraft = signal<BreakdownChartFilters>(this.defaultBreakdownFilters());
  readonly directDebitFilters = signal<DirectDebitChartFilters>(this.defaultDirectDebitFilters());
  readonly directDebitFilterDraft = signal<DirectDebitChartFilters>(
    this.defaultDirectDebitFilters(),
  );

  readonly registrationFilterSearch = signal('');
  readonly directDebitFilterSearch = signal('');

  readonly directDebitViewOptions: readonly AnalyticsBarChartViewOption[] = [
    { id: 'crm-total', label: 'Peso no CRM' },
    { id: 'team-rate', label: 'Taxa por Equipa' },
  ];

  readonly hasAnalyticsAccess = this.auth.roleIncludes(['Super Admin', 'DU']);

  private readonly providerStates: Record<AnalyticsProviderId, ProviderDashboardState> = {
    repsol: this.createProviderState(),
    'galp-power-gas': this.createProviderState(),
  };

  private readonly currentProviderState = computed(
    () => this.providerStates[this.selectedProvider()],
  );

  readonly selectedProviderConfig = computed(
    () =>
      this.providers.find((provider) => provider.id === this.selectedProvider()) ??
      this.providers[0],
  );

  readonly selectedPeriodConfig = computed(
    () =>
      this.periods.find((period) => period.id === this.selectedPeriod()) ??
      this.periods[this.periods.length - 1],
  );

  readonly providerLabel = computed(() => this.selectedProviderConfig().label);
  readonly periodLabel = computed(() => this.selectedPeriodConfig().fullLabel);

  readonly stateFilterOptions = computed(() => this.sortedUniqueLabels(this.states()?.items ?? []));

  readonly registrationFilterOptions = computed(() =>
    this.sortedUniqueLabels(this.registrationNames()?.items ?? []),
  );

  readonly directDebitFilterOptions = computed(() =>
    this.sortedUniqueLabels(this.directDebit()?.items ?? []),
  );

  readonly visibleRegistrationFilterOptions = computed(() =>
    this.filterLabelsBySearch(this.registrationFilterOptions(), this.registrationFilterSearch()),
  );

  readonly visibleDirectDebitFilterOptions = computed(() =>
    this.filterLabelsBySearch(this.directDebitFilterOptions(), this.directDebitFilterSearch()),
  );

  readonly stateFilterActiveCount = computed(() =>
    this.countBreakdownActiveFilters(this.stateFilters()),
  );

  readonly registrationFilterActiveCount = computed(() =>
    this.countBreakdownActiveFilters(this.registrationFilters()),
  );

  readonly directDebitFilterActiveCount = computed(() =>
    this.countDirectDebitActiveFilters(this.directDebitFilters()),
  );

  readonly states = computed(() => this.currentProviderState().states());
  readonly registrationNames = computed(() => this.currentProviderState().registrationNames());
  readonly products = computed(() => this.currentProviderState().products());
  readonly segments = computed(() => this.currentProviderState().segments());
  readonly directDebit = computed(() => this.currentProviderState().directDebit());
  readonly sva = computed(() => this.currentProviderState().sva());

  readonly statesLoading = computed(() => this.currentProviderState().statesLoading());
  readonly registrationNamesLoading = computed(() =>
    this.currentProviderState().registrationNamesLoading(),
  );
  readonly productsLoading = computed(() => this.currentProviderState().productsLoading());
  readonly segmentsLoading = computed(() => this.currentProviderState().segmentsLoading());
  readonly directDebitLoading = computed(() => this.currentProviderState().directDebitLoading());
  readonly svaLoading = computed(() => this.currentProviderState().svaLoading());

  readonly statesError = computed(() => this.currentProviderState().statesError());
  readonly registrationNamesError = computed(() =>
    this.currentProviderState().registrationNamesError(),
  );
  readonly productsError = computed(() => this.currentProviderState().productsError());
  readonly segmentsError = computed(() => this.currentProviderState().segmentsError());
  readonly directDebitError = computed(() => this.currentProviderState().directDebitError());
  readonly svaError = computed(() => this.currentProviderState().svaError());

  readonly isLoadingAny = computed(
    () =>
      this.statesLoading() ||
      this.registrationNamesLoading() ||
      this.productsLoading() ||
      this.segmentsLoading() ||
      this.directDebitLoading() ||
      this.svaLoading(),
  );

  readonly canExport = computed(
    () =>
      this.states() !== null &&
      this.registrationNames() !== null &&
      this.products() !== null &&
      this.segments() !== null &&
      this.directDebit() !== null &&
      this.sva() !== null,
  );

  /**
   * Cada análise usa exclusivamente o total da sua própria response.
   * O frontend não cruza amostras nem recalcula qualquer período temporal.
   */
  readonly statesTotal = computed<number | null>(() =>
    this.getTotalForPeriod(this.states(), this.selectedPeriod()),
  );

  readonly registrationNamesTotal = computed<number | null>(() =>
    this.getTotalForPeriod(this.registrationNames(), this.selectedPeriod()),
  );

  readonly productsTotal = computed<number | null>(() =>
    this.getTotalForPeriod(this.products(), this.selectedPeriod()),
  );

  readonly segmentsTotal = computed<number | null>(() =>
    this.getTotalForPeriod(this.segments(), this.selectedPeriod()),
  );

  readonly statesKpiLabel = computed(() =>
    this.selectedPeriod() === 'all'
      ? `Total contratos ${this.providerLabel()}`
      : 'Contratos criados no período',
  );

  readonly statesDescription = computed(() =>
    this.selectedPeriod() === 'all'
      ? 'Estado atual de todos os contratos.'
      : 'Estado atual dos contratos criados no período selecionado.',
  );

  readonly registrationNamesDescription = computed(() =>
    this.selectedPeriod() === 'all'
      ? 'Distribuição dos contratos por registo C.U.'
      : 'Distribuição dos contratos criados no período por registo C.U.',
  );

  readonly productsDescription = computed(() =>
    this.selectedPeriod() === 'all'
      ? 'Distribuição atual dos contratos por produto.'
      : 'Distribuição por produto dos contratos criados no período selecionado.',
  );

  readonly segmentsDescription = computed(() =>
    this.selectedPeriod() === 'all'
      ? 'Distribuição atual dos contratos por segmento.'
      : 'Distribuição por segmento dos contratos criados no período selecionado.',
  );

  /** Dados completos transformados para o período, sem alterar a cache. */
  readonly stateItemsForSelectedPeriod = computed(() =>
    this.mapDistributionItems(this.states()?.items ?? []),
  );

  readonly registrationNamesForSelectedPeriod = computed(() =>
    this.mapDistributionItems(this.registrationNames()?.items ?? [], false),
  );

  readonly byState = computed(() =>
    this.applyBreakdownFilters(this.stateItemsForSelectedPeriod(), this.stateFilters()),
  );

  readonly byNomeRegistoCE = computed(() =>
    this.applyBreakdownFilters(
      this.registrationNamesForSelectedPeriod().filter((item) => item.count > 0),
      this.registrationFilters(),
    ),
  );

  readonly byTipoProduto = computed(() =>
    this.sortByCount(this.mapDistributionItems(this.products()?.items ?? [])),
  );

  readonly byTipoSegmento = computed(() =>
    this.sortByCount(this.mapDistributionItems(this.segments()?.items ?? [])),
  );

  readonly stateUsesDonut = computed(() => {
    const length = this.stateItemsForSelectedPeriod().length;
    return length > 0 && length <= 6;
  });

  readonly directDebitTotalContracts = computed(
    () => this.getTotalForPeriod(this.directDebit(), this.selectedPeriod()) ?? 0,
  );

  readonly totalWithDirectDebit = computed(() => {
    const data = this.directDebit();
    if (!data) {
      return 0;
    }

    return this.getPeriodValue(
      data.totalWithDirectDebitByPeriod,
      this.selectedPeriod(),
      data.totalWithDirectDebit,
    );
  });

  readonly percentageWithDirectDebit = computed(() => {
    const data = this.directDebit();
    if (!data) {
      return 0;
    }

    return this.getPeriodValue(
      data.percentageWithDirectDebitByPeriod,
      this.selectedPeriod(),
      data.percentageWithDirectDebit,
    );
  });

  /** Snapshot completo do Débito Direto para o período, útil também para futura exportação. */
  readonly directDebitForSelectedPeriod = computed<DirectDebitPeriodItem[]>(() => {
    const period = this.selectedPeriod();

    return (this.directDebit()?.items ?? []).map((item) =>
      this.toDirectDebitPeriodItem(item, period),
    );
  });

  readonly directDebitByNomeRegistoCE = computed<AnalyticsBarChartItem[]>(() => {
    const view = this.directDebitView();

    return this.filterDirectDebitItems(
      this.directDebitForSelectedPeriod(),
      this.directDebitFilters(),
    ).map((item) => this.toDirectDebitChartItem(item, view));
  });

  readonly directDebitDescription = computed(() => {
    const periodDescription =
      this.selectedPeriod() === 'all'
        ? 'todos os contratos'
        : 'os contratos criados no período selecionado';

    return this.directDebitView() === 'crm-total'
      ? `Peso atual do Débito Direto de cada Nome Registo C.U. em ${periodDescription}.`
      : `Percentagem atual de contratos com Débito Direto dentro de cada equipa, considerando ${periodDescription}.`;
  });

  readonly directDebitSummaryMeta = computed(() => {
    const sampleLabel =
      this.selectedPeriod() === 'all' ? 'contratos' : 'contratos criados no período';

    return `${this.formatNumber(this.totalWithDirectDebit())} de ${this.formatNumber(this.directDebitTotalContracts())} ${sampleLabel}`;
  });

  readonly svaTotalContracts = computed(
    () => this.getTotalForPeriod(this.sva(), this.selectedPeriod()) ?? 0,
  );

  readonly totalWithSva = computed(() => {
    const data = this.sva();
    if (!data) {
      return 0;
    }

    return this.getPeriodValue(data.totalWithSvaByPeriod, this.selectedPeriod(), data.totalWithSva);
  });

  readonly percentageWithSva = computed(() => {
    const data = this.sva();
    if (!data) {
      return 0;
    }

    return this.getPeriodValue(
      data.percentageWithSvaByPeriod,
      this.selectedPeriod(),
      data.percentageWithSva,
    );
  });

  readonly svaDistribution = computed(() =>
    this.mapDistributionItems(this.sva()?.distribution ?? []),
  );

  readonly svaDescription = computed(() =>
    this.selectedPeriod() === 'all'
      ? 'SVA atual em todos os contratos.'
      : 'SVA atual nos contratos criados no período selecionado.',
  );

  readonly hasNoDataForSelectedPeriod = computed(() => {
    const totals = [
      this.statesTotal(),
      this.registrationNamesTotal(),
      this.productsTotal(),
      this.segmentsTotal(),
      this.directDebit() ? this.directDebitTotalContracts() : null,
      this.sva() ? this.svaTotalContracts() : null,
    ];

    return totals.every((total) => total === 0);
  });

  constructor() {
    if (!this.hasAnalyticsAccess) {
      void this.router.navigate(['/error']);
      return;
    }

    // O primeiro acesso carrega apenas Repsol. Os providers seguintes são
    // lazy-loaded quando o utilizador os selecionar pela primeira vez.
    this.loadAnalytics();
  }

  selectProvider(provider: AnalyticsProviderId): void {
    if (provider === this.selectedProvider()) {
      return;
    }

    this.selectedProvider.set(provider);
    this.resetChartFilters();
    this.loadAnalytics();
  }

  selectPeriod(period: AnalyticsPeriod): void {
    // Apenas troca a chave usada pelos computeds. Não existe qualquer request.
    this.selectedPeriod.set(period);
  }

  selectDirectDebitView(viewId: string): void {
    if (viewId === 'crm-total' || viewId === 'team-rate') {
      this.directDebitView.set(viewId);
    }
  }

  isFilterLabelSelected(selectedLabels: readonly string[] | null, label: string): boolean {
    return selectedLabels === null || selectedLabels.includes(label);
  }

  filterSelectionLabel(selectedLabels: readonly string[] | null, total: number): string {
    if (selectedLabels === null) {
      return `Todas (${this.formatNumber(total)})`;
    }

    return `${this.formatNumber(selectedLabels.length)} de ${this.formatNumber(total)}`;
  }

  toggleStateFilterLabel(label: string): void {
    this.stateFilterDraft.update((filters) => ({
      ...filters,
      selectedLabels: this.toggleLabelSelection(
        filters.selectedLabels,
        label,
        this.stateFilterOptions(),
      ),
    }));
  }

  selectAllStateFilterLabels(): void {
    this.stateFilterDraft.update((filters) => ({ ...filters, selectedLabels: null }));
  }

  clearStateFilterLabels(): void {
    this.stateFilterDraft.update((filters) => ({ ...filters, selectedLabels: [] }));
  }

  setStateFilterSort(event: Event): void {
    const value = this.eventValue(event);
    if (this.isBreakdownSort(value)) {
      this.stateFilterDraft.update((filters) => ({ ...filters, sort: value }));
    }
  }

  setStateFilterTop(event: Event): void {
    const value = this.parseTopLimit(this.eventValue(event));
    this.stateFilterDraft.update((filters) => ({ ...filters, top: value }));
  }

  applyStateFilters(): void {
    this.stateFilters.set(this.cloneBreakdownFilters(this.stateFilterDraft()));
  }

  clearStateFilters(): void {
    const defaults = this.defaultBreakdownFilters();
    this.stateFilterDraft.set(defaults);
    this.stateFilters.set(this.cloneBreakdownFilters(defaults));
  }

  setRegistrationFilterSearch(event: Event): void {
    this.registrationFilterSearch.set(this.eventValue(event));
  }

  toggleRegistrationFilterLabel(label: string): void {
    this.registrationFilterDraft.update((filters) => ({
      ...filters,
      selectedLabels: this.toggleLabelSelection(
        filters.selectedLabels,
        label,
        this.registrationFilterOptions(),
      ),
    }));
  }

  selectAllRegistrationFilterLabels(): void {
    this.registrationFilterDraft.update((filters) => ({ ...filters, selectedLabels: null }));
  }

  clearRegistrationFilterLabels(): void {
    this.registrationFilterDraft.update((filters) => ({ ...filters, selectedLabels: [] }));
  }

  setRegistrationFilterSort(event: Event): void {
    const value = this.eventValue(event);
    if (this.isBreakdownSort(value)) {
      this.registrationFilterDraft.update((filters) => ({ ...filters, sort: value }));
    }
  }

  setRegistrationFilterTop(event: Event): void {
    const value = this.parseTopLimit(this.eventValue(event));
    this.registrationFilterDraft.update((filters) => ({ ...filters, top: value }));
  }

  applyRegistrationFilters(): void {
    this.registrationFilters.set(this.cloneBreakdownFilters(this.registrationFilterDraft()));
  }

  clearRegistrationFilters(): void {
    const defaults = this.defaultBreakdownFilters();
    this.registrationFilterSearch.set('');
    this.registrationFilterDraft.set(defaults);
    this.registrationFilters.set(this.cloneBreakdownFilters(defaults));
  }

  setDirectDebitFilterSearch(event: Event): void {
    this.directDebitFilterSearch.set(this.eventValue(event));
  }

  toggleDirectDebitFilterLabel(label: string): void {
    this.directDebitFilterDraft.update((filters) => ({
      ...filters,
      selectedLabels: this.toggleLabelSelection(
        filters.selectedLabels,
        label,
        this.directDebitFilterOptions(),
      ),
    }));
  }

  selectAllDirectDebitFilterLabels(): void {
    this.directDebitFilterDraft.update((filters) => ({ ...filters, selectedLabels: null }));
  }

  clearDirectDebitFilterLabels(): void {
    this.directDebitFilterDraft.update((filters) => ({ ...filters, selectedLabels: [] }));
  }

  setDirectDebitFilterSort(event: Event): void {
    const value = this.eventValue(event);
    if (this.isDirectDebitSort(value)) {
      this.directDebitFilterDraft.update((filters) => ({ ...filters, sort: value }));
    }
  }

  setDirectDebitFilterTop(event: Event): void {
    const value = this.parseTopLimit(this.eventValue(event));
    this.directDebitFilterDraft.update((filters) => ({ ...filters, top: value }));
  }

  setDirectDebitMinimumContracts(event: Event): void {
    const value = Number(this.eventValue(event));
    if (value === 0 || value === 2 || value === 5 || value === 10) {
      this.directDebitFilterDraft.update((filters) => ({
        ...filters,
        minimumContracts: value,
      }));
    }
  }

  toggleDirectDebitHideWithoutDirectDebit(): void {
    this.directDebitFilterDraft.update((filters) => ({
      ...filters,
      hideWithoutDirectDebit: !filters.hideWithoutDirectDebit,
    }));
  }

  applyDirectDebitFilters(): void {
    this.directDebitFilters.set(this.cloneDirectDebitFilters(this.directDebitFilterDraft()));
  }

  clearDirectDebitFilters(): void {
    const defaults = this.defaultDirectDebitFilters();
    this.directDebitFilterSearch.set('');
    this.directDebitFilterDraft.set(defaults);
    this.directDebitFilters.set(this.cloneDirectDebitFilters(defaults));
  }

  async exportAnalytics(): Promise<void> {
    const states = this.states();
    const registrationNames = this.registrationNames();
    const products = this.products();
    const segments = this.segments();
    const directDebit = this.directDebit();
    const sva = this.sva();

    if (
      this.isExporting() ||
      !states ||
      !registrationNames ||
      !products ||
      !segments ||
      !directDebit ||
      !sva
    ) {
      return;
    }

    this.isExporting.set(true);

    // Deixa o browser pintar o overlay antes da geração síncrona do XLSX.
    // Com os gráficos OpenXML a exportação pode demorar mais alguns ms.
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });

    try {
      this.analyticsExcelExportService.exportAnalytics({
        providerId: this.selectedProvider(),
        providerLabel: this.providerLabel(),
        period: this.selectedPeriod(),
        periodLabel: this.periodLabel(),
        statesTotal: this.statesTotal() ?? 0,
        states,
        registrationNames,
        products,
        segments,
        directDebit,
        sva,
      });
    } catch (error) {
      console.error('Erro ao exportar analytics para Excel:', error);
    } finally {
      this.isExporting.set(false);
    }
  }

  loadAnalytics(forceRefresh = false): void {
    if (!this.hasAnalyticsAccess) {
      return;
    }

    const provider = this.selectedProvider();

    // As seis subscriptions são iniciadas no mesmo ciclo. Cada bloco mantém
    // estado próprio e aparece assim que o respetivo endpoint responde.
    this.loadStates(forceRefresh, provider);
    this.loadRegistrationNames(forceRefresh, provider);
    this.loadProducts(forceRefresh, provider);
    this.loadSegments(forceRefresh, provider);
    this.loadDirectDebit(forceRefresh, provider);
    this.loadSva(forceRefresh, provider);
  }

  loadStates(forceRefresh = false, provider: AnalyticsProviderId = this.selectedProvider()): void {
    const state = this.providerStates[provider];

    this.loadResource(
      this.analyticsService.getStates(provider, forceRefresh),
      state.states,
      state.statesLoading,
      state.statesError,
      'Não foi possível carregar os contratos por estado.',
    );
  }

  loadRegistrationNames(
    forceRefresh = false,
    provider: AnalyticsProviderId = this.selectedProvider(),
  ): void {
    const state = this.providerStates[provider];

    this.loadResource(
      this.analyticsService.getRegistrationNames(provider, forceRefresh),
      state.registrationNames,
      state.registrationNamesLoading,
      state.registrationNamesError,
      'Não foi possível carregar os dados por Nome Registo C.U.',
    );
  }

  loadProducts(
    forceRefresh = false,
    provider: AnalyticsProviderId = this.selectedProvider(),
  ): void {
    const state = this.providerStates[provider];

    this.loadResource(
      this.analyticsService.getProducts(provider, forceRefresh),
      state.products,
      state.productsLoading,
      state.productsError,
      'Não foi possível carregar os contratos por tipo de produto.',
    );
  }

  loadSegments(
    forceRefresh = false,
    provider: AnalyticsProviderId = this.selectedProvider(),
  ): void {
    const state = this.providerStates[provider];

    this.loadResource(
      this.analyticsService.getSegments(provider, forceRefresh),
      state.segments,
      state.segmentsLoading,
      state.segmentsError,
      'Não foi possível carregar os contratos por segmento.',
    );
  }

  loadDirectDebit(
    forceRefresh = false,
    provider: AnalyticsProviderId = this.selectedProvider(),
  ): void {
    const state = this.providerStates[provider];

    this.loadResource(
      this.analyticsService.getDirectDebitRegistrationNames(provider, forceRefresh),
      state.directDebit,
      state.directDebitLoading,
      state.directDebitError,
      'Não foi possível carregar os dados de débito direto.',
    );
  }

  loadSva(forceRefresh = false, provider: AnalyticsProviderId = this.selectedProvider()): void {
    const state = this.providerStates[provider];

    this.loadResource(
      this.analyticsService.getSva(provider, forceRefresh),
      state.sva,
      state.svaLoading,
      state.svaError,
      'Não foi possível carregar os dados de SVA.',
    );
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('pt-PT').format(value);
  }

  formatPercentage(value: number): string {
    return `${new Intl.NumberFormat('pt-PT', {
      maximumFractionDigits: 2,
    }).format(value)}%`;
  }

  private createProviderState(): ProviderDashboardState {
    return {
      states: signal<AnalyticsStatesAnalytics | null>(null),
      registrationNames: signal<AnalyticsRegistrationNamesAnalytics | null>(null),
      products: signal<AnalyticsProductsAnalytics | null>(null),
      segments: signal<AnalyticsSegmentsAnalytics | null>(null),
      directDebit: signal<AnalyticsDirectDebitAnalytics | null>(null),
      sva: signal<AnalyticsSvaAnalytics | null>(null),

      statesLoading: signal(false),
      registrationNamesLoading: signal(false),
      productsLoading: signal(false),
      segmentsLoading: signal(false),
      directDebitLoading: signal(false),
      svaLoading: signal(false),

      statesError: signal(''),
      registrationNamesError: signal(''),
      productsError: signal(''),
      segmentsError: signal(''),
      directDebitError: signal(''),
      svaError: signal(''),
    };
  }

  private loadResource<T>(
    request$: Observable<T>,
    data: WritableSignal<T | null>,
    loading: WritableSignal<boolean>,
    errorMessage: WritableSignal<string>,
    fallbackError: string,
  ): void {
    loading.set(true);
    errorMessage.set('');

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => loading.set(false)),
      )
      .subscribe({
        next: (response) => data.set(response),
        error: (error: unknown) => {
          // Não limpar data: num refresh falhado, os dados válidos anteriores
          // continuam visíveis apenas com um aviso neste bloco.
          errorMessage.set(this.getErrorMessage(error, fallbackError));
        },
      });
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object' || !('error' in error)) {
      return fallback;
    }

    const responseError = (error as { error?: unknown }).error;

    if (
      responseError &&
      typeof responseError === 'object' &&
      'message' in responseError &&
      typeof (responseError as { message?: unknown }).message === 'string'
    ) {
      return (responseError as { message: string }).message;
    }

    return fallback;
  }

  private mapDistributionItems(
    items: readonly AnalyticsDistributionItem[],
    hideEmpty = true,
  ): AnalyticsBreakdownItem[] {
    const period = this.selectedPeriod();

    const mapped = items.map((item) => ({
      label: item.label,
      count: this.getPeriodValue(item.counts, period, item.count),
      percentage: this.getPeriodValue(item.percentages, period, item.percentage),
    }));

    return hideEmpty ? mapped.filter((item) => item.count > 0) : mapped;
  }

  private toDirectDebitPeriodItem(
    item: AnalyticsDirectDebitItem,
    period: AnalyticsPeriod,
  ): DirectDebitPeriodItem {
    const directDebitCount = this.getPeriodValue(item.directDebitCount, period, item.count);
    const teamTotalContracts = this.getPeriodValue(
      item.teamTotalContracts,
      period,
      item.totalContractsForRegistrationName,
    );

    return {
      label: item.label,
      directDebitCount,
      teamTotalContracts,
      percentage: this.getPeriodValue(item.percentageByPeriod, period, item.percentage),
      percentageOfTotalContracts: this.getPeriodValue(
        item.percentageOfTotalContractsByPeriod,
        period,
        item.percentageOfTotalContracts,
      ),
      directDebitRate:
        teamTotalContracts > 0
          ? this.getPeriodValue(item.directDebitRateByPeriod, period, item.directDebitRate)
          : 0,
    };
  }

  private toDirectDebitChartItem(
    item: DirectDebitPeriodItem,
    view: DirectDebitView,
  ): AnalyticsBarChartItem {
    if (view === 'team-rate') {
      return {
        label: item.label,
        count: item.directDebitCount,
        percentage: item.percentage,
        chartPercentage: item.directDebitRate,
        tooltipLines: [
          `${this.formatNumber(item.directDebitCount)} de ${this.formatNumber(item.teamTotalContracts)} contratos`,
          `${this.formatPercentage(item.directDebitRate)} com débito direto`,
        ],
      };
    }

    return {
      label: item.label,
      count: item.directDebitCount,
      percentage: item.percentage,
      chartPercentage: item.percentageOfTotalContracts,
      tooltipLines: [
        `${this.formatNumber(item.directDebitCount)} contratos com débito direto`,
        `${this.formatPercentage(item.percentageOfTotalContracts)} ${
          this.selectedPeriod() === 'all'
            ? 'do total de contratos'
            : 'do total de contratos criados no período'
        }`,
        `Total da equipa: ${this.formatNumber(item.teamTotalContracts)} contratos`,
      ],
    };
  }

  private getTotalForPeriod(
    data: { totalContracts: number; totals: AnalyticsPeriodValues } | null,
    period: AnalyticsPeriod,
  ): number | null {
    if (!data) {
      return null;
    }

    return this.getPeriodValue(data.totals, period, data.totalContracts);
  }

  private getPeriodValue(
    values: AnalyticsPeriodValues | undefined,
    period: AnalyticsPeriod,
    allFallback = 0,
  ): number {
    const value = values?.[period];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    return period === 'all' && Number.isFinite(allFallback) ? allFallback : 0;
  }

  private sortByCount(items: AnalyticsBreakdownItem[]): AnalyticsBreakdownItem[] {
    return [...items].sort((a, b) => b.count - a.count);
  }

  private defaultBreakdownFilters(): BreakdownChartFilters {
    return {
      selectedLabels: null,
      sort: 'count-desc',
      top: 'all',
    };
  }

  private defaultDirectDebitFilters(): DirectDebitChartFilters {
    return {
      selectedLabels: null,
      sort: 'direct-debit-desc',
      top: 'all',
      minimumContracts: 0,
      hideWithoutDirectDebit: true,
    };
  }

  private cloneBreakdownFilters(filters: BreakdownChartFilters): BreakdownChartFilters {
    return {
      ...filters,
      selectedLabels: filters.selectedLabels === null ? null : [...filters.selectedLabels],
    };
  }

  private cloneDirectDebitFilters(filters: DirectDebitChartFilters): DirectDebitChartFilters {
    return {
      ...filters,
      selectedLabels: filters.selectedLabels === null ? null : [...filters.selectedLabels],
    };
  }

  private applyBreakdownFilters(
    items: readonly AnalyticsBreakdownItem[],
    filters: BreakdownChartFilters,
  ): AnalyticsBreakdownItem[] {
    let result = [...items];

    if (filters.selectedLabels !== null) {
      const selected = new Set(filters.selectedLabels);
      result = result.filter((item) => selected.has(item.label));
    }

    result.sort((a, b) => {
      switch (filters.sort) {
        case 'count-asc':
          return a.count - b.count;
        case 'alpha-asc':
          return a.label.localeCompare(b.label, 'pt-PT');
        case 'alpha-desc':
          return b.label.localeCompare(a.label, 'pt-PT');
        case 'count-desc':
        default:
          return b.count - a.count;
      }
    });

    return filters.top === 'all' ? result : result.slice(0, filters.top);
  }

  private filterDirectDebitItems(
    items: readonly DirectDebitPeriodItem[],
    filters: DirectDebitChartFilters,
  ): DirectDebitPeriodItem[] {
    let result = [...items];

    if (filters.selectedLabels !== null) {
      const selected = new Set(filters.selectedLabels);
      result = result.filter((item) => selected.has(item.label));
    }

    if (filters.minimumContracts > 0) {
      result = result.filter((item) => item.teamTotalContracts >= filters.minimumContracts);
    }

    if (filters.hideWithoutDirectDebit) {
      result = result.filter((item) => item.directDebitCount > 0);
    }

    result.sort((a, b) => {
      switch (filters.sort) {
        case 'rate-desc':
          return (
            b.directDebitRate - a.directDebitRate || b.teamTotalContracts - a.teamTotalContracts
          );
        case 'rate-asc':
          return (
            a.directDebitRate - b.directDebitRate || b.teamTotalContracts - a.teamTotalContracts
          );
        case 'team-total-desc':
          return (
            b.teamTotalContracts - a.teamTotalContracts || b.directDebitCount - a.directDebitCount
          );
        case 'alpha-asc':
          return a.label.localeCompare(b.label, 'pt-PT');
        case 'alpha-desc':
          return b.label.localeCompare(a.label, 'pt-PT');
        case 'direct-debit-desc':
        default:
          return b.directDebitCount - a.directDebitCount;
      }
    });

    return filters.top === 'all' ? result : result.slice(0, filters.top);
  }

  private toggleLabelSelection(
    selectedLabels: readonly string[] | null,
    label: string,
    allLabels: readonly string[],
  ): readonly string[] | null {
    const selected = selectedLabels === null ? new Set(allLabels) : new Set(selectedLabels);

    if (selected.has(label)) {
      selected.delete(label);
    } else {
      selected.add(label);
    }

    if (selected.size === allLabels.length && allLabels.every((item) => selected.has(item))) {
      return null;
    }

    return allLabels.filter((item) => selected.has(item));
  }

  private sortedUniqueLabels(items: readonly { label: string }[]): string[] {
    return [...new Set(items.map((item) => item.label))].sort((a, b) =>
      a.localeCompare(b, 'pt-PT'),
    );
  }

  private filterLabelsBySearch(labels: readonly string[], search: string): string[] {
    const normalized = search.trim().toLocaleLowerCase('pt-PT');
    if (!normalized) {
      return [...labels];
    }

    return labels.filter((label) => label.toLocaleLowerCase('pt-PT').includes(normalized));
  }

  private countBreakdownActiveFilters(filters: BreakdownChartFilters): number {
    return (
      Number(filters.selectedLabels !== null) +
      Number(filters.sort !== 'count-desc') +
      Number(filters.top !== 'all')
    );
  }

  private countDirectDebitActiveFilters(filters: DirectDebitChartFilters): number {
    return (
      Number(filters.selectedLabels !== null) +
      Number(filters.sort !== 'direct-debit-desc') +
      Number(filters.top !== 'all') +
      Number(filters.minimumContracts !== 0) +
      Number(!filters.hideWithoutDirectDebit)
    );
  }

  private resetChartFilters(): void {
    const breakdownDefaults = this.defaultBreakdownFilters();
    const directDebitDefaults = this.defaultDirectDebitFilters();

    this.stateFilterDraft.set(breakdownDefaults);
    this.stateFilters.set(this.cloneBreakdownFilters(breakdownDefaults));
    this.registrationFilterDraft.set(this.defaultBreakdownFilters());
    this.registrationFilters.set(this.defaultBreakdownFilters());
    this.directDebitFilterDraft.set(directDebitDefaults);
    this.directDebitFilters.set(this.cloneDirectDebitFilters(directDebitDefaults));
    this.registrationFilterSearch.set('');
    this.directDebitFilterSearch.set('');
  }

  private eventValue(event: Event): string {
    const target = event.target;
    return target instanceof HTMLInputElement || target instanceof HTMLSelectElement
      ? target.value
      : '';
  }

  private parseTopLimit(value: string): ChartTopLimit {
    if (value === '5') {
      return 5;
    }
    if (value === '10') {
      return 10;
    }
    if (value === '20') {
      return 20;
    }
    return 'all';
  }

  private isBreakdownSort(value: string): value is BreakdownSort {
    return (
      value === 'count-desc' ||
      value === 'count-asc' ||
      value === 'alpha-asc' ||
      value === 'alpha-desc'
    );
  }

  private isDirectDebitSort(value: string): value is DirectDebitSort {
    return (
      value === 'direct-debit-desc' ||
      value === 'rate-desc' ||
      value === 'rate-asc' ||
      value === 'team-total-desc' ||
      value === 'alpha-asc' ||
      value === 'alpha-desc'
    );
  }
}
