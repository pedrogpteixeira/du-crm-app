import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  inject,
} from '@angular/core';
import { NgModel } from '@angular/forms';

import { ContractFieldMask, formatContractField } from '../../core/utils/contract-field-formatting';

@Directive({
  selector: 'input[appContractMask]',
  standalone: true,
})
export class ContractFieldMaskDirective implements AfterViewInit {
  private readonly elementRef = inject(ElementRef<HTMLInputElement>);
  private readonly ngModel = inject(NgModel, {
    self: true,
    optional: true,
  });

  @Input({ required: true }) appContractMask!: ContractFieldMask;

  @HostBinding('attr.inputmode')
  get inputMode(): string | null {
    return this.appContractMask === 'email'
      ? 'email'
      : this.appContractMask === 'phone' ||
          this.appContractMask === 'postalCode' ||
          this.appContractMask === 'crc' ||
          this.appContractMask === 'iban'
        ? 'numeric'
        : 'text';
  }

  @HostBinding('attr.placeholder')
  get placeholder(): string | null {
    switch (this.appContractMask) {
      case 'crc':
        return '1234-5678-9012';
      case 'iban':
        return 'PT50 0033 0000 1234 5678 9012 3';
      case 'cpe':
        return 'PT 0002 123456789012 AA';
      case 'cui':
        return 'PT 1601 12345678 AA';
      case 'postalCode':
        return '4510-507';
      case 'phone':
        return '912345678';
      case 'email':
        return 'nome@exemplo.pt';
    }
  }

  @HostBinding('attr.maxlength')
  get maxLength(): number | null {
    switch (this.appContractMask) {
      case 'crc':
        return 14;
      case 'iban':
        return 31;
      case 'cpe':
        return 25;
      case 'cui':
        return 19;
      case 'postalCode':
        return 8;
      case 'phone':
        return 9;
      case 'email':
        return 254;
    }
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.applyMask());
  }

  @HostListener('input')
  onInput(): void {
    this.applyMask();
  }

  @HostListener('blur')
  onBlur(): void {
    this.applyMask();
  }

  private applyMask(): void {
    const input = this.elementRef.nativeElement;
    const currentValue = input.value;
    const formattedValue = formatContractField(this.appContractMask, currentValue);

    if (formattedValue !== currentValue) {
      input.value = formattedValue;
    }

    if (!this.ngModel) {
      return;
    }

    const modelValue: string | number | null =
      this.appContractMask === 'phone'
        ? formattedValue
          ? Number(formattedValue)
          : null
        : formattedValue;

    if (this.ngModel.value !== modelValue) {
      this.ngModel.control.setValue(modelValue, {
        emitEvent: false,
        emitModelToViewChange: false,
        emitViewToModelChange: false,
      });
      this.ngModel.viewToModelUpdate(modelValue);
    }
  }
}
