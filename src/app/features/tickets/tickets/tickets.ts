import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { filter, finalize, take } from 'rxjs';

import { AuthUser } from '../../../core/models/auth-user';
import { getContractCompanyName } from '../../../core/config/contract-detail-route';
import { Auth } from '../../../core/services/auth';
import {
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
  TICKET_TYPE_OPTIONS,
  TicketEstado,
  TicketListItem,
  TicketPrioridade,
  TicketService,
  TicketTipo,
} from '../../../core/services/ticket';

interface TicketCompanyGroup {
  companyId: string;
  companyName: string;
  tickets: TicketListItem[];
}

type TicketScheduleFilter = '' | 'scheduled' | 'unscheduled';

interface TicketFilters {
  search: string;
  companyId: string;
  tipo: TicketTipo | '';
  estado: TicketEstado | '';
  prioridade: TicketPrioridade | '';
  userId: string;
  schedule: TicketScheduleFilter;
}

interface TicketResponsibleOption {
  id: string;
  name: string;
}

interface TicketCompanyOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-tickets',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './tickets.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './tickets.scss',
})
export class Tickets implements OnInit {
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ticketService = inject(TicketService);

  tickets: TicketListItem[] = [];
  filteredTickets: TicketListItem[] = [];
  ticketGroups: TicketCompanyGroup[] = [];

  readonly typeOptions = TICKET_TYPE_OPTIONS;
  readonly statusOptions = TICKET_STATUS_OPTIONS;
  readonly priorityOptions = TICKET_PRIORITY_OPTIONS;

  companyOptions: TicketCompanyOption[] = [];
  responsibleOptions: TicketResponsibleOption[] = [];

  filters: TicketFilters = this.createEmptyFilters();

  isLoading = false;
  errorMessage = '';
  showFilters = false;

  ngOnInit(): void {
    this.auth.currentUser$
      .pipe(
        filter((user): user is AuthUser => Boolean(user?.id)),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((user) => this.loadTickets(user.id));
  }

  retry(): void {
    const currentUser = this.auth.getCurrentUser();

    if (!currentUser?.id) {
      this.errorMessage = 'Não foi possível identificar o utilizador autenticado.';
      return;
    }

    this.loadTickets(currentUser.id);
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  applyFilters(): void {
    const search = this.normalizeText(this.filters.search);

    this.filteredTickets = this.tickets.filter((ticket) => {
      const matchesSearch =
        !search ||
        [
          ticket.id,
          ticket.contractId,
          ticket.tipo,
          ticket.estado,
          ticket.prioridade,
          ticket.userName,
          ticket.descricao,
        ].some((value) => this.normalizeText(value).includes(search));

      const matchesCompany =
        !this.filters.companyId || ticket.companyId === this.filters.companyId;

      const matchesType =
        !this.filters.tipo || ticket.tipo === this.filters.tipo;

      const matchesStatus =
        !this.filters.estado || ticket.estado === this.filters.estado;

      const matchesPriority =
        !this.filters.prioridade ||
        ticket.prioridade === this.filters.prioridade;

      const matchesResponsible =
        !this.filters.userId || ticket.userId === this.filters.userId;

      const matchesSchedule =
        !this.filters.schedule ||
        (this.filters.schedule === 'scheduled' && Boolean(ticket.agendamento)) ||
        (this.filters.schedule === 'unscheduled' && !ticket.agendamento);

      return (
        matchesSearch &&
        matchesCompany &&
        matchesType &&
        matchesStatus &&
        matchesPriority &&
        matchesResponsible &&
        matchesSchedule
      );
    });

    this.ticketGroups = this.groupTicketsByCompany(this.filteredTickets);
  }

  clearFilters(): void {
    this.filters = this.createEmptyFilters();
    this.applyFilters();
    this.showFilters = false;
  }

  hasActiveFilters(): boolean {
    return Boolean(
      this.filters.search ||
        this.filters.companyId ||
        this.filters.tipo ||
        this.filters.estado ||
        this.filters.prioridade ||
        this.filters.userId ||
        this.filters.schedule,
    );
  }

  get activeFiltersCount(): number {
    return [
      this.filters.search,
      this.filters.companyId,
      this.filters.tipo,
      this.filters.estado,
      this.filters.prioridade,
      this.filters.userId,
      this.filters.schedule,
    ].filter(Boolean).length;
  }

  getStatusClass(estado: TicketEstado): string {
    switch (estado) {
      case 'Novo':
        return 'status-new';
      case 'Em Tratamento':
        return 'status-progress';
      case 'Concluído':
        return 'status-done';
      default:
        return 'status-new';
    }
  }

  getPriorityClass(prioridade: TicketPrioridade): string {
    switch (prioridade) {
      case 'Baixo':
        return 'priority-low';
      case 'Normal':
        return 'priority-normal';
      case 'Alto':
        return 'priority-high';
      case 'Urgente':
        return 'priority-urgent';
      default:
        return 'priority-normal';
    }
  }

  getUserName(ticket: TicketListItem): string {
    return ticket.userName?.trim() || 'Utilizador desconhecido';
  }

  private loadTickets(userId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.ticketService
      .getTicketsByFollower(userId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (tickets) => {
          this.tickets = this.sortTickets(tickets);
          this.buildFilterOptions();
          this.applyFilters();
        },
        error: (error: unknown) => {
          this.tickets = [];
          this.filteredTickets = [];
          this.ticketGroups = [];
          this.companyOptions = [];
          this.responsibleOptions = [];
          this.errorMessage = this.getErrorMessage(error);
        },
      });
  }

  private buildFilterOptions(): void {
    const companies = new Map<string, string>();
    const responsibles = new Map<string, string>();

    this.tickets.forEach((ticket) => {
      if (ticket.companyId) {
        companies.set(
          ticket.companyId,
          getContractCompanyName(ticket.companyId),
        );
      }

      if (ticket.userId) {
        responsibles.set(
          ticket.userId,
          ticket.userName?.trim() || ticket.userId,
        );
      }
    });

    this.companyOptions = Array.from(companies.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }),
      );

