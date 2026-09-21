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
import { Auth } from '../../../core/services/auth';
import {
  AnalyticsBarChart,
  AnalyticsBarChartItem,
  AnalyticsBarChartViewOption,
} from '../../../shared/components/analytics-bar-chart/analytics-bar-chart';
import { AnalyticsDonutChart } from '../../../shared/components/analytics-donut-chart/analytics-donut-chart';
import { AnalyticsKpiCard } from '../../../shared/components/analytics-kpi-card/analytics-kpi-card';

type DirectDebitView = 'crm-total' | 'team-rate';

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
  imports: [
    CommonModule,
    AnalyticsKpiCard,
    AnalyticsBarChart,
    AnalyticsDonutChart,
  ],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly analyticsService = inject(AnalyticsService);
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
    { id: 'currentYear', label: 'Este ano', fullLabel: 'Este ano' },
    { id: 'all', label: 'Sempre', fullLabel: 'Sempre' },
  ];

  readonly selectedProvider = signal<AnalyticsProviderId>('repsol');
  readonly selectedPeriod = signal<AnalyticsPeriod>('all');
  readonly directDebitView = signal<DirectDebitView>('crm-total');

  readonly directDebitViewOptions: readonly AnalyticsBarChartViewOption[] = [
    { id: 'crm-total', label: 'CRM Total' },
    { id: 'team-rate', label: 'Por Equipa' },
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

  readonly states = computed(() => this.currentProviderState().states());
  readonly registrationNames = computed(() =>
    this.currentProviderState().registrationNames(),
  );
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
  readonly directDebitLoading = computed(() =>
    this.currentProviderState().directDebitLoading(),
  );
  readonly svaLoading = computed(() => this.currentProviderState().svaLoading());

  readonly statesError = computed(() => this.currentProviderState().statesError());
  readonly registrationNamesError = computed(() =>
    this.currentProviderState().registrationNamesError(),
  );
  readonly productsError = computed(() => this.currentProviderState().productsError());
  readonly segmentsError = computed(() => this.currentProviderState().segmentsError());
  readonly directDebitError = computed(() =>
    this.currentProviderState().directDebitError(),
  );
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

  /**
   * States continua a ser a fonte preferencial do total. O período apenas
   * escolhe uma chave já pré-agregada no payload; nunca recalculamos datas.
   */
  readonly totalContracts = computed<number | null>(() => {
    const period = this.selectedPeriod();
    const sources = [
      this.getTotalForPeriod(this.states(), period),
      this.getTotalForPeriod(this.registrationNames(), period),
      this.getTotalForPeriod(this.products(), period),
      this.getTotalForPeriod(this.segments(), period),
      this.getTotalForPeriod(this.directDebit(), period),
      this.getTotalForPeriod(this.sva(), period),
    ];

    return sources.find((value): value is number => value !== null) ?? null;
  });

  /** Dados completos transformados para o período, sem alterar a cache. */
  readonly registrationNamesForSelectedPeriod = computed(() =>
    this.mapDistributionItems(this.registrationNames()?.items ?? [], false),
  );

  readonly byState = computed(() =>
    this.sortByCount(this.mapDistributionItems(this.states()?.items ?? [])),
  );

  readonly byNomeRegistoCE = computed(() =>
    this.sortByCount(
      this.registrationNamesForSelectedPeriod().filter((item) => item.count > 0),
    ),
  );

  readonly byTipoProduto = computed(() =>
    this.sortByCount(this.mapDistributionItems(this.products()?.items ?? [])),
  );

  readonly byTipoSegmento = computed(() =>
    this.sortByCount(this.mapDistributionItems(this.segments()?.items ?? [])),
  );

  readonly stateUsesDonut = computed(() => {
    const length = this.byState().length;
    return length > 0 && length <= 6;
  });

  readonly directDebitTotalContracts = computed(() =>
    this.getTotalForPeriod(this.directDebit(), this.selectedPeriod()) ?? 0,
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

    return this.directDebitForSelectedPeriod()
      .filter((item) => item.directDebitCount > 0)
      .sort((a, b) => b.directDebitCount - a.directDebitCount)
      .map((item) => this.toDirectDebitChartItem(item, view));
  });

  readonly directDebitDescription = computed(() =>
    this.directDebitView() === 'crm-total'
      ? `Percentagem do total de contratos ${this.providerLabel()} correspondente a contratos com débito direto de cada Nome Registo C.U.`
      : 'Percentagem de contratos com débito direto dentro do total de contratos de cada equipa.',
  );

  readonly svaTotalContracts = computed(() =>
    this.getTotalForPeriod(this.sva(), this.selectedPeriod()) ?? 0,
  );

  readonly totalWithSva = computed(() => {
    const data = this.sva();
    if (!data) {
      return 0;
    }

    return this.getPeriodValue(
      data.totalWithSvaByPeriod,
      this.selectedPeriod(),
      data.totalWithSva,
    );
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

  loadStates(
    forceRefresh = false,
    provider: AnalyticsProviderId = this.selectedProvider(),
  ): void {
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

  loadSva(
    forceRefresh = false,
    provider: AnalyticsProviderId = this.selectedProvider(),
  ): void {
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
      percentage: this.getPeriodValue(
        item.percentages,
        period,
        item.percentage,
      ),
    }));

    return hideEmpty ? mapped.filter((item) => item.count > 0) : mapped;
  }

  private toDirectDebitPeriodItem(
    item: AnalyticsDirectDebitItem,
    period: AnalyticsPeriod,
  ): DirectDebitPeriodItem {
    const directDebitCount = this.getPeriodValue(
      item.directDebitCount,
      period,
      item.count,
    );
    const teamTotalContracts = this.getPeriodValue(
      item.teamTotalContracts,
      period,
      item.totalContractsForRegistrationName,
    );

    return {
      label: item.label,
      directDebitCount,
      teamTotalContracts,
      percentage: this.getPeriodValue(
        item.percentageByPeriod,
        period,
        item.percentage,
      ),
      percentageOfTotalContracts: this.getPeriodValue(
        item.percentageOfTotalContractsByPeriod,
        period,
        item.percentageOfTotalContracts,
      ),
      directDebitRate:
        teamTotalContracts > 0
          ? this.getPeriodValue(
              item.directDebitRateByPeriod,
              period,
              item.directDebitRate,
            )
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
        `${this.formatPercentage(item.percentageOfTotalContracts)} do total de contratos da comercializadora`,
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
}
