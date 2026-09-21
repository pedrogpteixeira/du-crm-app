import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
} from '@angular/core';

import { AnalyticsBreakdownItem } from '../../../core/models/analytics.model';

interface DonutSegment extends AnalyticsBreakdownItem {
  dashOffset: number;
  color: string;
}

@Component({
  selector: 'app-analytics-donut-chart',
  imports: [CommonModule],
  templateUrl: './analytics-donut-chart.html',
  styleUrl: './analytics-donut-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsDonutChart {
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() items: AnalyticsBreakdownItem[] = [];
  @Input() centerValue: string | number = 0;
  @Input() centerLabel = 'contratos';
  @Input() unitLabel = 'contratos';

  readonly activeSegmentIndex = signal<number | null>(null);

  private readonly palette = [
    '#008db1',
    '#415a6b',
    '#5cb7c9',
    '#64748b',
    '#84cbd8',
    '#94a3b8',
    '#176b87',
    '#b0c4ce',
  ];

  get segments(): DonutSegment[] {
    let accumulated = 0;

    return this.items.map((item, index) => {
      const segment: DonutSegment = {
        ...item,
        dashOffset: -accumulated,
        color: this.palette[index % this.palette.length],
      };

      accumulated += Math.max(0, item.percentage);

      return segment;
    });
  }

  get activeSegment(): DonutSegment | null {
    const index = this.activeSegmentIndex();

    if (index === null) {
      return null;
    }

    return this.segments[index] ?? null;
  }

  clearActiveSegment(): void {
    this.activeSegmentIndex.set(null);
  }

  setActiveSegment(index: number): void {
    this.activeSegmentIndex.set(index);
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
