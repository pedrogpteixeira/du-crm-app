import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { Company, CompanyService } from '../../../core/services/company';
import {
  ProductType,
  SimulationCalculationProfile,
  SimulationCalculationProfileEnergyConfig,
  SimulationCalculationProfileIncludedComponents,
  SimulationCalculationStrategy,
  SimulationCommissionMode,
  SimulationLossSource,
  SimulationMarketReference,
  SimulationMarketSource,
  SimulationNetworkAccessMode,
  SimulationSystemCostSource,
  SimulatorService,
} from '../../../core/services/simulator';
import { ToastService } from '../../../core/services/toast';
import { CalculationProfileCreate } from './calculation-profile-create/calculation-profile-create';

type ProfileStateFilter = '' | 'active' | 'inactive';

interface CalculationProfileFilters {
  commercializerId: string;
  productType: '' | ProductType;
  familyCode: string;
  version: string;
  strategy: '' | SimulationCalculationStrategy;
  state: ProfileStateFilter;
}

interface IncludedComponentDisplayItem {
  key: keyof SimulationCalculationProfileIncludedComponents;
  label: string;
  description: string;
  included: boolean;
}

@Component({
  selector: 'app-calculation-profiles',
  imports: [CommonModule, FormsModule, CalculationProfileCreate],
  templateUrl: './calculation-profiles.html',
  styleUrl: './calculation-profiles.scss',
})
export class CalculationProfiles implements OnInit {
  private readonly simulatorService = inject(SimulatorService);
  private readonly companyService = inject(CompanyService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  companies: Company[] = [];
  profiles: SimulationCalculationProfile[] = [];
  filteredProfiles: SimulationCalculationProfile[] = [];
  selectedProfile: SimulationCalculationProfile | null = null;

  isLoadingCompanies = false;
  isLoadingProfiles = false;
  isLoadingDetail = false;
  isCreateOpen = false;
  versionSource: SimulationCalculationProfile | null = null;
  updatingStatusProfileId: string | null = null;

  readonly strategyOptions: SimulationCalculationStrategy[] = [
    'legacy_fixed',
    'legacy_indexed',
    'indexed_cost_plus',
    'adjusted_factor_plus',
    'fixed_hedge_plus_system_cost',
    'weighted_mix',
    'gas_adjusted',
  ];

  filters: CalculationProfileFilters = this.createEmptyFilters();

  ngOnInit(): void {
    this.loadCompanies();
    this.loadProfiles();
  }

  openCreateProfile(): void {
    this.versionSource = null;
    this.isCreateOpen = true;
  }

  openCreateVersion(profile: SimulationCalculationProfile): void {
    if (!this.isLatestVersion(profile)) {
      const latest = this.getLatestFamilyVersion(profile);
      this.toast.error(
        latest
          ? `Cria a próxima versão a partir da versão atual v${latest.version}.`
          : 'Não foi possível determinar a versão atual desta família.',
      );
      return;
    }

    this.isCreateOpen = false;
    this.versionSource = profile;
  }

  closeProfileForm(): void {
    this.isCreateOpen = false;
    this.versionSource = null;
  }

  handleProfileCreated(profile: SimulationCalculationProfile): void {
    this.closeProfileForm();
    this.loadProfiles(profile.id, true);
  }

  toggleProfileActive(profile: SimulationCalculationProfile): void {
    if (this.updatingStatusProfileId) {
      return;
    }

    const nextActive = !profile.active;
    this.updatingStatusProfileId = profile.id;

    this.simulatorService
      .updateCalculationProfile(profile.id, { active: nextActive })
      .pipe(
        finalize(() => {
          this.updatingStatusProfileId = null;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (updated) => {
          this.replaceProfile(updated);
          this.selectedProfile = updated;
          this.applyFilters();
          this.toast.success(
            nextActive
              ? `Versão ${updated.version} ativada com sucesso.`
              : `Versão ${updated.version} desativada com sucesso.`,
          );
        },
        error: (error) => {
          this.toast.error(
            error?.error?.message ||
              (nextActive
                ? 'Não foi possível ativar esta versão.'
                : 'Não foi possível desativar esta versão.'),
          );
        },
      });
  }

  loadProfiles(profileIdToSelect?: string, forceRefresh = false): void {
    this.isLoadingProfiles = true;

    this.simulatorService
      .getCalculationProfiles(forceRefresh)
      .pipe(
        finalize(() => {
          this.isLoadingProfiles = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (profiles) => {
          this.profiles = this.sortProfiles(profiles);

          this.applyFilters();

          const selectionId = profileIdToSelect ?? this.selectedProfile?.id;
          if (selectionId) {
            const refreshedSelection = this.profiles.find((profile) => profile.id === selectionId);

            if (refreshedSelection) {
              if (profileIdToSelect) {
                this.selectProfile(refreshedSelection);
              } else {
                this.selectedProfile = {
                  ...this.selectedProfile,
                  ...refreshedSelection,
                } as SimulationCalculationProfile;
              }
            } else {
              this.selectedProfile = null;
            }
          }
        },
        error: (error) => {
          this.toast.error(
            error?.error?.message || 'Não foi possível carregar os perfis de cálculo.',
          );
        },
      });
  }

  applyFilters(): void {
    const familyCode = this.filters.familyCode.trim().toLocaleLowerCase('pt-PT');
    const version = this.filters.version.trim();

    this.filteredProfiles = this.profiles.filter((profile) => {
      if (
        this.filters.commercializerId &&
        !this.matchesCommercializerFilter(profile.commercializerId)
      ) {
        return false;
      }

      if (this.filters.productType && profile.productType !== this.filters.productType) {
        return false;
      }

      if (familyCode && !profile.familyCode.toLocaleLowerCase('pt-PT').includes(familyCode)) {
        return false;
      }

      if (version && String(profile.version) !== version) {
        return false;
      }

      if (this.filters.state === 'active' && !profile.active) {
        return false;
      }

      if (this.filters.state === 'inactive' && profile.active) {
        return false;
      }

      if (this.filters.strategy && !this.profileUsesStrategy(profile, this.filters.strategy)) {
        return false;
      }

      return true;
    });
  }

  clearFilters(): void {
    this.filters = this.createEmptyFilters();
    this.applyFilters();
  }

  selectProfile(profile: SimulationCalculationProfile): void {
    this.selectedProfile = profile;
    this.isLoadingDetail = true;

    this.simulatorService
      .getCalculationProfileById(profile.id)
      .pipe(
        finalize(() => {
          this.isLoadingDetail = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (detail) => {
          this.selectedProfile = detail;
        },
        error: (error) => {
          this.toast.error(
            error?.error?.message || 'Não foi possível carregar o detalhe atualizado do perfil.',
          );
        },
      });
  }

  trackByProfileId(_index: number, profile: SimulationCalculationProfile): string {
    return profile.id;
  }

  getCompanyName(commercializerId: string): string {
    const company = this.companies.find(
      (item) => item.id === commercializerId || item.domainId === commercializerId,
    );

    return company?.name || commercializerId;
  }

  getProductTypeLabel(productType: ProductType): string {
    const labels: Record<ProductType, string> = {
      electricity: 'Eletricidade',
      gas: 'Gás',
      dual: 'Luz + Gás',
    };

    return labels[productType];
  }

  getStrategyLabel(strategy: SimulationCalculationStrategy): string {
    const labels: Record<SimulationCalculationStrategy, string> = {
      legacy_fixed: 'Legacy fixo',
      legacy_indexed: 'Legacy indexado',
      indexed_cost_plus: 'Custo indexado + margem',
      adjusted_factor_plus: 'Fator ajustado + margem',
      fixed_hedge_plus_system_cost: 'Hedge fixo + custo de sistema',
      weighted_mix: 'Mix ponderado',
      gas_adjusted: 'Gás ajustado',
    };

    return labels[strategy];
  }

  getCommissionModeLabel(mode: SimulationCommissionMode): string {
    const labels: Record<SimulationCommissionMode, string> = {
      team_table: 'Tabela de equipa',
      formula_margin: 'Margem da fórmula',
      hybrid: 'Híbrida',
    };

    return labels[mode];
  }

  getMarketSourceLabel(source?: SimulationMarketSource): string {
    if (!source) {
      return '—';
    }

    const labels: Record<SimulationMarketSource, string> = {
      omie: 'OMIE',
      mibgas: 'MIBGAS',
    };

    return labels[source];
  }

  getMarketReferenceLabel(reference?: SimulationMarketReference): string {
    if (!reference) {
      return '—';
    }

    const labels: Record<SimulationMarketReference, string> = {
      isp: 'ISP',
      hourly: 'Horária',
      daily_average: 'Média diária',
      monthly_average: 'Média mensal',
    };

    return labels[reference];
  }

  getSystemCostSourceLabel(source?: SimulationSystemCostSource): string {
    if (!source) {
      return '—';
    }

    const labels: Record<SimulationSystemCostSource, string> = {
      ren_erc: 'REN / ERC',
      static: 'Estático',
      composite: 'Composto',
    };

    return labels[source];
  }

  getLossSourceLabel(source?: SimulationLossSource): string {
    if (!source) {
      return '—';
    }

    const labels: Record<SimulationLossSource, string> = {
      erse: 'ERSE',
      static: 'Estático',
      matrix: 'Matriz',
    };

    return labels[source];
  }

  getNetworkAccessModeLabel(mode?: SimulationNetworkAccessMode): string {
    if (!mode) {
      return '—';
    }

    return mode === 'included' ? 'Incluída' : 'Excluída';
  }

  getMarginLabel(config: SimulationCalculationProfileEnergyConfig): string {
    if (!config.margin) {
      return '—';
    }

    const unit = config.margin.unit === 'EUR_MWH' ? '€/MWh' : 'cênt./kWh';
    return `${config.margin.kind} · ${this.formatNumber(config.margin.value)} ${unit}`;
  }

  getIncludedComponentItems(profile: SimulationCalculationProfile): IncludedComponentDisplayItem[] {
    const included = profile.includedComponents ?? {};
    const items: IncludedComponentDisplayItem[] = [];

    if (profile.productType === 'electricity' || profile.productType === 'dual') {
      items.push(
        this.createIncludedComponentItem(
          'networkAccessPower',
          'TAR de potência',
          'Parcela regulatória de potência',
          included,
        ),
      );
    }

    if (profile.productType === 'gas' || profile.productType === 'dual') {
      items.push(
        this.createIncludedComponentItem(
          'networkAccessFixedTerm',
          'Termo fixo TAR gás',
          'Termo fixo regulatório de gás',
          included,
        ),
      );
    }

    items.push(
      this.createIncludedComponentItem(
        'networkAccessEnergy',
        'TAR de energia',
        'Parcela regulatória aplicada à energia',
        included,
      ),
      this.createIncludedComponentItem(
        'losses',
        'Perdas',
        'Perdas incorporadas no preço/fórmula',
        included,
      ),
    );

    if (profile.productType === 'electricity' || profile.productType === 'dual') {
      items.push(
        this.createIncludedComponentItem(
          'renSystemCosts',
          'REN / ERC',
          'Custos de sistema REN/ERC',
          included,
        ),
        this.createIncludedComponentItem(
          'mfrr',
          'mFRR',
          'Componente mFRR',
          included,
        ),
      );
    }

    items.push(
      this.createIncludedComponentItem(
        'guaranteesOfOrigin',
        'Garantias de origem',
        'Garantias de origem incorporadas',
        included,
      ),
      this.createIncludedComponentItem(
        'socialTariffFinancing',
        'Financiamento da tarifa social',
        'Financiamento da tarifa social incorporado',
        included,
      ),
    );

    return items;
  }

  getPreviousVersionLabel(profile: SimulationCalculationProfile): string {
    if (!profile.previousVersionId) {
      return 'Sem versão anterior';
    }

    const previous = this.profiles.find((item) => item.id === profile.previousVersionId);

    return previous ? `${previous.familyCode} · v${previous.version}` : profile.previousVersionId;
  }

  getFamilyVersions(profile: SimulationCalculationProfile): SimulationCalculationProfile[] {
    return this.profiles
      .filter((item) => this.belongsToSameFamily(item, profile))
      .sort((a, b) => b.version - a.version);
  }

  getLatestFamilyVersion(
    profile: SimulationCalculationProfile,
  ): SimulationCalculationProfile | null {
    return this.getFamilyVersions(profile)[0] ?? null;
  }

  isLatestVersion(profile: SimulationCalculationProfile): boolean {
    return this.getLatestFamilyVersion(profile)?.id === profile.id;
  }

  getVersionKindLabel(profile: SimulationCalculationProfile): string {
    return this.isLatestVersion(profile) ? 'Versão atual' : 'Histórica';
  }

  isUpdatingStatus(profile: SimulationCalculationProfile): boolean {
    return this.updatingStatusProfileId === profile.id;
  }

  getPrimaryStrategies(profile: SimulationCalculationProfile): string[] {
    const strategies = new Set<SimulationCalculationStrategy>();

    if (profile.electricity?.strategy) {
      strategies.add(profile.electricity.strategy);
    }

    if (profile.gas?.strategy) {
      strategies.add(profile.gas.strategy);
    }

    return Array.from(strategies).map((strategy) => this.getStrategyLabel(strategy));
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return '—';
    }

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return `${day}/${month}/${year}`;
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

  formatNumber(value?: number | null, maximumFractionDigits = 6): string {
    if (value === undefined || value === null) {
      return '—';
    }

    return new Intl.NumberFormat('pt-PT', {
      maximumFractionDigits,
    }).format(value);
  }

  private createIncludedComponentItem(
    key: keyof SimulationCalculationProfileIncludedComponents,
    label: string,
    description: string,
    included: SimulationCalculationProfileIncludedComponents,
  ): IncludedComponentDisplayItem {
    return {
      key,
      label,
      description,
      included: included[key] === true,
    };
  }

  private replaceProfile(updated: SimulationCalculationProfile): void {
    const exists = this.profiles.some((profile) => profile.id === updated.id);
    const nextProfiles = exists
      ? this.profiles.map((profile) => (profile.id === updated.id ? updated : profile))
      : [...this.profiles, updated];

    this.profiles = this.sortProfiles(nextProfiles);
  }

  private sortProfiles(profiles: SimulationCalculationProfile[]): SimulationCalculationProfile[] {
    return [...profiles].sort((a, b) => {
      const familyComparison = a.familyCode.localeCompare(b.familyCode, 'pt-PT', {
        sensitivity: 'base',
      });

      if (familyComparison !== 0) {
        return familyComparison;
      }

      return b.version - a.version;
    });
  }

  private belongsToSameFamily(
    first: SimulationCalculationProfile,
    second: SimulationCalculationProfile,
  ): boolean {
    return (
      first.familyCode === second.familyCode &&
      first.commercializerId === second.commercializerId &&
      first.productType === second.productType
    );
  }

  private loadCompanies(): void {
    this.isLoadingCompanies = true;

    this.companyService
      .getCompanies()
      .pipe(
        finalize(() => {
          this.isLoadingCompanies = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (companies) => {
          this.companies = [...companies].sort((a, b) =>
            a.name.localeCompare(b.name, 'pt-PT', { sensitivity: 'base' }),
          );
        },
        error: (error) => {
          this.toast.error(
            error?.error?.message || 'Não foi possível carregar as comercializadoras.',
          );
        },
      });
  }

  private matchesCommercializerFilter(profileCommercializerId: string): boolean {
    const selectedId = this.filters.commercializerId;

    if (!selectedId) {
      return true;
    }

    const selectedCompany = this.companies.find(
      (company) => company.id === selectedId || company.domainId === selectedId,
    );

    if (!selectedCompany) {
      return profileCommercializerId === selectedId;
    }

    return (
      profileCommercializerId === selectedCompany.id ||
      profileCommercializerId === selectedCompany.domainId
    );
  }

  private profileUsesStrategy(
    profile: SimulationCalculationProfile,
    strategy: SimulationCalculationStrategy,
  ): boolean {
    const configs = [profile.electricity, profile.gas].filter(
      (config): config is SimulationCalculationProfileEnergyConfig => !!config,
    );

    return configs.some(
      (config) =>
        config.strategy === strategy ||
        config.components?.some((component) => component.strategy === strategy),
    );
  }

  private createEmptyFilters(): CalculationProfileFilters {
    return {
      commercializerId: '',
      productType: '',
      familyCode: '',
      version: '',
      strategy: '',
      state: '',
    };
  }
}
