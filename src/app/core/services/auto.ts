import {
  HttpClient,
  HttpParams,
  HttpResponse,
} from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  debounceTime,
  finalize,
  map,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';

import { environment } from '../../../environments/environment';
import { Auth } from './auth';
import {
  AutosInvalidationEvent,
  SocketService,
} from './socket';

export type AutoProvider =
  | 'repsol'
  | 'galp-power-gas'
  | 'galp-solar'
  | 'wallbox'
  | 'iberdrola'
  | 'iberdrola-solar'
  | 'yes-energy'
  | 'meo-energias';

export const AUTO_PROVIDER_LABELS: Readonly<Record<AutoProvider, string>> = {
  repsol: 'Repsol',
  'galp-power-gas': 'Galp Power & Gas',
  'galp-solar': 'Galp Solar',
  wallbox: 'Wallbox',
  iberdrola: 'Iberdrola',
  'iberdrola-solar': 'Iberdrola Solar',
  'yes-energy': 'Yes Energy',
  'meo-energias': 'MEO Energias',
};

export const AUTO_PROVIDER_OPTIONS: ReadonlyArray<{
  id: AutoProvider;
  label: string;
}> = [
  { id: 'repsol', label: AUTO_PROVIDER_LABELS.repsol },
  { id: 'galp-power-gas', label: AUTO_PROVIDER_LABELS['galp-power-gas'] },
  { id: 'galp-solar', label: AUTO_PROVIDER_LABELS['galp-solar'] },
  { id: 'wallbox', label: AUTO_PROVIDER_LABELS.wallbox },
  { id: 'iberdrola', label: AUTO_PROVIDER_LABELS.iberdrola },
  { id: 'iberdrola-solar', label: AUTO_PROVIDER_LABELS['iberdrola-solar'] },
  { id: 'yes-energy', label: AUTO_PROVIDER_LABELS['yes-energy'] },
  { id: 'meo-energias', label: AUTO_PROVIDER_LABELS['meo-energias'] },
];

export function getAutoProviderLabel(provider: string): string {
  if (provider === 'galp') {
    return AUTO_PROVIDER_LABELS['galp-power-gas'];
  }

  if (provider in AUTO_PROVIDER_LABELS) {
    return AUTO_PROVIDER_LABELS[provider as AutoProvider];
  }

  return provider;
}

export type AutoType = 'manual' | 'automatic';
export type AutoStatus = 'draft' | 'finalized';
export type AutoMovementType = 'payment' | 'refund' | 'zero';

export type AutoItemSelectionMode = 'include' | 'exclude';

export interface AutoItemSelection {
  mode: AutoItemSelectionMode;
  itemIds: string[];
}

export type AutoItemColumnKey =
  | 'contractId'
  | 'clientName'
  | 'signatureDate'
  | 'cpe'
  | 'cui'
  | 'campaign'
  | 'power'
  | 'nif'
  | 'electronicInvoice'
  | 'directDebit'
  | 'sva'
  | 'PEL'
  | 'PELPlus'
  | 'MGI'
  | 'state'
  | 'registrationName'
  | 'tipoSegmento'
  | 'movementType'
  | 'commission';

const FULL_ENERGY_COLUMNS: readonly AutoItemColumnKey[] = [
  'contractId',
  'clientName',
  'signatureDate',
  'cpe',
  'cui',
  'campaign',
  'power',
  'nif',
  'electronicInvoice',
  'directDebit',
  'sva',
  'state',
  'registrationName',
  'tipoSegmento',
  'movementType',
  'commission',
];

const IBERDROLA_ENERGY_COLUMNS: readonly AutoItemColumnKey[] = [
  'contractId',
  'clientName',
  'signatureDate',
  'cpe',
  'cui',
  'campaign',
  'power',
  'nif',
  'electronicInvoice',
  'directDebit',
  'PEL',
  'PELPlus',
  'MGI',
  'state',
  'registrationName',
  'tipoSegmento',
  'movementType',
  'commission',
];

export const AUTO_COLUMNS_BY_PROVIDER: Readonly<
  Record<AutoProvider, readonly AutoItemColumnKey[]>
