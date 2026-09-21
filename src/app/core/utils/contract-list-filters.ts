import { ContractApiFilters } from './contract-kanban';

export type ContractBooleanFilter = '' | 'true' | 'false';
export type ContractFilterInputType =
  'text' | 'search' | 'number' | 'date' | 'select' | 'boolean' | 'status';

export interface ContractFilterOption {
  value: string;
  label: string;
}

export interface ContractFilterFieldDefinition {
  key: string;
  label: string;
  apiKey?: string;
  type?: ContractFilterInputType;
  group?: string;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'search';
  options?: readonly ContractFilterOption[];
}

export interface BaseContractFilters {
  contractId: string;
  companyId: string;
  clientId: string;
  client: string;
  nif: string;
  phone: string;
  email: string;
  segment: string;
  product: string;
  status: string[];
  userId: string;
  registrationName: string;
  registrationCode: string;
  quality: string;
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
}

export interface EnergyContractFilters extends BaseContractFilters {
  contracting: string;
  lightContracting: string;
  gasContracting: string;
  scheduledFrom: string;
  scheduledTo: string;
  signatureFrom: string;
  signatureTo: string;
  contractDateFrom: string;
  contractDateTo: string;
  registrationDateFrom: string;
  registrationDateTo: string;
  cpeActivationFrom: string;
  cpeActivationTo: string;
  cpeDeactivationFrom: string;
  cpeDeactivationTo: string;
  cuiActivationFrom: string;
  cuiActivationTo: string;
  cuiDeactivationFrom: string;
  cuiDeactivationTo: string;
  citizenCard: string;
  cae: string;
  crc: string;
  electronicInvoice: ContractBooleanFilter;
  directDebit: ContractBooleanFilter;
  sva: ContractBooleanFilter;
  socialTariff: ContractBooleanFilter;
  iban: string;
  campaign: string;
  previousProvider: string;
  cpe: string;
  cui: string;
  powerMin: string;
  powerMax: string;
  gasLevel: string;
  cycle: string;
  voltage: string;
}

export interface SolarContractFilters extends BaseContractFilters {
  contracting: string;
  scheduledFrom: string;
  scheduledTo: string;
  signatureFrom: string;
  signatureTo: string;
  contractDateFrom: string;
  contractDateTo: string;
  registrationDateFrom: string;
  registrationDateTo: string;
  expectedInstallationFrom: string;
  expectedInstallationTo: string;
  installationFrom: string;
  installationTo: string;
  activationFrom: string;
  activationTo: string;
  deactivationFrom: string;
  deactivationTo: string;
  leadNumber: string;
  offer: string;
  cae: string;
  crc: string;
  electronicInvoice: ContractBooleanFilter;
  directDebit: ContractBooleanFilter;
  nib: string;
  panelType: string;
  microinverter: ContractBooleanFilter;
  batteries: ContractBooleanFilter;
  panelCountMin: string;
  panelCountMax: string;
  paymentMethod: string;
  campaign: string;
}

export interface WallboxContractFilters extends BaseContractFilters {
  scheduledFrom: string;
  scheduledTo: string;
  signatureFrom: string;
  signatureTo: string;
  contractDateFrom: string;
  contractDateTo: string;
  registrationDateFrom: string;
  registrationDateTo: string;
  installationFrom: string;
  installationTo: string;
  activationFrom: string;
  activationTo: string;
  deactivationFrom: string;
  deactivationTo: string;
  leadNumber: string;
  offer: string;
  campaign: string;
  voltage: string;
  installationType: string;
  paymentMethod: string;
  travel: ContractBooleanFilter;
  powerBalancing: ContractBooleanFilter;
}

export interface ContractFilterUserOption {
  id: string;
  name: string;
}

export interface BaseContractFilterOptions {
  segments: string[];
  products: string[];
  users: ContractFilterUserOption[];
}