    this.responsibleOptions = Array.from(responsibles.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }),
      );
  }

  private sortTickets(tickets: TicketListItem[]): TicketListItem[] {
    return [...tickets].sort((a, b) => {
      const aDate = Date.parse(a.updatedAt || a.createdAt || '');
      const bDate = Date.parse(b.updatedAt || b.createdAt || '');

      const normalizedA = Number.isNaN(aDate) ? 0 : aDate;
      const normalizedB = Number.isNaN(bDate) ? 0 : bDate;

      return normalizedB - normalizedA;
    });
  }

  private groupTicketsByCompany(
    tickets: TicketListItem[],
  ): TicketCompanyGroup[] {
    const groups = new Map<string, TicketListItem[]>();

    tickets.forEach((ticket) => {
      const companyId = ticket.companyId || '__unknown__';
      const current = groups.get(companyId) ?? [];
      current.push(ticket);
      groups.set(companyId, current);
    });

    return Array.from(groups.entries())
      .map(([companyId, groupedTickets]) => ({
        companyId,
        companyName:
          companyId === '__unknown__'
            ? 'Comercializadora desconhecida'
            : getContractCompanyName(companyId),
        tickets: groupedTickets,
      }))
      .sort((a, b) =>
        a.companyName.localeCompare(b.companyName, 'pt', {
          sensitivity: 'base',
        }),
      );
  }

  private createEmptyFilters(): TicketFilters {
    return {
      search: '',
      companyId: '',
      tipo: '',
      estado: '',
      prioridade: '',
      userId: '',
      schedule: '',
    };
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage =
        typeof error.error?.message === 'string'
          ? error.error.message
          : typeof error.error?.error === 'string'
            ? error.error.error
            : '';

      if (apiMessage) {
        return apiMessage;
      }

      if (error.status === 403) {
        return 'Não tem permissão para consultar estes Tickets.';
      }

      if (error.status === 404) {
        return 'Não foram encontrados Tickets para este utilizador.';
      }
    }

    return 'Não foi possível carregar os Tickets. Tente novamente.';
  }
}