> = {
  repsol: FULL_ENERGY_COLUMNS,
  'galp-power-gas': FULL_ENERGY_COLUMNS,
  iberdrola: IBERDROLA_ENERGY_COLUMNS,
  'yes-energy': FULL_ENERGY_COLUMNS,
  'meo-energias': [
    'contractId',
    'clientName',
    'signatureDate',
    'cpe',
    'cui',
    'campaign',
    'power',
    'nif',
    'electronicInvoice',
    'directDebit',
    'state',
    'registrationName',
    'tipoSegmento',
    'movementType',
    'commission',
  ],
  'galp-solar': [
    'contractId',
    'clientName',
    'signatureDate',
    'nif',
    'electronicInvoice',
    'directDebit',
    'state',
    'registrationName',
    'tipoSegmento',
    'movementType',
    'commission',
  ],
  wallbox: [
    'contractId',
    'clientName',
    'signatureDate',
    'campaign',
    'nif',
    'state',
    'registrationName',
    'tipoSegmento',
    'movementType',
    'commission',
  ],
  'iberdrola-solar': [
    'contractId',
    'clientName',
    'signatureDate',
    'campaign',
    'nif',
    'electronicInvoice',
    'directDebit',
    'state',
    'registrationName',
    'tipoSegmento',
    'movementType',
    'commission',
  ],
};

export interface AutoCreatedByUser {
  id?: string;
  name: string;
}

export interface Auto {
  id: string;
  provider: AutoProvider;
  companyId?: string;
  periodStart: string;
  periodEnd: string;
  type: AutoType;
  status: AutoStatus;
  createdBy?: string | AutoCreatedByUser;
  createdByName?: string;
  createdAt: string;
  finalizedAt?: string | null;
  contractsCount: number;
  totalPositive: number;
  totalPaid?: number;
  totalPendingPayment?: number;
  totalNegative: number;
  totalNet: number;
  fileKey?: string;
}

export interface AutoItem {
  id?: string;
  domainId?: string;
  autoId?: string;
  contractId: string;
  clientName?: string;
  signatureDate?: string | null;
  cpe?: string;
  cui?: string;
  campaign?: string;
  power?: string | number;
  nif?: string | number;
  electronicInvoice?: boolean;
  directDebit?: boolean;
  sva?: string | boolean | null;
  PEL?: boolean;
  PELPlus?: boolean;
  MGI?: boolean;
  state?: string;
  registrationName?: string;
  tipoSegmento?: string;
  tipoProduto?: string;
  movementType: AutoMovementType;
  movementDescription?: string;
  calculationStatus?: string;
  refundOutsideChargeback?: boolean;
  commission: number;
  calculatedCommission?: number;
  previousSettledAmount?: number;
  teamId?: string;
  settled?: boolean;
  refundOfAutoItemId?: string | null;
  payableAmount?: number;
  paymentAllowed?: boolean;
  paymentBlocked?: boolean;
  paymentBlockReason?: string | null;
  diagnostic?: string;
}

export interface AutoItemPaymentAttachment {
  /** Nome legado / fallback devolvido por versões anteriores da API. */
  name?: string;
  /** Identificador do ficheiro usado pelo endpoint de download. */
  fileName?: string;
  /** Nome original apresentado ao utilizador. */
  originalName?: string;
  key?: string;
  contentType?: string;
  mimetype?: string;
  size?: number;
}

export interface AutoItemPayment {
  domainId: string;
  autoId: string;
  autoItemId: string;
  contractId: string;
  teamId: string;
  nomeRegistoCE: string;
  nomeCliente: string;
  amount: number;
  paymentMethod: string;
  paymentMethodOther?: string | null;
  attachments: AutoItemPaymentAttachment[];
  createdBy: string;
  paidAt: string;
  walletAppliedAt: string;
  createdAt: string;
  updatedAt: string;
}

export const AUTO_ITEM_PAYMENT_METHODS = [
  'Transferência Bancária',
  'MB Way',
  'Numerário',
  'Outro',
] as const;

export type AutoItemPaymentMethod =
  (typeof AUTO_ITEM_PAYMENT_METHODS)[number];

export type AutoPreviewItem = AutoItem;

export interface AutoDiagnostic {
  code?: string;
  message?: string;
  contractId?: string;
  detail?: string;
}

export type AutoDiagnosticEntry = string | AutoDiagnostic;