export interface BaseFilterableContract {
  id: string;
  nomeClienteEmpresa?: string | null;
  nif?: string | number | null;
  tipoSegmento?: string | null;
  tipoProduto?: string | null;
  estado?: string | null;
  nomeRegistoCE?: string | null;
  user?: {
    id: string;
    name?: string | null;
  } | null;
}

export function createBaseContractFilters(): BaseContractFilters {
  return {
    contractId: '',
    companyId: '',
    clientId: '',
    client: '',
    nif: '',
    phone: '',
    email: '',
    segment: '',
    product: '',
    status: [],
    userId: '',
    registrationName: '',
    registrationCode: '',
    quality: '',
    createdFrom: '',
    createdTo: '',
    updatedFrom: '',
    updatedTo: '',
  };
}

export function createEnergyContractFilters(): EnergyContractFilters {
  return {
    ...createBaseContractFilters(),
    contracting: '',
    lightContracting: '',
    gasContracting: '',
    scheduledFrom: '',
    scheduledTo: '',
    signatureFrom: '',
    signatureTo: '',
    contractDateFrom: '',
    contractDateTo: '',
    registrationDateFrom: '',
    registrationDateTo: '',
    cpeActivationFrom: '',
    cpeActivationTo: '',
    cpeDeactivationFrom: '',
    cpeDeactivationTo: '',
    cuiActivationFrom: '',
    cuiActivationTo: '',
    cuiDeactivationFrom: '',
    cuiDeactivationTo: '',
    citizenCard: '',
    cae: '',
    crc: '',
    electronicInvoice: '',
    directDebit: '',
    sva: '',
    socialTariff: '',
    iban: '',
    campaign: '',
    previousProvider: '',
    cpe: '',
    cui: '',
    powerMin: '',
    powerMax: '',
    gasLevel: '',
    cycle: '',
    voltage: '',
  };
}

export function createSolarContractFilters(): SolarContractFilters {
  return {
    ...createBaseContractFilters(),
    contracting: '',
    scheduledFrom: '',
    scheduledTo: '',
    signatureFrom: '',
    signatureTo: '',
    contractDateFrom: '',
    contractDateTo: '',
    registrationDateFrom: '',
    registrationDateTo: '',
    expectedInstallationFrom: '',
    expectedInstallationTo: '',
    installationFrom: '',
    installationTo: '',
    activationFrom: '',
    activationTo: '',
    deactivationFrom: '',
    deactivationTo: '',
    leadNumber: '',
    offer: '',
    cae: '',
    crc: '',
    electronicInvoice: '',
    directDebit: '',
    nib: '',
    panelType: '',
    microinverter: '',
    batteries: '',
    panelCountMin: '',
    panelCountMax: '',
    paymentMethod: '',
    campaign: '',
  };
}

export function createWallboxContractFilters(): WallboxContractFilters {
  return {
    ...createBaseContractFilters(),
    scheduledFrom: '',
    scheduledTo: '',
    signatureFrom: '',
    signatureTo: '',
    contractDateFrom: '',
    contractDateTo: '',
    registrationDateFrom: '',
    registrationDateTo: '',
    installationFrom: '',
    installationTo: '',
    activationFrom: '',
    activationTo: '',
    deactivationFrom: '',
    deactivationTo: '',
    leadNumber: '',
    offer: '',
    campaign: '',
    voltage: '',
    installationType: '',
    paymentMethod: '',
    travel: '',
    powerBalancing: '',
  };
}

export function cloneContractFilters<T>(filters: T): T {
  return {
    ...(filters as Record<string, unknown>),
    status: Array.isArray((filters as { status?: unknown }).status)
      ? [...((filters as { status: string[] }).status ?? [])]
      : [],
  } as T;
}

export function contractFiltersEqual(first: object, second: object): boolean {
  const normalize = (filters: object) => {
    const source = filters as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const value = source[key];
        result[key] = Array.isArray(value) ? [...value].sort() : value;
        return result;
      }, {});
  };

  return JSON.stringify(normalize(first)) === JSON.stringify(normalize(second));
}

