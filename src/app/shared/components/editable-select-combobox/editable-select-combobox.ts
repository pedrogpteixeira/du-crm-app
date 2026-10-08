import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  Input,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

export type EditableSelectValue = string | number | null;
export type EditableSelectValueType = 'string' | 'number';

@Component({
  selector: 'app-editable-select-combobox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editable-select-combobox.html',
  styleUrl: './editable-select-combobox.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EditableSelectCombobox),
      multi: true,
    },
  ],
})
export class EditableSelectCombobox implements ControlValueAccessor {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @Input() options: readonly (string | number)[] = [];
  @Input() optionLabelPrefix = '';
  @Input() optionLabelSuffix = '';
  @Input() optionDecimalPlaces: number | null = null;
  @Input() emptyOptionLabel: string | null = null;
  @Input() emptyValue: EditableSelectValue = '';
  @Input() valueType: EditableSelectValueType = 'string';
  @Input() inputMode: 'text' | 'decimal' | 'numeric' = 'text';
  @Input() required = false;
  @Input() disabled = false;

  isOpen = false;
  displayValue = '';

  private onChange: (value: EditableSelectValue) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: EditableSelectValue | undefined): void {
    this.displayValue = value === null || value === undefined ? '' : String(value);
  }

  registerOnChange(fn: (value: EditableSelectValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.isOpen = false;
    }
  }


  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.isOpen) {
      return;
    }

    const target = event.target as Node | null;

    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  open(): void {
    if (!this.disabled) {
      this.isOpen = true;
    }
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    this.onTouched();
  }

  toggle(): void {
    if (this.disabled) {
      return;
    }

    this.isOpen = !this.isOpen;
  }

  onInput(value: string): void {
    this.displayValue = value;
    this.onChange(this.coerceValue(value));
  }

  selectOption(value: string | number): void {
    const selectedValue = this.coerceOptionValue(value);

    this.displayValue =
      selectedValue === null ? '' : String(selectedValue);
    this.onChange(selectedValue);
    this.isOpen = false;
    this.onTouched();
  }

  selectEmpty(): void {
    this.displayValue = '';
    this.onChange(this.emptyValue);
    this.isOpen = false;
    this.onTouched();
  }

  isSelected(value: string | number): boolean {
    return this.displayValue === String(value);
  }

  formatOption(value: string | number): string {
    let formatted = String(value);

    if (typeof value === 'number' && this.optionDecimalPlaces !== null) {
      formatted = value.toFixed(this.optionDecimalPlaces);
    }

    return `${this.optionLabelPrefix}${formatted}${this.optionLabelSuffix}`;
  }


  private coerceOptionValue(value: string | number): EditableSelectValue {
    if (this.valueType === 'number') {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : null;
    }

    if (typeof value === 'number' && this.optionDecimalPlaces !== null) {
      return value.toFixed(this.optionDecimalPlaces);
    }

    return String(value);
  }

  private coerceValue(value: string): EditableSelectValue {
    if (this.valueType === 'string') {
      return value;
    }

    const normalized = value.trim().replace(',', '.');

    if (!normalized) {
      return null;
    }

    const numericValue = Number(normalized);
    return Number.isFinite(numericValue) ? numericValue : null;
  }
}
