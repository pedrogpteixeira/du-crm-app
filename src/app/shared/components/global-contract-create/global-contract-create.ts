import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthUser } from '../../../core/models/auth-user';
import { canAccessPortulogosB2B } from '../../../core/config/portulogos-b2b-access';
import { Auth } from '../../../core/services/auth';

type ContractCreateGroup = 'B2C' | 'B2B';

interface ContractCreateOption {
  name: string;
  route: string;
  group: ContractCreateGroup;
  icon: string;
  roles?: string[];
  requiresB2BAccess?: boolean;
}

const CONTRACT_CREATE_OPTIONS: readonly ContractCreateOption[] = [
  {
    name: 'Portulogos',
    route: '/home/contracts/portulogos/create',
    group: 'B2C',
    icon: 'description',
    roles: ['Super Admin', 'DU', 'Portulogos'],
  },
  {
    name: 'Repsol',
    route: '/home/contracts/repsol/create',
    group: 'B2C',
    icon: 'description',
    roles: ['Super Admin', 'DU', 'Repsol'],
  },
  {
    name: 'Galp Power & Gás',
    route: '/home/contracts/galp-power-gas/create',
    group: 'B2C',
    icon: 'description',
    roles: ['Super Admin', 'DU', 'Galp'],
  },
  {
    name: 'Galp Solar',
    route: '/home/contracts/galp-solar/create',
    group: 'B2C',
    icon: 'solar_power',
    roles: ['Super Admin', 'DU', 'Galp'],
  },
  {
    name: 'Wallbox',
    route: '/home/contracts/wallbox/create',
    group: 'B2C',
    icon: 'ev_station',
    roles: ['Super Admin', 'DU', 'Galp'],
  },
  {
    name: 'Yes Energy',
    route: '/home/contracts/yes-energy/create',
    group: 'B2C',
    icon: 'description',
    roles: ['Super Admin', 'DU', 'Yes Energy'],
  },
  {
    name: 'Iberdrola',
    route: '/home/contracts/iberdrola/create',
    group: 'B2C',
    icon: 'description',
    roles: ['Super Admin', 'DU', 'Iberdrola'],
  },
  {
    name: 'Iberdrola Solar',
    route: '/home/contracts/iberdrola-solar/create',
    group: 'B2C',
    icon: 'solar_power',
    roles: ['Super Admin', 'DU', 'Iberdrola'],
  },
  {
    name: 'Vodafone',
    route: '/home/contracts/vodafone/create',
    group: 'B2C',
    icon: 'description',
    roles: ['Super Admin', 'DU', 'Vodafone'],
  },
  {
    name: 'MEO Energias',
    route: '/home/contracts/meo-energias/create',
    group: 'B2C',
    icon: 'description',
    roles: ['Super Admin', 'DU', 'Meo Energia'],
  },
  {
    name: 'Portulogos B2B',
    route: '/home/contracts/portulogos-b2b/create',
    group: 'B2B',
    icon: 'business_center',
    requiresB2BAccess: true,
  },
  {
    name: 'Ezu B2B',
    route: '/home/contracts/ezu-b2b/create',
    group: 'B2B',
    icon: 'business_center',
    requiresB2BAccess: true,
  },
  {
    name: 'Nossa Energia B2B',
    route: '/home/contracts/nossa-energia-b2b/create',
    group: 'B2B',
    icon: 'business_center',
    requiresB2BAccess: true,
  },
  {
    name: 'Audax B2B',
    route: '/home/contracts/audax-b2b/create',
    group: 'B2B',
    icon: 'business_center',
    requiresB2BAccess: true,
  },
  {
    name: 'Plenitude B2B',
    route: '/home/contracts/plenitude-b2b/create',
    group: 'B2B',
    icon: 'business_center',
    requiresB2BAccess: true,
  },
  {
    name: 'Endesa B2B',
    route: '/home/contracts/endesa-b2b/create',
    group: 'B2B',
    icon: 'business_center',
    requiresB2BAccess: true,
  },
];

@Component({
  selector: 'app-global-contract-create',
  imports: [CommonModule, FormsModule],
  templateUrl: './global-contract-create.html',
  styleUrl: './global-contract-create.scss',
})
export class GlobalContractCreate {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  user: AuthUser | null = this.auth.getCurrentUser();

  isOpen = false;
  searchTerm = '';

  constructor() {
    this.auth.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.user = user;

        if (!this.availableOptions.length) {
          this.close();
        }
      });
  }

  get availableOptions(): ContractCreateOption[] {
    return CONTRACT_CREATE_OPTIONS.filter((option) => this.canAccessOption(option));
  }

  get filteredB2COptions(): ContractCreateOption[] {
    return this.filterOptions('B2C');
  }

  get filteredB2BOptions(): ContractCreateOption[] {
    return this.filterOptions('B2B');
  }

  get hasFilteredOptions(): boolean {
    return this.filteredB2COptions.length > 0 || this.filteredB2BOptions.length > 0;
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();

    if (this.isOpen) {
      this.close();
      return;
    }

    this.isOpen = true;
    this.searchTerm = '';
  }

  close(): void {
    this.isOpen = false;
    this.searchTerm = '';
  }

  createContract(option: ContractCreateOption): void {
    this.close();
    void this.router.navigateByUrl(option.route);
  }

  trackByRoute(_index: number, option: ContractCreateOption): string {
    return option.route;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  private filterOptions(group: ContractCreateGroup): ContractCreateOption[] {
    const normalizedSearch = this.normalizeText(this.searchTerm);

    return this.availableOptions.filter((option) => {
      if (option.group !== group) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return this.normalizeText(option.name).includes(normalizedSearch);
    });
  }

  private canAccessOption(option: ContractCreateOption): boolean {
    if (option.requiresB2BAccess) {
      return canAccessPortulogosB2B(this.user);
    }

    return this.canAccessRoles(...(option.roles ?? []));
  }

  private canAccessRoles(...allowedRoles: string[]): boolean {
    const role = this.user?.role?.trim() ?? '';

    if (!role) {
      return false;
    }

    const normalizedRole = role.toLowerCase();

    return allowedRoles.some((allowedRole) =>
      normalizedRole.includes(allowedRole.toLowerCase()),
    );
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