export function buildContractApiFiltersFromDefinitions(
  filters: object,
  definitions: readonly ContractFilterFieldDefinition[],
): ContractApiFilters {
  const values = filters as Record<string, unknown>;
  const apiFilters: ContractApiFilters = {};

  definitions.forEach((definition) => {
    if (!definition.apiKey || definition.type === 'status') {
      return;
    }

    const value = values[definition.key];

    if (value === undefined || value === null || value === '') {
      return;
    }

    if (Array.isArray(value) && !value.length) {
      return;
    }

    if (definition.type === 'number' && typeof value === 'string') {
      const numeric = Number(value.replace(',', '.'));
      if (Number.isFinite(numeric)) {
        apiFilters[definition.apiKey] = numeric;
        return;
      }
    }

    apiFilters[definition.apiKey] = value as string | number | boolean | readonly string[];
  });

  return apiFilters;
}

export function buildBaseContractFilterOptions<T extends BaseFilterableContract>(
  contracts: readonly T[],
): BaseContractFilterOptions {
  const segments = uniqueSorted(contracts.map((contract) => contract.tipoSegmento));
  const products = uniqueSorted(contracts.map((contract) => contract.tipoProduto));
  const usersById = new Map<string, ContractFilterUserOption>();

  contracts.forEach((contract) => {
    const userId = contract.user?.id?.trim();
    const userName = contract.user?.name?.trim();

    if (!userId) {
      return;
    }

    usersById.set(userId, {
      id: userId,
      name: userName || userId,
    });
  });

  const users = Array.from(usersById.values()).sort((first, second) =>
    first.name.localeCompare(second.name, 'pt', { sensitivity: 'base' }),
  );

  return { segments, products, users };
}

export function mergeBaseContractFilterOptions(
  current: BaseContractFilterOptions,
  incoming: BaseContractFilterOptions,
): BaseContractFilterOptions {
  const usersById = new Map<string, ContractFilterUserOption>();

  [...current.users, ...incoming.users].forEach((user) => usersById.set(user.id, user));

  return {
    segments: uniqueSorted([...current.segments, ...incoming.segments]),
    products: uniqueSorted([...current.products, ...incoming.products]),
    users: Array.from(usersById.values()).sort((first, second) =>
      first.name.localeCompare(second.name, 'pt', { sensitivity: 'base' }),
    ),
  };
}

export function getVisibleContractStatuses<T extends string>(
  statuses: readonly T[],
  selectedStatuses: readonly string[],
): readonly T[] {
  if (!selectedStatuses.length) {
    return statuses;
  }

  const selected = new Set(selectedStatuses);
  return statuses.filter((status) => selected.has(status));
}

export function countActiveContractFilters(filters: object): number {
  return Object.values(filters as Record<string, unknown>).filter((value) => {
    if (typeof value === 'string') {
      return Boolean(value.trim());
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value !== null && value !== undefined && value !== false;
  }).length;
}

export function toFilterOptions(values: readonly string[]): ContractFilterOption[] {
  return values.map((value) => ({ value, label: value }));
}

export function toUserFilterOptions(
  users: readonly ContractFilterUserOption[],
): ContractFilterOption[] {
  return users.map((user) => ({ value: user.id, label: user.name }));
}

export function uniqueSorted(values: readonly unknown[]): string[] {
  const normalizedValues = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  return Array.from(new Set(normalizedValues)).sort((first, second) =>
    first.localeCompare(second, 'pt', { sensitivity: 'base' }),
  );
}

export function normalizeContractFilterText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt');
}

export interface ContractFilterFieldContext {
  segments: readonly string[];
  products: readonly string[];
  users: readonly ContractFilterUserOption[];
}

export interface EnergyFilterFieldOptions {
  includeCitizenCard?: boolean;
  includeSva?: boolean;
  includeSocialTariff?: boolean;
}

export interface SolarFilterFieldOptions {
  includeExpectedInstallation?: boolean;
  includePanelType?: boolean;
  includeCampaign?: boolean;
}

