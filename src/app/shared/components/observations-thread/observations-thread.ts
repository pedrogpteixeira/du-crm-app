import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ObservationHistoryEntry,
  normalizeObservationDraft,
  parseObservationHistory,
} from '../../../core/utils/observation-history';

@Component({
  selector: 'app-observations-thread',
  imports: [CommonModule, FormsModule],
  templateUrl: './observations-thread.html',
  styleUrl: './observations-thread.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObservationsThread implements OnChanges {
  @Input() title = 'Observações';
  @Input() value: string | null | undefined = '';
  @Input() draft = '';
  @Input() currentUserName = '';
  @Input() internal = false;
  @Input() canSubmit = false;
  @Input() isSubmitting = false;
  @Input() placeholder = 'Escrever uma observação...';

  @Output() draftChange = new EventEmitter<string>();
  @Output() submitObservation = new EventEmitter<string>();

  @ViewChild('threadBody') private threadBody?: ElementRef<HTMLDivElement>;

  entries: ObservationHistoryEntry[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.entries = parseObservationHistory(this.value);
      queueMicrotask(() => this.scrollToLatest());
    }
  }

  get canSend(): boolean {
    return (
      this.canSubmit &&
      !this.isSubmitting &&
      Boolean(normalizeObservationDraft(this.draft))
    );
  }

  getInitials(author: string): string {
    const words = author
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    return words.map((word) => word.charAt(0).toUpperCase()).join('') || '•';
  }

  isOwnEntry(entry: ObservationHistoryEntry): boolean {
    const normalize = (value: string) =>
      value
        .trim()
        .toLocaleLowerCase('pt-PT')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    return Boolean(
      this.currentUserName &&
        entry.isStructured &&
        normalize(entry.author) === normalize(this.currentUserName),
    );
  }

  onDraftInput(value: string): void {
    this.draftChange.emit(value);
  }

  submit(): void {
    if (!this.canSend) {
      return;
    }

    this.submitObservation.emit(this.draft);
  }

  private scrollToLatest(): void {
    const element = this.threadBody?.nativeElement;

    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }
}
