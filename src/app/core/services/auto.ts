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
  | 'state'
  | 'registrationName'
  | 'registrationCode'
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
  'registrationCode',
  'movementType',
  'commission',
];

export const AUTO_COLUMNS_BY_PROVIDER: Readonly<
  Record<AutoProvider, readonly AutoItemColumnKey[]>
> = {
  repsol: FULL_ENERGY_COLUMNS,
  'galp-power-gas': FULL_ENERGY_COLUMNS,
  iberdrola: FULL_ENERGY_COLUMNS,
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
    'registrationCode',
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
    'registrationCode',
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
    'registrationCode',
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
    'registrationCode',
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
  totalNegative: number;
  totalNet: number;
  fileKey?: string;
}

export interface AutoItem {
  id?: string;
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
  state?: string;
  registrationName?: string;
  registrationCode?: string;
  movementType: AutoMovementType;
  commission: number;
  calculatedCommission?: number;
  previousSettledAmount?: number;
  teamId?: string;
  settled?: boolean;
  diagnostic?: string;
}

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
  pagination: AutoPreviewPagination;
  items: AutoPreviewItem[];
  diagnostics?: AutoDiagnosticEntry[];
}

export interface AutoPreviewChunk {
  previewId?: string;
  expiresAt?: string;
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
}

export interface CreateAutoRequest extends GenerateAutoRequest {
  previewId: string;
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
  ): Observable<AutoDetail> {
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.min(200, Math.max(1, limit));
    const params = new HttpParams()
      .set('offset', String(safeOffset))
      .set('limit', String(safeLimit));

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
  ): Observable<AutoPreviewChunk> {
    const params = new HttpParams()
      .set('offset', String(offset))
      .set('limit', String(limit));

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

  finalizeAuto(id: string): Observable<Auto> {
    return this.http
      .post<AutoResponse>(
        `${this.apiUrl}/api/autos/${encodeURIComponent(id)}/finalize`,
        {},
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