export interface AutoPagination {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export type AutoPreviewPagination = AutoPagination;

export interface AutoItemFilterRequest {
  search?: string;
  contractIds?: string[];
  teamIds?: string[];
  teamRegistrationNumbers?: number[];
  campaigns?: string[];
  powers?: string[];
  states?: string[];
  registrationNames?: string[];
  productTypes?: string[];
  tipoSegmentos?: string[];
  movementTypes?: AutoMovementType[];
  calculationStatuses?: string[];
  electronicInvoice?: boolean;
  directDebit?: boolean;
  sva?: boolean;
  PEL?: boolean;
  PELPlus?: boolean;
  MGI?: boolean;
  refundOutsideChargeback?: boolean;
  commissionMin?: number;
  commissionMax?: number;
  calculatedCommissionMin?: number;
  calculatedCommissionMax?: number;
  previousSettledAmountMin?: number;
  previousSettledAmountMax?: number;
  signatureDateFrom?: string;
  signatureDateTo?: string;
  contractUpdatedFrom?: string;
  contractUpdatedTo?: string;
}

export interface AutoPreview {
  previewId: string;
  provider: AutoProvider;
  periodStart: string;
  periodEnd: string;
  expiresAt: string;
  reused: boolean;
  contractsCount: number;
  totalPositive: number;
  totalNegative: number;
  totalNet: number;
  paymentCount: number;
  refundCount: number;
  zeroCount: number;
  warningCount: number;
  generationFilters?: AutoItemFilterRequest;
  pagination: AutoPreviewPagination;
  items: AutoPreviewItem[];
  diagnostics?: AutoDiagnosticEntry[];
}

export interface AutoPreviewChunk {
  previewId?: string;
  expiresAt?: string;
  generationFilters?: AutoItemFilterRequest;
  pagination: AutoPreviewPagination;
  items: AutoPreviewItem[];
  diagnostics?: AutoDiagnosticEntry[];
}

export interface AutoDetail extends Auto {
  items: AutoItem[];
  pagination: AutoPagination;
  diagnostics?: AutoDiagnosticEntry[];
}

export interface GenerateAutoRequest {
  provider: AutoProvider;
  periodStart: string;
  periodEnd: string;
  filters?: AutoItemFilterRequest;
}

export interface CreateAutoRequest {
  provider: AutoProvider;
  periodStart: string;
  periodEnd: string;
  previewId: string;
  selection?: AutoItemSelection;
}

export interface FinalizeAutoRequest {
  selection?: AutoItemSelection;
}

interface AutosListEnvelope {
  autos?: Auto[];
  items?: Auto[];
}

type AutosListResponse = Auto[] | AutosListEnvelope;
type AutoResponse = Auto | { auto: Auto };
type AutoPreviewResponse = AutoPreview | { preview: AutoPreview };
type AutoPreviewChunkResponse =
  | AutoPreviewChunk
  | AutoPreview
  | { preview: AutoPreviewChunk | AutoPreview };
type AutoDetailResponse =
  | AutoDetail
  | {
      auto: Auto;
      items?: AutoItem[];
      pagination?: AutoPagination;
      diagnostics?: AutoDiagnosticEntry[];
    };

type AutoItemPaymentResponse =
  | AutoItemPayment
  | { payment?: AutoItemPayment | null }
  | null;

type AutoItemPaymentsResponse =
  | AutoItemPayment[]
  | { payments?: AutoItemPayment[]; items?: AutoItemPayment[] };

export interface AutosState {
  autos: Auto[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  lastLoadedAt: string | null;
}

const INITIAL_AUTOS_STATE: AutosState = {
  autos: [],
  loading: false,
  loaded: false,
  error: null,
  lastLoadedAt: null,
};

@Injectable({
  providedIn: 'root',
})
export class AutoService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly socketService = inject(SocketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = environment.apiUrl;

  private readonly autosStateSubject =
    new BehaviorSubject<AutosState>(INITIAL_AUTOS_STATE);

  readonly autosState$ = this.autosStateSubject.asObservable();

  private readonly autosInvalidatedSubject =
    new Subject<AutosInvalidationEvent>();

  readonly autosInvalidated$ =
    this.autosInvalidatedSubject.asObservable();

  private autosRequest$: Observable<Auto[]> | null = null;
  private refreshAutosAfterCurrentRequest = false;
  private hasObservedAuthenticatedSocketConnection = false;

  constructor() {
    this.hasObservedAuthenticatedSocketConnection =
      this.socketService.isConnected() && this.auth.isAuthenticated();

    this.observeAuthentication();
    this.observeAutosInvalidation();
    this.observeSocketReconnect();
  }

  getAutos(): Observable<Auto[]> {
    return this.ensureAutosLoaded();
  }

  ensureAutosLoaded(): Observable<Auto[]> {
    const state = this.autosStateSubject.value;

    if (state.loaded) {
      return of(state.autos);
    }

    return this.loadAutos(false);
  }

  refreshAutos(): Observable<Auto[]> {
    if (this.autosRequest$) {
      this.refreshAutosAfterCurrentRequest = true;
      return this.autosRequest$;
    }

    return this.loadAutos(true);
  }

  getAutosSnapshot(): Auto[] {
    return this.autosStateSubject.value.autos;
  }

  isAutosCacheLoaded(): boolean {
    return this.autosStateSubject.value.loaded;
  }

  invalidateAutosCache(event?: AutosInvalidationEvent): void {
    const state = this.autosStateSubject.value;

    this.autosStateSubject.next({
      ...state,
      loaded: false,
      error: null,
    });

    if (this.autosRequest$) {
      this.refreshAutosAfterCurrentRequest = true;
    }

    if (event) {
      this.autosInvalidatedSubject.next(event);
    }
  }

  clearAutosCache(): void {
    this.refreshAutosAfterCurrentRequest = false;
    this.autosStateSubject.next({ ...INITIAL_AUTOS_STATE });
  }

  getAuto(
    id: string,
    offset = 0,
    limit = 50,
    filters?: AutoItemFilterRequest,
  ): Observable<AutoDetail> {
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.min(200, Math.max(1, limit));
    const params = this.buildAutoItemParams(safeOffset, safeLimit, filters);

    return this.http
      .get<AutoDetailResponse>(
        `${this.apiUrl}/api/autos/${encodeURIComponent(id)}`,
        { params },
      )
      .pipe(
        map((response) =>
          this.normalizeAutoDetail(
            response,
            safeOffset,
            safeLimit,
          ),
        ),
      );
  }

  previewAuto(
    payload: GenerateAutoRequest,
    offset = 0,
    limit = 50,
  ): Observable<AutoPreview> {
    const params = new HttpParams()
      .set('offset', String(offset))
      .set('limit', String(limit));

    return this.http
      .post<AutoPreviewResponse>(
        `${this.apiUrl}/api/autos/preview`,
        payload,
        { params },
      )
      .pipe(map((response) => this.normalizePreview(response)));
  }

  getPreviewChunk(
    previewId: string,
    offset: number,
    limit: number,
    filters?: AutoItemFilterRequest,
  ): Observable<AutoPreviewChunk> {
    const params = this.buildAutoItemParams(offset, limit, filters);

    return this.http
      .get<AutoPreviewChunkResponse>(
        `${this.apiUrl}/api/autos/preview/${encodeURIComponent(previewId)}`,
        { params },
      )
      .pipe(map((response) => this.normalizePreviewChunk(response)));
  }

  createAuto(payload: CreateAutoRequest): Observable<Auto> {
    return this.http
      .post<AutoResponse>(
        `${this.apiUrl}/api/autos`,
        payload,
      )
      .pipe(
        map((response) => this.normalizeAuto(response)),
        tap((auto) => this.upsertAutoInCache(auto)),
      );
  }

  finalizeAuto(
    id: string,
    payload: FinalizeAutoRequest = {},
  ): Observable<Auto> {
    return this.http
      .post<AutoResponse>(
        `${this.apiUrl}/api/autos/${encodeURIComponent(id)}/finalize`,
        payload,
      )
      .pipe(
        map((response) => this.normalizeAuto(response)),
        tap((auto) => this.upsertAutoInCache(auto)),
      );
  }

  deleteAuto(id: string): Observable<void> {
    return this.http
      .delete<void>(
        `${this.apiUrl}/api/autos/${encodeURIComponent(id)}`,
      )
      .pipe(tap(() => this.removeAutoFromCache(id)));
  }

  exportAuto(id: string): Observable<HttpResponse<Blob>> {
    return this.http.get(
      `${this.apiUrl}/api/autos/${encodeURIComponent(id)}/export`,
      {
        observe: 'response',
        responseType: 'blob',
      },
    );
  }

  getAutoPayments(autoId: string): Observable<AutoItemPayment[]> {
    return this.http
      .get<AutoItemPaymentsResponse>(
        `${this.apiUrl}/api/autos/${encodeURIComponent(autoId)}/payments`,
      )
      .pipe(map((response) => this.normalizeAutoItemPayments(response)));
  }

  getAutoItemPayment(autoItemId: string): Observable<AutoItemPayment | null> {
    return this.http
      .get<AutoItemPaymentResponse>(
        `${this.apiUrl}/api/autos/items/${encodeURIComponent(autoItemId)}/payment`,
      )
      .pipe(map((response) => this.normalizeAutoItemPaymentResponse(response)));
  }

  createAutoItemPayment(
    autoItemId: string,
    paymentMethod: AutoItemPaymentMethod,
    files: readonly File[] = [],
    paymentMethodOther?: string,
  ): Observable<AutoItemPayment> {
    const formData = new FormData();
    formData.append('paymentMethod', paymentMethod);

    if (paymentMethod === 'Outro') {
      const normalizedOther = paymentMethodOther?.trim();
      if (normalizedOther) {
        formData.append('paymentMethodOther', normalizedOther);
      }
    }

    for (const file of files) {
      formData.append('files', file, file.name);
    }

    return this.http
      .post<AutoItemPaymentResponse>(
        `${this.apiUrl}/api/autos/items/${encodeURIComponent(autoItemId)}/payment`,
        formData,
      )
      .pipe(
        map((response) => {
          const payment = this.normalizeAutoItemPaymentResponse(response);
          if (!payment) {
            throw new Error('A API não devolveu o pagamento criado.');
          }
          return payment;
        }),
      );
  }

  downloadAutoItemPaymentAttachment(
    autoItemId: string,
    fileName: string,
  ): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/api/autos/items/${encodeURIComponent(autoItemId)}/payment/attachments/${encodeURIComponent(fileName)}/download`,
      { responseType: 'blob' },
    );
  }

  private loadAutos(forceRefresh: boolean): Observable<Auto[]> {
    const state = this.autosStateSubject.value;

    if (!forceRefresh && state.loaded) {
      return of(state.autos);
    }

    if (this.autosRequest$) {
      return this.autosRequest$;
    }

    this.autosStateSubject.next({
      ...state,
      loading: true,
      error: null,
    });

    const request$ = this.http
      .get<AutosListResponse>(`${this.apiUrl}/api/autos`)
      .pipe(
        map((response) => this.normalizeAutosList(response)),
        tap((autos) => {
          this.autosStateSubject.next({
            autos: this.sortAutos(autos),
            loading: true,
            loaded: true,
            error: null,
            lastLoadedAt: new Date().toISOString(),
          });
        }),
        catchError((error) => {
          const currentState = this.autosStateSubject.value;

          this.autosStateSubject.next({
            ...currentState,
            loading: true,
            error: this.getLoadErrorMessage(error),
          });

          return throwError(() => error);
        }),
        finalize(() => {
          this.autosRequest$ = null;

          const currentState = this.autosStateSubject.value;
          this.autosStateSubject.next({
            ...currentState,
            loading: false,
          });

          if (
            this.refreshAutosAfterCurrentRequest &&
            this.auth.isAuthenticated()
          ) {
            this.refreshAutosAfterCurrentRequest = false;

            queueMicrotask(() => {
              this.refreshAutos().subscribe({
                error: () => undefined,
              });
            });
          }
        }),
        shareReplay({
          bufferSize: 1,
          refCount: false,
        }),
      );

    this.autosRequest$ = request$;
    return request$;
  }

  private observeAuthentication(): void {
    this.auth.authenticationState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state === 'authenticated') {
          this.hasObservedAuthenticatedSocketConnection =
            this.socketService.isConnected();
          return;
        }

        if (state === 'unauthenticated') {
          this.hasObservedAuthenticatedSocketConnection = false;
          this.clearAutosCache();
        }
      });
  }

  private observeAutosInvalidation(): void {
    this.socketService
      .listenAutosInvalidated()
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        if (!this.auth.isAuthenticated()) {
          return;
        }

        this.invalidateAutosCache(event);
      });
  }

  private observeSocketReconnect(): void {
    this.socketService
      .listenConnected()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.auth.isAuthenticated()) {
          return;
        }

        if (!this.hasObservedAuthenticatedSocketConnection) {
          this.hasObservedAuthenticatedSocketConnection = true;
          return;
        }

        this.invalidateAutosCache({
          reason: 'socket:reconnected',
          timestamp: new Date().toISOString(),
        });
      });
  }

  private upsertAutoInCache(auto: Auto): void {
    const state = this.autosStateSubject.value;

    if (!state.loaded) {
      return;
    }

    const existingIndex = state.autos.findIndex(
      (cachedAuto) => cachedAuto.id === auto.id,
    );

    const autos = [...state.autos];

    if (existingIndex >= 0) {
      autos[existingIndex] = {
        ...autos[existingIndex],
        ...auto,
      };
    } else {
      autos.unshift(auto);
    }

    this.autosStateSubject.next({
      ...state,
      autos: this.sortAutos(autos),
    });
  }

  private removeAutoFromCache(id: string): void {
    const state = this.autosStateSubject.value;

    if (!state.loaded) {
      return;
    }

    this.autosStateSubject.next({
      ...state,
      autos: state.autos.filter((auto) => auto.id !== id),
    });
  }

  private normalizeAutosList(response: AutosListResponse): Auto[] {
    if (Array.isArray(response)) {
      return response.map((auto) => this.normalizeLegacyProvider(auto));
    }

    return (response.autos ?? response.items ?? []).map((auto) =>
      this.normalizeLegacyProvider(auto),
    );
  }

  private normalizeAuto(response: AutoResponse): Auto {
    const auto = 'auto' in response ? response.auto : response;
    return this.normalizeLegacyProvider(auto);
  }

  private buildAutoItemParams(
    offset: number,
    limit: number,
    filters?: AutoItemFilterRequest,
  ): HttpParams {
    let params = new HttpParams()
      .set('offset', String(Math.max(0, offset)))
      .set('limit', String(Math.min(200, Math.max(1, limit))));

    if (!filters) {
      return params;
    }

    const appendArray = (key: string, values?: readonly (string | number)[]) => {
      for (const value of values ?? []) {
        const normalized = String(value).trim();
        if (normalized) {
          params = params.append(key, normalized);
        }
      }
    };

    const appendScalar = (key: string, value: unknown) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params = params.set(key, String(value));
    };

    appendScalar('search', filters.search);
    appendArray('contractIds', filters.contractIds);
    appendArray('teamIds', filters.teamIds);
    appendArray('teamRegistrationNumbers', filters.teamRegistrationNumbers);
    appendArray('campaigns', filters.campaigns);
    appendArray('powers', filters.powers);
    appendArray('states', filters.states);
    appendArray('registrationNames', filters.registrationNames);
    appendArray('productTypes', filters.productTypes);
    appendArray('tipoSegmentos', filters.tipoSegmentos);
    appendArray('movementTypes', filters.movementTypes);
    appendArray('calculationStatuses', filters.calculationStatuses);

    appendScalar('electronicInvoice', filters.electronicInvoice);
    appendScalar('directDebit', filters.directDebit);
    appendScalar('sva', filters.sva);
    appendScalar('PEL', filters.PEL);
    appendScalar('PELPlus', filters.PELPlus);
    appendScalar('MGI', filters.MGI);
    appendScalar('refundOutsideChargeback', filters.refundOutsideChargeback);

    appendScalar('commissionMin', filters.commissionMin);
    appendScalar('commissionMax', filters.commissionMax);
    appendScalar('calculatedCommissionMin', filters.calculatedCommissionMin);
    appendScalar('calculatedCommissionMax', filters.calculatedCommissionMax);
    appendScalar('previousSettledAmountMin', filters.previousSettledAmountMin);
    appendScalar('previousSettledAmountMax', filters.previousSettledAmountMax);
    appendScalar('signatureDateFrom', filters.signatureDateFrom);
    appendScalar('signatureDateTo', filters.signatureDateTo);
    appendScalar('contractUpdatedFrom', filters.contractUpdatedFrom);
    appendScalar('contractUpdatedTo', filters.contractUpdatedTo);

    return params;
  }

  private normalizePreview(response: AutoPreviewResponse): AutoPreview {
    const preview = 'preview' in response ? response.preview : response;

    return {
      ...preview,
      provider: this.normalizeProviderValue(preview.provider),
      items: preview.items ?? [],
      pagination: this.normalizePagination(
        preview.pagination,
        preview.items?.length ?? 0,
      ),
    };
  }

  private normalizePreviewChunk(
    response: AutoPreviewChunkResponse,
  ): AutoPreviewChunk {
    const chunk = 'preview' in response ? response.preview : response;

    return {
      previewId: chunk.previewId,
      expiresAt: chunk.expiresAt,
      items: chunk.items ?? [],
      pagination: this.normalizePagination(
        chunk.pagination,
        chunk.items?.length ?? 0,
      ),
      diagnostics: chunk.diagnostics,
    };
  }

  private normalizeAutoItemPaymentResponse(
    response: AutoItemPaymentResponse,
  ): AutoItemPayment | null {
    if (!response) {
      return null;
    }

    const payment = Object.prototype.hasOwnProperty.call(response, 'payment')
      ? (response as { payment?: AutoItemPayment | null }).payment
      : (response as AutoItemPayment);

    if (!payment) {
      return null;
    }

    return {
      ...payment,
      attachments: (payment.attachments ?? []).map((attachment) =>
        this.normalizeAutoItemPaymentAttachment(attachment),
      ),
    };
  }

  private normalizeAutoItemPayments(
    response: AutoItemPaymentsResponse,
  ): AutoItemPayment[] {
    const payments = Array.isArray(response)
      ? response
      : response.payments ?? response.items ?? [];

    return payments.map((payment) => ({
      ...payment,
      attachments: (payment.attachments ?? []).map((attachment) =>
        this.normalizeAutoItemPaymentAttachment(attachment),
      ),
    }));
  }

  private normalizeAutoItemPaymentAttachment(
    attachment: AutoItemPaymentAttachment,
  ): AutoItemPaymentAttachment {
    const originalName = String(
      attachment.originalName ?? attachment.name ?? attachment.fileName ?? '',
    ).trim();
    const fileName = String(
      attachment.fileName ?? attachment.name ?? attachment.originalName ?? '',
    ).trim();
    const mimetype = attachment.mimetype ?? attachment.contentType;

    return {
      ...attachment,
      name: originalName || fileName,
      originalName: originalName || fileName,
      fileName: fileName || originalName,
      mimetype,
      contentType: attachment.contentType ?? mimetype,
    };
  }

  private normalizeAutoDetail(
    response: AutoDetailResponse,
    requestedOffset: number,
    requestedLimit: number,
  ): AutoDetail {
    if ('auto' in response) {
      const auto = this.normalizeLegacyProvider(response.auto);
      const items = response.items ?? [];

      return {
        ...auto,
        items,
        pagination: this.normalizePagination(
          response.pagination,
          items.length,
          auto.contractsCount,
          requestedOffset,
          requestedLimit,
        ),
        diagnostics: response.diagnostics,
      };
    }

    const auto = this.normalizeLegacyProvider(response);
    const items = response.items ?? [];

    return {
      ...auto,
      items,
      pagination: this.normalizePagination(
        response.pagination,
        items.length,
        auto.contractsCount,
        requestedOffset,
        requestedLimit,
      ),
    };
  }

  private normalizeLegacyProvider<T extends Auto>(auto: T): T {
    if ((auto.provider as string) !== 'galp') {
      return auto;
    }

    return {
      ...auto,
      provider: 'galp-power-gas',
    };
  }

  private normalizeProviderValue(provider: AutoProvider | string): AutoProvider {
    if (provider === 'galp') {
      return 'galp-power-gas';
    }

    return provider as AutoProvider;
  }

  private normalizePagination(
    pagination: AutoPagination | undefined,
    itemsLength: number,
    fallbackTotal = itemsLength,
    fallbackOffset = 0,
    fallbackLimit = itemsLength,
  ): AutoPagination {
    if (pagination) {
      return pagination;
    }

    const safeTotal = Math.max(fallbackTotal, itemsLength);
    const safeLimit = Math.max(fallbackLimit, itemsLength);

    return {
      offset: fallbackOffset,
      limit: safeLimit,
      total: safeTotal,
      hasMore: fallbackOffset + itemsLength < safeTotal,
    };
  }

  private sortAutos(autos: Auto[]): Auto[] {
    return [...autos].sort((left, right) => {
      const rightTime = new Date(right.createdAt).getTime();
      const leftTime = new Date(left.createdAt).getTime();

      if (Number.isNaN(rightTime) || Number.isNaN(leftTime)) {
        return 0;
      }

      return rightTime - leftTime;
    });
  }

  private getLoadErrorMessage(error: unknown): string {
    if (this.isHttpStatus(error, 403)) {
      return 'Não tem permissão para aceder aos Autos.';
    }

    return 'Não foi possível carregar os Autos.';
  }

  private isHttpStatus(error: unknown, status: number): boolean {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status?: unknown }).status === status,
    );
  }
}
