import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  SimulatorRequest,
  SimulatorResult,
  SimulatorService,
} from '../../core/services/simulator';

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

  form: SimulatorRequest = {
    productType: 'electricity',
    segment: 'business',
    tariffType: 'simple',
    powerKva: 6.9,
    monthlyConsumptionKwh: 350,
  };

  results: SimulatorResult[] = [];

  simulate(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.results = [];
    this.hasSimulation = false;

    this.simulatorService.simulate(this.form).subscribe({
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
}