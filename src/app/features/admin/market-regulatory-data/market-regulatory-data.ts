import { CommonModule } from '@angular/common';
import { Component, ViewChild, inject } from '@angular/core';

import { Auth } from '../../../core/services/auth';
import { MibgasPrices } from '../mibgas-prices/mibgas-prices';
import { OmieAverages } from '../omie-averages/omie-averages';
import { RenErcValues } from '../ren-erc-values/ren-erc-values';
import { ElectricityLossData } from './components/electricity-loss-data/electricity-loss-data';
import { ElectricityTarData } from './components/electricity-tar-data/electricity-tar-data';
import { GasTarData } from './components/gas-tar-data/gas-tar-data';

type MarketRegulatoryTab =
  | 'omie'
  | 'mibgas'
  | 'ren-erc'
  | 'electricity-tar'
  | 'gas-tar'
  | 'electricity-losses';

interface MarketRegulatoryTabOption {
  id: MarketRegulatoryTab;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-market-regulatory-data',
  standalone: true,
  imports: [
    CommonModule,
    OmieAverages,
    MibgasPrices,
    RenErcValues,
    ElectricityTarData,
    GasTarData,
    ElectricityLossData,
  ],
  templateUrl: './market-regulatory-data.html',
  styleUrl: './market-regulatory-data.scss',
})
export class MarketRegulatoryData {
  private readonly auth = inject(Auth);

  @ViewChild(OmieAverages)
  private omieComponent?: OmieAverages;

  @ViewChild(MibgasPrices)
  private mibgasComponent?: MibgasPrices;

  @ViewChild(ElectricityTarData)
  private electricityTarComponent?: ElectricityTarData;

  @ViewChild(GasTarData)
  private gasTarComponent?: GasTarData;

  @ViewChild(ElectricityLossData)
  private electricityLossComponent?: ElectricityLossData;

  readonly tabs: MarketRegulatoryTabOption[] = [
    { id: 'omie', label: 'OMIE', icon: 'electric_bolt' },
    { id: 'mibgas', label: 'MIBGAS', icon: 'local_fire_department' },
    { id: 'ren-erc', label: 'REN / ERC', icon: 'account_balance' },
    { id: 'electricity-tar', label: 'TAR Eletricidade', icon: 'power' },
    { id: 'gas-tar', label: 'TAR Gás', icon: 'propane_tank' },
    { id: 'electricity-losses', label: 'Perdas E-REDES', icon: 'show_chart' },
  ];

  activeTab: MarketRegulatoryTab = 'omie';
  private omieLoading = false;

  private readonly loadedTabs = new Set<MarketRegulatoryTab>(['omie']);

  get canEdit(): boolean {
    const role = this.auth.getCurrentUser()?.role ?? '';
    return role.toLowerCase().includes('super admin');
  }

  get canRefreshActiveTab(): boolean {
    return this.activeTab !== 'ren-erc';
  }

  get isRefreshingActiveTab(): boolean {
    if (this.activeTab === 'omie') {
      return this.omieLoading;
    }

    if (this.activeTab === 'mibgas') {
      return !!this.mibgasComponent?.isLoading;
    }

    if (this.activeTab === 'electricity-tar') {
      return !!(
        this.electricityTarComponent?.isLoading ||
        this.electricityTarComponent?.isLoadingMore
      );
    }

    if (this.activeTab === 'gas-tar') {
      return !!(this.gasTarComponent?.isLoading || this.gasTarComponent?.isLoadingMore);
    }

    if (this.activeTab === 'electricity-losses') {
      return !!(
        this.electricityLossComponent?.isLoading ||
        this.electricityLossComponent?.isLoadingMore
      );
    }

    return false;
  }

  selectTab(tab: MarketRegulatoryTab): void {
    this.activeTab = tab;
    this.loadedTabs.add(tab);
  }

  onOmieLoadingChange(isLoading: boolean): void {
    this.omieLoading = isLoading;
  }

  isTabLoaded(tab: MarketRegulatoryTab): boolean {
    return this.loadedTabs.has(tab);
  }

  refreshActiveTab(): void {
    if (this.activeTab === 'omie') {
      this.omieComponent?.loadAverages(true);
      return;
    }

    if (this.activeTab === 'mibgas') {
      this.mibgasComponent?.loadPrices(true);
      return;
    }

    if (this.activeTab === 'electricity-tar') {
      this.electricityTarComponent?.refresh();
      return;
    }

    if (this.activeTab === 'gas-tar') {
      this.gasTarComponent?.refresh();
      return;
    }

    if (this.activeTab === 'electricity-losses') {
      this.electricityLossComponent?.refresh();
    }
  }

  trackTab(_index: number, tab: MarketRegulatoryTabOption): MarketRegulatoryTab {
    return tab.id;
  }
}
