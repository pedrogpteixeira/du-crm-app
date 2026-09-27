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

import {
  ContractPreflightError,
  SupplyPointReentryWarning,
} from '../../../core/services/contract-preflight';

export type ContractPreflightModalMode = 'preflight' | 'post-create';

@Component({
  selector: 'app-contract-preflight-modal',
  imports: [CommonModule],
  templateUrl: './contract-preflight-modal.html',
  styleUrl: './contract-preflight-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractPreflightModal implements AfterViewInit {
  @Input() mode: ContractPreflightModalMode = 'preflight';
  @Input() warnings: SupplyPointReentryWarning[] = [];
  @Input() errors: ContractPreflightError[] = [];
  @Input() canProceed = true;

  @Output() closed = new EventEmitter<void>();
  @Output() proceed = new EventEmitter<void>();

  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    this.dialog?.nativeElement.focus();
  }

  get isPostCreate(): boolean {
    return this.mode === 'post-create';
  }

  get isBlocking(): boolean {
    return !this.canProceed || this.errors.length > 0;
  }

  get title(): string {
    if (this.isPostCreate) {
      return this.warnings.length > 1 ? 'Contrato criado com avisos' : 'Contrato criado com aviso';
    }

    if (this.isBlocking) {
      return 'Não é possível prosseguir';
    }

    return this.warnings.length > 1
      ? `Foram encontrados ${this.warnings.length} avisos`
      : 'Possível reentrada antecipada';
  }

  get description(): string {
    if (this.isPostCreate) {
      return 'A situação do ponto de fornecimento mudou após a verificação inicial. O contrato foi criado, mas existe agora uma janela de reentrada ativa.';
    }

    if (this.isBlocking) {
      return 'A validação encontrou uma situação que impede a criação do contrato. Corrija os dados indicados e tente novamente.';
    }

    return 'O sistema encontrou um ponto de fornecimento que já esteve registado nesta comercializadora e cuja janela de reentrada ainda não terminou.';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  confirm(): void {
    if (this.isPostCreate || this.isBlocking) {
      return;
    }

    this.proceed.emit();
  }

  formatDate(value: string): string {
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

    if (dateOnlyMatch) {
      return `${dateOnlyMatch[3]}/${dateOnlyMatch[2]}/${dateOnlyMatch[1]}`;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  getReferenceDateSourceLabel(source: SupplyPointReentryWarning['referenceDateSource']): string {
    return source === 'deactivation' ? 'Data de baixa' : 'Data de ativação';
  }
}
