import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize, Subscription } from 'rxjs';

import {
  IndexedGasPrice,
  IndexedGasProductType,
} from '../../../core/models/indexed-gas-price.model';

import { IndexedGasPriceService } from '../../../core/services/indexed-gas-price';
import { ToastService } from '../../../core/services/toast';

interface MibgasPriceForm {
  priceMwh: FormControl<number | null>;
  priceKwh: FormControl<number | null>;
}

interface MibgasPriceCard {
  price: IndexedGasPrice;
  form: FormGroup<MibgasPriceForm>;

  isSaving: boolean;

}

@Component({
  selector: 'app-mibgas-prices',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './mibgas-prices.html',
  styleUrl: './mibgas-prices.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MibgasPrices implements OnInit, OnDestroy {
  private readonly indexedGasPriceService = inject(IndexedGasPriceService);
  private readonly toast = inject(ToastService);

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  private formSubscriptions = new Subscription();

  cards: MibgasPriceCard[] = [];

  isLoading = false;
  loadErrorMessage = '';

  @Input()
  canEdit = false;

  editingId: string | null = null;

  private readonly productOrder: Record<IndexedGasProductType, number> = {
    daily: 1,
    next_month: 2,
    next_quarter: 3,
  };

  ngOnInit(): void {
    this.indexedGasPriceService.pricesInvalidated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadPrices(true);
      });

    this.loadPrices();
  }

  ngOnDestroy(): void {
    this.formSubscriptions.unsubscribe();
  }

  loadPrices(forceRefresh = false): void {
    this.isLoading = true;
    this.loadErrorMessage = '';

    this.indexedGasPriceService
      .getPrices(forceRefresh)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (prices) => {
          const sortedPrices = [...prices].sort(
            (first, second) =>
              this.productOrder[first.productType] - this.productOrder[second.productType],
          );

          this.buildCards(sortedPrices);
        },
        error: (error) => {
          this.loadErrorMessage =
            error?.error?.message || 'Não foi possível carregar os preços MIBGAS.';
        },
      });
  }

  savePrice(card: MibgasPriceCard): void {
    if (!this.canEdit) {
      this.toast.error('Não tens permissão para editar preços MIBGAS.');

      this.cdr.markForCheck();
      return;
    }

    if (card.isSaving || card.form.invalid || card.form.pristine) {
      card.form.markAllAsTouched();
      return;
    }

    const priceMwh = card.form.controls.priceMwh.value;

    if (!this.isValidPrice(priceMwh)) {
      this.toast.error('Introduz um preço válido em €/MWh.');

      this.cdr.markForCheck();
      return;
    }

    card.isSaving = true;

    this.indexedGasPriceService
      .updatePrice(card.price.id, {
        priceMwh: Number(priceMwh),
      })
      .pipe(
        finalize(() => {
          card.isSaving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (updatedPrice) => {
          card.price = updatedPrice;

          card.form.setValue(
            {
              priceMwh: updatedPrice.priceMwh,
              priceKwh: updatedPrice.priceKwh,
            },
            {
              emitEvent: false,
            },
          );

          card.form.markAsPristine();
          card.form.markAsUntouched();

          this.toast.success('Preço MIBGAS atualizado com sucesso.');

          this.editingId = null;
        },
        error: (error) => {
          this.toast.error(
            error?.error?.message || 'Não foi possível atualizar o preço MIBGAS.',
          );
        },
      });
  }

  resetCard(card: MibgasPriceCard): void {
    card.form.setValue(
      {
        priceMwh: card.price.priceMwh,
        priceKwh: card.price.priceKwh,
      },
      {
        emitEvent: false,
      },
    );

    card.form.markAsPristine();
    card.form.markAsUntouched();

  }

  getProductLabel(productType: IndexedGasProductType): string {
    const labels: Record<IndexedGasProductType, string> = {
      daily: 'Preço diário',
      next_month: 'Próximo mês',
      next_quarter: 'Próximo trimestre',
    };

    return labels[productType];
  }

  formatDateTime(value?: string): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  trackByPriceId(_index: number, card: MibgasPriceCard): string {
    return card.price.id;
  }

  private buildCards(prices: IndexedGasPrice[]): void {
    this.formSubscriptions.unsubscribe();
    this.formSubscriptions = new Subscription();

    this.cards = prices.map((price) => {
      const card: MibgasPriceCard = {
        price,
        form: this.createPriceForm(price),
        isSaving: false,
      };

      this.listenToPriceChanges(card);

      return card;
    });

    this.cdr.markForCheck();
  }

  private createPriceForm(price: IndexedGasPrice): FormGroup<MibgasPriceForm> {
    return new FormGroup<MibgasPriceForm>({
      priceMwh: new FormControl<number | null>(price.priceMwh, {
        validators: [Validators.required, Validators.min(0), this.finiteNumberValidator],
      }),

      priceKwh: new FormControl<number | null>(price.priceKwh, {
        validators: [Validators.required, Validators.min(0), this.finiteNumberValidator],
      }),
    });
  }

  private listenToPriceChanges(card: MibgasPriceCard): void {
    const priceMwhSubscription = card.form.controls.priceMwh.valueChanges.subscribe((priceMwh) => {
      if (!this.isValidPrice(priceMwh)) {
        return;
      }

      const priceKwh = Number(priceMwh) / 1000;

      card.form.controls.priceKwh.setValue(this.roundPrice(priceKwh, 9), {
        emitEvent: false,
      });

    });

    const priceKwhSubscription = card.form.controls.priceKwh.valueChanges.subscribe((priceKwh) => {
      if (!this.isValidPrice(priceKwh)) {
        return;
      }

      const priceMwh = Number(priceKwh) * 1000;

      card.form.controls.priceMwh.setValue(this.roundPrice(priceMwh, 6), {
        emitEvent: false,
      });

    });

    this.formSubscriptions.add(priceMwhSubscription);
    this.formSubscriptions.add(priceKwhSubscription);
  }

  private finiteNumberValidator(control: AbstractControl): ValidationErrors | null {
    const value = Number(control.value);

    if (!Number.isFinite(value)) {
      return {
        finiteNumber: true,
      };
    }

    return null;
  }

  private isValidPrice(value: number | null | undefined): value is number {
    if (value === null || value === undefined) {
      return false;
    }

    const numericValue = Number(value);

    return Number.isFinite(numericValue) && !Number.isNaN(numericValue) && numericValue >= 0;
  }

  private roundPrice(value: number, decimalPlaces: number): number {
    const multiplier = 10 ** decimalPlaces;

    return Math.round(value * multiplier) / multiplier;
  }


  startEdit(card: MibgasPriceCard): void {
    if (!this.canEdit) {
      return;
    }

    this.editingId = card.price.id;

    this.resetCard(card);

  }

  cancelEdit(card: MibgasPriceCard): void {
    this.resetCard(card);
    this.editingId = null;
  }
}