export function buildBaseContractFilterFields(
  context: ContractFilterFieldContext,
): ContractFilterFieldDefinition[] {
  return [
    field(
      'contractId',
      'ID Contrato',
      'id__contains',
      'search',
      'Identificação',
      'Pesquisar ID...',
    ),
    field('companyId', 'ID Comercializadora', 'companyId__contains', 'search', 'Identificação'),
    field('clientId', 'ID Cliente', 'clientId__contains', 'search', 'Identificação'),
    field('client', 'Cliente / Empresa', 'nomeClienteEmpresa__contains', 'search', 'Identificação'),
    field('nif', 'NIF', 'nif__contains', 'search', 'Identificação', 'Pesquisar NIF...', 'numeric'),
    field('phone', 'Telefone', 'telefone__contains', 'search', 'Identificação', undefined, 'tel'),
    field('email', 'Email', 'email__contains', 'search', 'Identificação', undefined, 'email'),
    selectField(
      'segment',
      'Segmento',
      'tipoSegmento__eq',
      'Contrato',
      toFilterOptions(context.segments),
    ),
    selectField(
      'product',
      'Produto',
      'tipoProduto__eq',
      'Contrato',
      toFilterOptions(context.products),
    ),
    statusField('Contrato'),
    field('quality', 'Controlo de Qualidade', 'controleQualidade__contains', 'search', 'Contrato'),
    field('registrationName', 'Nome Registo C.E.', 'nomeRegistoCE__contains', 'search', 'Contrato'),
    field(
      'registrationCode',
      'Código Registo C.E.',
      'codigoRegistoCE__contains',
      'search',
      'Contrato',
    ),
    selectField(
      'userId',
      'Criado por',
      'userId__eq',
      'Contrato',
      toUserFilterOptions(context.users),
    ),
    dateField('createdFrom', 'Criado desde', 'createdAt__gte', 'Datas do sistema'),
    dateField('createdTo', 'Criado até', 'createdAt__lte', 'Datas do sistema'),
    dateField('updatedFrom', 'Atualizado desde', 'updatedAt__gte', 'Datas do sistema'),
    dateField('updatedTo', 'Atualizado até', 'updatedAt__lte', 'Datas do sistema'),
  ];
}

