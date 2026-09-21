import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

import { AnalyticsBreakdownItem } from '../../../core/models/analytics.model';

export interface AnalyticsBarChartItem extends AnalyticsBreakdownItem {
  /**
   * Percentagem usada especificamente para o comprimento da barra e para o
   * valor percentual apresentado. Quando omitida, mantém-se o cálculo
   * tradicional count / totalCount.
   */
  chartPercentage?: number;

  /** Linhas opcionais para um tooltip contextual sem acoplar o gráfico ao domínio. */
  tooltipLines?: string[];
}

export interface AnalyticsBarChartViewOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-analytics-bar-chart',
  imports: [CommonModule],
  templateUrl: './analytics-bar-chart.html',
  styleUrl: './analytics-bar-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsBarChart {
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() items: AnalyticsBarChartItem[] = [];
  @Input() unitLabel = 'contratos';
  @Input() totalCount = 0;
  @Input() viewOptions: readonly AnalyticsBarChartViewOption[] = [];
  @Input() selectedView = '';
  @Input() summaryLabel = '';
  @Input() summaryValue = '';
  @Input() summaryMeta = '';

  @Output() readonly selectedViewChange = new EventEmitter<string>();

  selectView(viewId: string): void {
    if (viewId !== this.selectedView) {
      this.selectedViewChange.emit(viewId);
    }
  }

  barPercentage(item: AnalyticsBarChartItem): number {
    if (typeof item.chartPercentage === 'number') {
      return Math.max(0, Math.min(item.chartPercentage, 100));
    }

    if (this.totalCount <= 0 || item.count <= 0) {
      return 0;
    }

    return Math.min((item.count / this.totalCount) * 100, 100);
  }

  formatPercentage(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatCount(value: number): string {
    return new Intl.NumberFormat('pt-PT').format(value);
  }
}
