import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-analytics-kpi-card',
  imports: [CommonModule],
  templateUrl: './analytics-kpi-card.html',
  styleUrl: './analytics-kpi-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsKpiCard {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = 0;
  @Input() supportingValue = '';
  @Input() icon = 'analytics';
  @Input() emphasis = false;
}