export function buildEnergyContractFilterFields(
  context: ContractFilterFieldContext,
  options: EnergyFilterFieldOptions = {},
): ContractFilterFieldDefinition[] {
  const fields = buildBaseContractFilterFields(context);
  const contractInsertIndex = fields.findIndex((item) => item.group === 'Datas do sistema');
  const contractFields: ContractFilterFieldDefinition[] = [
    field('contracting', 'Contratação', 'contratacao__contains', 'search', 'Contrato'),
    field(
      'lightContracting',
      'Tipo contratação Luz',
      'tipoContratacaoLuz__contains',
      'search',
      'Contrato',
    ),
    field(
      'gasContracting',
      'Tipo contratação Gás',
      'tipoContratacaoGas__contains',
      'search',
      'Contrato',
    ),
  ];

  if (options.includeCitizenCard) {
    contractFields.push(
      field(
        'citizenCard',
        'Cartão de Cidadão',
        'cartaoCidadao__contains',
        'search',
        'Identificação',
      ),
    );
  }

  const commercialFields: ContractFilterFieldDefinition[] = [
    field('cae', 'CAE', 'cae__contains', 'search', 'Cliente / faturação'),
    field('crc', 'CRC', 'crc__contains', 'search', 'Cliente / faturação'),
    booleanField(
      'electronicInvoice',
      'Fatura eletrónica',
      'faturaEletronica__eq',
      'Cliente / faturação',
    ),
    booleanField('directDebit', 'Débito direto', 'debitoDireto__eq', 'Cliente / faturação'),
    field('iban', 'IBAN', 'iban__contains', 'search', 'Cliente / faturação'),
    field('campaign', 'Campanha', 'campanha__contains', 'search', 'Comercial / Energia'),
    field(
      'previousProvider',
      'Antiga comercializadora',
      'antigaComercializadora__contains',
      'search',
      'Comercial / Energia',
    ),
    field('cpe', 'CPE', 'cpe__contains', 'search', 'Comercial / Energia'),
    field('cui', 'CUI', 'cui__contains', 'search', 'Comercial / Energia'),
    numberField('powerMin', 'Potência mín.', 'potencia__gte', 'Comercial / Energia'),
    numberField('powerMax', 'Potência máx.', 'potencia__lte', 'Comercial / Energia'),
    field('gasLevel', 'Escalão', 'escalao__eq', 'search', 'Comercial / Energia'),
    field('cycle', 'Ciclo horário', 'cicloHorario__contains', 'search', 'Comercial / Energia'),
    field('voltage', 'Nível de tensão', 'nivelTensao__contains', 'search', 'Comercial / Energia'),
  ];

  if (options.includeSva) {
    commercialFields.splice(4, 0, booleanField('sva', 'SVA', 'sva__eq', 'Cliente / faturação'));
  }

  if (options.includeSocialTariff) {
    commercialFields.splice(
      4,
      0,
      booleanField('socialTariff', 'Tarifa Social', 'tarifaSocial__eq', 'Cliente / faturação'),
    );
  }

  const businessDates: ContractFilterFieldDefinition[] = [
    dateField('scheduledFrom', 'Agendamento desde', 'agendamento__gte', 'Datas do contrato'),
    dateField('scheduledTo', 'Agendamento até', 'agendamento__lte', 'Datas do contrato'),
    dateField('signatureFrom', 'Assinatura desde', 'dataAssinatura__gte', 'Datas do contrato'),
    dateField('signatureTo', 'Assinatura até', 'dataAssinatura__lte', 'Datas do contrato'),
    dateField('contractDateFrom', 'Contrato desde', 'dataContrato__gte', 'Datas do contrato'),
    dateField('contractDateTo', 'Contrato até', 'dataContrato__lte', 'Datas do contrato'),
    dateField('registrationDateFrom', 'Registo desde', 'dataRegisto__gte', 'Datas do contrato'),
    dateField('registrationDateTo', 'Registo até', 'dataRegisto__lte', 'Datas do contrato'),
    dateField(
      'cpeActivationFrom',
      'Ativação CPE desde',
      'dataAtivacaoCPE__gte',
      'Datas do contrato',
    ),
    dateField('cpeActivationTo', 'Ativação CPE até', 'dataAtivacaoCPE__lte', 'Datas do contrato'),
    dateField('cpeDeactivationFrom', 'Baixa CPE desde', 'dataBaixaCPE__gte', 'Datas do contrato'),
    dateField('cpeDeactivationTo', 'Baixa CPE até', 'dataBaixaCPE__lte', 'Datas do contrato'),
    dateField(
      'cuiActivationFrom',
      'Ativação CUI desde',
      'dataAtivacaoCUI__gte',
      'Datas do contrato',
    ),
    dateField('cuiActivationTo', 'Ativação CUI até', 'dataAtivacaoCUI__lte', 'Datas do contrato'),
    dateField('cuiDeactivationFrom', 'Baixa CUI desde', 'dataBaixaCUI__gte', 'Datas do contrato'),
    dateField('cuiDeactivationTo', 'Baixa CUI até', 'dataBaixaCUI__lte', 'Datas do contrato'),
  ];

  fields.splice(contractInsertIndex, 0, ...contractFields, ...commercialFields, ...businessDates);
  return fields;
}

