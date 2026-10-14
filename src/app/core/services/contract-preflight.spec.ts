import {
  SUPPLY_POINT_PREFLIGHT_PROVIDERS,
  supportsContractPreflight,
} from './contract-preflight';

describe('Contract preflight providers', () => {
  it('does not expose Vodafone as a supply-point preflight provider', () => {
    expect(SUPPLY_POINT_PREFLIGHT_PROVIDERS).not.toContain('vodafone' as never);
    expect(supportsContractPreflight('vodafone')).toBeFalse();
  });

  it('keeps the providers that still use CPE/CUI preflight validation', () => {
    [
      'repsol',
      'galp-power-gas',
      'iberdrola',
      'yes-energy',
      'meo-energias',
      'portulogos',
    ].forEach((provider) => expect(supportsContractPreflight(provider)).toBeTrue());
  });
});
