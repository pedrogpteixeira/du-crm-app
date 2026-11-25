import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-contract-delete-confirm-modal',
  imports: [CommonModule],
  templateUrl: './contract-delete-confirm-modal.html',
  styleUrl: './contract-delete-confirm-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractDeleteConfirmModal {
  @Input() open = false;
  @Input() isDeleting = false;
  @Input() contractName = '';

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
}