export function buildSolarContractFilterFields(
  context: ContractFilterFieldContext,
  options: SolarFilterFieldOptions = {},
): ContractFilterFieldDefinition[] {
  const fields = buildBaseContractFilterFields(context);
  const systemDatesIndex = fields.findIndex((item) => item.group === 'Datas do sistema');
  const extras: ContractFilterFieldDefinition[] = [
    field('contracting', 'Contratação', 'contratacao__contains', 'search', 'Contrato'),
    field('leadNumber', 'N.º Lead', 'numeroLead__contains', 'search', 'Contrato'),
    field('offer', 'OFFER', 'offer__contains', 'search', 'Contrato'),
    field('cae', 'CAE', 'cae__contains', 'search', 'Cliente / faturação'),
    field('crc', 'CRC', 'crc__contains', 'search', 'Cliente / faturação'),
    booleanField(
      'electronicInvoice',
      'Fatura eletrónica',
      'faturaEletronica__eq',
      'Cliente / faturação',
    ),
    booleanField('directDebit', 'Débito direto', 'debitoDireto__eq', 'Cliente / faturação'),
    field('nib', 'NIB', 'nib__contains', 'search', 'Cliente / faturação'),
  ];

  if (options.includeCampaign) {
    extras.push(field('campaign', 'Campanha', 'campanha__contains', 'search', 'Comercial / Solar'));
  }

  if (options.includePanelType) {
    extras.push(
      field('panelType', 'Tipo de painel', 'tipoPainel__contains', 'search', 'Comercial / Solar'),
    );
  }

  extras.push(
    booleanField('microinverter', 'Microinversor', 'microinversor__eq', 'Comercial / Solar'),
    booleanField('batteries', 'Baterias', 'baterias__eq', 'Comercial / Solar'),
    numberField(
      'panelCountMin',
      'N.º painéis mín.',
      'numeroPaineisSolares__gte',
      'Comercial / Solar',
    ),
    numberField(
      'panelCountMax',
      'N.º painéis máx.',
      'numeroPaineisSolares__lte',
      'Comercial / Solar',
    ),
    field(
      'paymentMethod',
      'Método de pagamento',
      'metodoPagamento__contains',
      'search',
      'Comercial / Solar',
    ),
    dateField('scheduledFrom', 'Agendamento desde', 'agendamento__gte', 'Datas do contrato'),
    dateField('scheduledTo', 'Agendamento até', 'agendamento__lte', 'Datas do contrato'),
    dateField('signatureFrom', 'Assinatura desde', 'dataAssinatura__gte', 'Datas do contrato'),
    dateField('signatureTo', 'Assinatura até', 'dataAssinatura__lte', 'Datas do contrato'),
    dateField('contractDateFrom', 'Contrato desde', 'dataContrato__gte', 'Datas do contrato'),
    dateField('contractDateTo', 'Contrato até', 'dataContrato__lte', 'Datas do contrato'),
    dateField('registrationDateFrom', 'Registo desde', 'dataRegisto__gte', 'Datas do contrato'),
    dateField('registrationDateTo', 'Registo até', 'dataRegisto__lte', 'Datas do contrato'),
  );

  if (options.includeExpectedInstallation) {
    extras.push(
      dateField(
        'expectedInstallationFrom',
        'Instalação prevista desde',
        'dataPrevistaInstalacao__gte',
        'Datas do contrato',
      ),
      dateField(
        'expectedInstallationTo',
        'Instalação prevista até',
        'dataPrevistaInstalacao__lte',
        'Datas do contrato',
      ),
    );
  }

  extras.push(
    dateField('installationFrom', 'Instalação desde', 'dataInstalacao__gte', 'Datas do contrato'),
    dateField('installationTo', 'Instalação até', 'dataInstalacao__lte', 'Datas do contrato'),
    dateField('activationFrom', 'Ativação desde', 'dataAtivacao__gte', 'Datas do contrato'),
    dateField('activationTo', 'Ativação até', 'dataAtivacao__lte', 'Datas do contrato'),
    dateField('deactivationFrom', 'Baixa desde', 'dataBaixa__gte', 'Datas do contrato'),
    dateField('deactivationTo', 'Baixa até', 'dataBaixa__lte', 'Datas do contrato'),
  );

  fields.splice(systemDatesIndex, 0, ...extras);
  return fields;
}

