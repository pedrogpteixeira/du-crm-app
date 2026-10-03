import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
} from '@angular/core';

import { AutoMovementType } from '../../../core/services/auto';

@Component({
  selector: 'app-auto-movement-description-modal',
  imports: [CommonModule],
  templateUrl: './auto-movement-description-modal.html',
  styleUrl: './auto-movement-description-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoMovementDescriptionModal implements AfterViewInit {
  @Input({ required: true }) description = '';
  @Input() movementType?: AutoMovementType;
  @Input() amount?: number | null;

  @Output() closed = new EventEmitter<void>();

  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;

  ngAfterViewInit(): void {
    this.closeButton?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  movementLabel(): string {
    if (this.movementType === 'payment') {
      return 'Pagamento';
    }

    if (this.movementType === 'refund') {
      return 'Reembolso';
    }

    return 'Sem movimento';
  }

  movementIcon(): string {
    if (this.movementType === 'payment') {
      return 'add_circle';
    }

    if (this.movementType === 'refund') {
      return 'undo';
    }

    return 'remove_circle';
  }

  formatAmount(): string {
    const numericValue = Number(this.amount ?? 0);
    const formatted = new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(numericValue);

    return numericValue > 0 ? `+${formatted}` : formatted;
  }
}
