import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  SimulatorRequest,
  SimulatorResult,
  SimulatorService,
} from '../../core/services/simulator';

import {
  ELECTRICITY_POWERS,
  OTHER_POWER,
} from '../../core/constants/energy';

type PowerKvaSelection = number | typeof OTHER_POWER;

@Component({
  selector: 'app-simulator',
  imports: [CommonModule, FormsModule],
  templateUrl: './simulator.html',
  styleUrl: './simulator.scss',
})
export class Simulator {
  private readonly simulatorService = inject(SimulatorService);

  hasSimulation = false;
  isLoading = false;
  errorMessage = '';

  hasLogoError: Record<string, boolean> = {};

  readonly availablePowers = ELECTRICITY_POWERS;
  readonly otherPowerValue = OTHER_POWER;

  customPower: number | null = null;

  form: Omit<SimulatorRequest, 'powerKva'> & {
    powerKva: PowerKvaSelection;
  } = {
    productType: 'electricity',
    segment: 'business',
    tariffType: 'simple',
    powerKva: 6.9,
    monthlyConsumptionKwh: 350,
  };

  results: SimulatorResult[] = [];

  simulate(): void {
    const powerKva =
      this.form.powerKva === OTHER_POWER
        ? this.customPower
        : this.form.powerKva;

    if (!powerKva) {
      this.errorMessage = 'A potência contratada é obrigatória.';
      return;
    }

    const payload: SimulatorRequest = {
      ...this.form,
      powerKva,
    };

    this.isLoading = true;
    this.errorMessage = '';
    this.results = [];
    this.hasSimulation = false;

    this.simulatorService.simulate(payload).subscribe({
      next: (results) => {
        this.results = results;
        this.hasSimulation = true;
      },
      error: () => {
        this.errorMessage =
          'Não foi possível realizar a simulação.';
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  }

  getProviderLogo(providerName: string): string | null {
    const logos: Record<string, string> = {
      Repsol: 'assets/companies/repsol.png',
      'Meo Energias': 'assets/companies/meo.png',
      MEO: 'assets/companies/meo.png',
    };

    return logos[providerName] ?? null;
  }

  onLogoError(provider: string): void {
    this.hasLogoError[provider] = true;
  }

  getTariffTypeLabel(tariffType: string): string {
    const labels: Record<string, string> = {
      simple: 'Simples',
      bi_hourly: 'Bi-horário',
      'bi-hourly': 'Bi-horário',
      tri_hourly: 'Tri-horário',
      'tri-hourly': 'Tri-horário',
    };

    return labels[tariffType] || tariffType;
  }
}