export function buildWallboxContractFilterFields(
  context: ContractFilterFieldContext,
): ContractFilterFieldDefinition[] {
  const fields = buildBaseContractFilterFields(context);
  const systemDatesIndex = fields.findIndex((item) => item.group === 'Datas do sistema');
  fields.splice(
    systemDatesIndex,
    0,
    field('leadNumber', 'N.º Lead', 'numeroLead__contains', 'search', 'Contrato'),
    field('offer', 'OFFER', 'offer__contains', 'search', 'Contrato'),
    field('campaign', 'Campanha', 'campanha__contains', 'search', 'Comercial / Instalação'),
    field(
      'voltage',
      'Nível de tensão',
      'nivelTensao__contains',
      'search',
      'Comercial / Instalação',
    ),
    field(
      'installationType',
      'Tipo local instalação',
      'tipoLocalInstalacao__contains',
      'search',
      'Comercial / Instalação',
    ),
    field(
      'paymentMethod',
      'Método de pagamento',
      'metodoPagamento__contains',
      'search',
      'Comercial / Instalação',
    ),
    booleanField('travel', 'Com deslocação', 'comDeslocacao__eq', 'Comercial / Instalação'),
    booleanField(
      'powerBalancing',
      'Balanceamento potência',
      'balanceamentoPotencia__eq',
      'Comercial / Instalação',
    ),
    dateField('scheduledFrom', 'Agendamento desde', 'agendamento__gte', 'Datas do contrato'),
    dateField('scheduledTo', 'Agendamento até', 'agendamento__lte', 'Datas do contrato'),
    dateField('signatureFrom', 'Assinatura desde', 'dataAssinatura__gte', 'Datas do contrato'),
    dateField('signatureTo', 'Assinatura até', 'dataAssinatura__lte', 'Datas do contrato'),
    dateField('contractDateFrom', 'Contrato desde', 'dataContrato__gte', 'Datas do contrato'),
    dateField('contractDateTo', 'Contrato até', 'dataContrato__lte', 'Datas do contrato'),
    dateField('registrationDateFrom', 'Registo desde', 'dataRegisto__gte', 'Datas do contrato'),
    dateField('registrationDateTo', 'Registo até', 'dataRegisto__lte', 'Datas do contrato'),
    dateField('installationFrom', 'Instalação desde', 'dataInstalacao__gte', 'Datas do contrato'),
    dateField('installationTo', 'Instalação até', 'dataInstalacao__lte', 'Datas do contrato'),
    dateField('activationFrom', 'Ativação desde', 'dataAtivacao__gte', 'Datas do contrato'),
    dateField('activationTo', 'Ativação até', 'dataAtivacao__lte', 'Datas do contrato'),
    dateField('deactivationFrom', 'Baixa desde', 'dataBaixa__gte', 'Datas do contrato'),
    dateField('deactivationTo', 'Baixa até', 'dataBaixa__lte', 'Datas do contrato'),
  );
  return fields;
}

function field(
  key: string,
  label: string,
  apiKey: string,
  type: ContractFilterInputType,
  group: string,
  placeholder?: string,
  inputMode?: ContractFilterFieldDefinition['inputMode'],
): ContractFilterFieldDefinition {
  return { key, label, apiKey, type, group, placeholder, inputMode };
}

function selectField(
  key: string,
  label: string,
  apiKey: string,
  group: string,
  options: readonly ContractFilterOption[],
): ContractFilterFieldDefinition {
  return { key, label, apiKey, type: 'select', group, options };
}

function booleanField(
  key: string,
  label: string,
  apiKey: string,
  group: string,
): ContractFilterFieldDefinition {
  return { key, label, apiKey, type: 'boolean', group };
}

function numberField(
  key: string,
  label: string,
  apiKey: string,
  group: string,
): ContractFilterFieldDefinition {
  return { key, label, apiKey, type: 'number', group, inputMode: 'decimal' };
}

function dateField(
  key: string,
  label: string,
  apiKey: string,
  group: string,
): ContractFilterFieldDefinition {
  return { key, label, apiKey, type: 'date', group };
}

function statusField(group: string): ContractFilterFieldDefinition {
  return { key: 'status', label: 'Estado', type: 'status', group };
}
