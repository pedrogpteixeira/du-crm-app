import {
  SimulationCalculationProfile,
  SimulationCalculationProfileEnergyConfig,
} from '../services/simulator';

import {
  getSimulationProfileEnergyBehaviour,
  profileAllowsElectricityEnergyPrices,
  profileAllowsGasEnergyPrice,
  profileHasFixedElectricity,
  profileHasFixedGas,
  profileHasIndexedElectricity,
  profileHasIndexedGas,
  profileHasMixedPricing,
  profileIsFullyIndexed,
} from './simulation-calculation-profile';

describe('simulation calculation profile behaviour', () => {
  it('classifica fixed_hedge_plus_system_cost como fixed', () => {
    const behaviour = getSimulationProfileEnergyBehaviour({
      strategy: 'fixed_hedge_plus_system_cost',
    });

    expect(behaviour.pricing).toBe('fixed');
    expect(behaviour.hasFixedComponent).toBeTrue();
    expect(behaviour.hasIndexedComponent).toBeFalse();
    expect(behaviour.allowsTariffEnergyPrice).toBeTrue();
    expect(behaviour.isFullyIndexed).toBeFalse();
  });

  it('classifica strategies indexadas sem permitir preço fixo de energia no tariff', () => {
    const strategies: SimulationCalculationProfileEnergyConfig['strategy'][] = [
      'legacy_indexed',
      'indexed_cost_plus',
      'adjusted_factor_plus',
      'gas_adjusted',
    ];

    strategies.forEach((strategy) => {
      const behaviour = getSimulationProfileEnergyBehaviour({
        strategy,
      });

      expect(behaviour.pricing).toBe('indexed');
      expect(behaviour.hasFixedComponent).toBeFalse();
      expect(behaviour.hasIndexedComponent).toBeTrue();
      expect(behaviour.allowsTariffEnergyPrice).toBeFalse();
      expect(behaviour.isFullyIndexed).toBeTrue();
    });
  });

  it('classifica weighted_mix fixed + indexed como mixed e mantém preço fixo disponível', () => {
    const behaviour = getSimulationProfileEnergyBehaviour({
      strategy: 'weighted_mix',
      components: [
        {
          code: 'fixed',
          weight: 0.6,
          strategy: 'fixed_hedge_plus_system_cost',
        },
        {
          code: 'omie',
          weight: 0.4,
          strategy: 'indexed_cost_plus',
          marketSource: 'omie',
        },
      ],
    });

    expect(behaviour.pricing).toBe('mixed');
    expect(behaviour.hasFixedComponent).toBeTrue();
    expect(behaviour.hasIndexedComponent).toBeTrue();
    expect(behaviour.allowsTariffEnergyPrice).toBeTrue();
    expect(behaviour.isFullyIndexed).toBeFalse();
  });

  it('classifica weighted_mix apenas indexado como 100% indexed', () => {
    const behaviour = getSimulationProfileEnergyBehaviour({
      strategy: 'weighted_mix',
      components: [
        {
          code: 'omie-a',
          weight: 0.5,
          strategy: 'indexed_cost_plus',
          marketSource: 'omie',
        },
        {
          code: 'omie-b',
          weight: 0.5,
          strategy: 'adjusted_factor_plus',
          marketSource: 'omie',
        },
      ],
    });

    expect(behaviour.pricing).toBe('indexed');
    expect(behaviour.allowsTariffEnergyPrice).toBeFalse();
    expect(behaviour.isFullyIndexed).toBeTrue();
  });

  it('trata eletricidade e gás de um profile dual de forma independente', () => {
    const profile = buildProfile({
      productType: 'dual',
      electricity: {
        strategy: 'fixed_hedge_plus_system_cost',
      },
      gas: {
        strategy: 'gas_adjusted',
        marketSource: 'mibgas',
      },
    });

    expect(profileHasFixedElectricity(profile)).toBeTrue();
    expect(profileHasIndexedElectricity(profile)).toBeFalse();
    expect(profileAllowsElectricityEnergyPrices(profile)).toBeTrue();

    expect(profileHasFixedGas(profile)).toBeFalse();
    expect(profileHasIndexedGas(profile)).toBeTrue();
    expect(profileAllowsGasEnergyPrice(profile)).toBeFalse();

    expect(profileIsFullyIndexed(profile)).toBeFalse();
  });

  it('considera dual totalmente indexado apenas quando ambas as energias o são', () => {
    const profile = buildProfile({
      productType: 'dual',
      electricity: {
        strategy: 'indexed_cost_plus',
        marketSource: 'omie',
      },
      gas: {
        strategy: 'gas_adjusted',
        marketSource: 'mibgas',
      },
    });

    expect(profileIsFullyIndexed(profile)).toBeTrue();
  });

  it('mantém compatibilidade semântica com legacy_fixed e legacy_indexed em profiles antigos', () => {
    const fixedProfile = buildProfile({
      electricity: { strategy: 'legacy_fixed' },
    });
    const indexedProfile = buildProfile({
      electricity: { strategy: 'legacy_indexed' },
    });

    expect(profileAllowsElectricityEnergyPrices(fixedProfile)).toBeTrue();
    expect(profileAllowsElectricityEnergyPrices(indexedProfile)).toBeFalse();
  });

  it('expõe mixed por energia sem misturar eletricidade e gás', () => {
    const profile = buildProfile({
      productType: 'dual',
      electricity: {
        strategy: 'weighted_mix',
        components: [
          {
            code: 'fixed',
            weight: 0.5,
            strategy: 'fixed_hedge_plus_system_cost',
          },
          {
            code: 'indexed',
            weight: 0.5,
            strategy: 'indexed_cost_plus',
            marketSource: 'omie',
          },
        ],
      },
      gas: {
        strategy: 'gas_adjusted',
        marketSource: 'mibgas',
      },
    });

    expect(profileHasMixedPricing(profile, 'electricity')).toBeTrue();
    expect(profileHasMixedPricing(profile, 'gas')).toBeFalse();
  });
});

function buildProfile(
  overrides: Partial<SimulationCalculationProfile>,
): SimulationCalculationProfile {
  return {
    id: 'profile-1',
    familyCode: 'TEST',
    commercializerId: 'company-1',
    productType: 'electricity',
    commissionMode: 'team_table',
    active: true,
    version: 1,
    ...overrides,
  };
}
