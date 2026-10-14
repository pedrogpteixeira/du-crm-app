import {
  buildEnergyContractFilterFields,
  buildVodafoneContractFilterFields,
  createVodafoneContractFilters,
} from './contract-list-filters';

describe('Vodafone contract filters', () => {
  const removedKeys = [
    'contractDateFrom',
    'contractDateTo',
    'lightContracting',
    'gasContracting',
    'cpeActivationFrom',
    'cpeActivationTo',
    'cpeDeactivationFrom',
    'cpeDeactivationTo',
    'cuiActivationFrom',
    'cuiActivationTo',
    'cuiDeactivationFrom',
    'cuiDeactivationTo',
    'socialTariff',
    'cpe',
    'cui',
    'powerMin',
    'powerMax',
    'gasLevel',
    'cycle',
    'voltage',
  ];

  const removedApiKeys = [
    'dataContrato__gte',
    'dataContrato__lte',
    'tipoContratacaoLuz__contains',
    'tipoContratacaoGas__contains',
    'dataAtivacaoCPE__gte',
    'dataAtivacaoCPE__lte',
    'dataBaixaCPE__gte',
    'dataBaixaCPE__lte',
    'dataAtivacaoCUI__gte',
    'dataAtivacaoCUI__lte',
    'dataBaixaCUI__gte',
    'dataBaixaCUI__lte',
    'tarifaSocial__eq',
    'cpe__contains',
    'cui__contains',
    'potencia__gte',
    'potencia__lte',
    'escalao__eq',
    'cicloHorario__contains',
    'nivelTensao__contains',
  ];

  it('does not keep removed Vodafone fields in filter state', () => {
    const filters = createVodafoneContractFilters();

    removedKeys.forEach((key) => expect(Object.hasOwn(filters, key)).toBeFalse());
  });

  it('does not expose removed Vodafone filters or API query parameters', () => {
    const fields = buildVodafoneContractFilterFields({
      segments: ['Residencial'],
      products: ['TV'],
      users: [{ id: 'usr_1', name: 'Utilizador' }],
    });

    const fieldKeys = fields.map((field) => field.key);
    const apiKeys = fields.map((field) => field.apiKey).filter(Boolean);

    removedKeys.forEach((key) => expect(fieldKeys).not.toContain(key));
    removedApiKeys.forEach((apiKey) => expect(apiKeys).not.toContain(apiKey));
  });


  it('keeps the shared energy filters enabled by default for the other providers', () => {
    const fields = buildEnergyContractFilterFields({
      segments: [],
      products: [],
      users: [],
    });
    const fieldKeys = fields.map((field) => field.key);

    expect(fieldKeys).toEqual(
      jasmine.arrayContaining([
        'lightContracting',
        'gasContracting',
        'cpe',
        'cui',
        'powerMin',
        'gasLevel',
        'cycle',
        'voltage',
        'cpeActivationFrom',
        'cuiActivationFrom',
      ]),
    );
  });

  it('keeps the valid Vodafone commercial and contract filters', () => {
    const fields = buildVodafoneContractFilterFields({
      segments: [],
      products: [],
      users: [],
    });

    expect(fields.map((field) => field.key)).toEqual(
      jasmine.arrayContaining([
        'contracting',
        'electronicInvoice',
        'directDebit',
        'campaign',
        'previousProvider',
        'scheduledFrom',
        'scheduledTo',
        'registrationDateFrom',
        'registrationDateTo',
      ]),
    );
  });
});
