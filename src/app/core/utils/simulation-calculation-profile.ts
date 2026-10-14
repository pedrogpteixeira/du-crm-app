import {
  SimulationCalculationProfile,
  SimulationCalculationProfileEnergyConfig,
  SimulationCalculationStrategy,
} from '../services/simulator';

export type SimulationProfilePricingBehaviour = 'fixed' | 'mixed' | 'indexed' | 'unconfigured';

export interface SimulationProfileEnergyBehaviour {
  pricing: SimulationProfilePricingBehaviour;
  hasFixedComponent: boolean;
  hasIndexedComponent: boolean;
  allowsTariffEnergyPrice: boolean;
  isFullyIndexed: boolean;
}

type EnergyKind = 'electricity' | 'gas';

const FIXED_STRATEGIES = new Set<SimulationCalculationStrategy>([
  'legacy_fixed',
  'fixed_hedge_plus_system_cost',
]);

const INDEXED_STRATEGIES = new Set<SimulationCalculationStrategy>([
  'legacy_indexed',
  'indexed_cost_plus',
  'adjusted_factor_plus',
  'gas_adjusted',
]);

interface StrategyFlags {
  hasFixedComponent: boolean;
  hasIndexedComponent: boolean;
}

/**
 * Classifica apenas COMO a energia é calculada pelo Calculation Profile.
 *
 * Os preços comerciais concretos continuam a pertencer ao SimulationTariff.
 * Em particular, um profile com componente fixa (incluindo weighted_mix)
 * permite que o tariff forneça o preço de energia dessa componente. Um
 * profile 100% indexado não permite preços fixos de energia sem efeito.
 */
export function getSimulationProfileEnergyBehaviour(
  config: SimulationCalculationProfileEnergyConfig | null | undefined,
): SimulationProfileEnergyBehaviour {
  if (!config) {
    return buildBehaviour(false, false);
  }

  const flags = getStrategyFlags(config.strategy, config);

  return buildBehaviour(flags.hasFixedComponent, flags.hasIndexedComponent);
}

export function getSimulationProfileBehaviour(
  profile: SimulationCalculationProfile | null | undefined,
  energy: EnergyKind,
): SimulationProfileEnergyBehaviour {
  return getSimulationProfileEnergyBehaviour(profile?.[energy]);
}

export function profileHasFixedElectricity(
  profile: SimulationCalculationProfile | null | undefined,
): boolean {
  return getSimulationProfileBehaviour(profile, 'electricity').hasFixedComponent;
}

export function profileHasIndexedElectricity(
  profile: SimulationCalculationProfile | null | undefined,
): boolean {
  return getSimulationProfileBehaviour(profile, 'electricity').hasIndexedComponent;
}

export function profileHasFixedGas(
  profile: SimulationCalculationProfile | null | undefined,
): boolean {
  return getSimulationProfileBehaviour(profile, 'gas').hasFixedComponent;
}

export function profileHasIndexedGas(
  profile: SimulationCalculationProfile | null | undefined,
): boolean {
  return getSimulationProfileBehaviour(profile, 'gas').hasIndexedComponent;
}

export function profileAllowsElectricityEnergyPrices(
  profile: SimulationCalculationProfile | null | undefined,
): boolean {
  return getSimulationProfileBehaviour(profile, 'electricity').allowsTariffEnergyPrice;
}

export function profileAllowsGasEnergyPrice(
  profile: SimulationCalculationProfile | null | undefined,
): boolean {
  return getSimulationProfileBehaviour(profile, 'gas').allowsTariffEnergyPrice;
}

/**
 * Avalia o profile por produto sem misturar a decisão de eletricidade e gás.
 * Num Dual só devolve true quando ambas as energias configuradas são 100%
 * indexadas. Se faltar a configuração de uma energia, o profile não é
 * considerado totalmente indexado pelo frontend.
 */
export function profileIsFullyIndexed(
  profile: SimulationCalculationProfile | null | undefined,
): boolean {
  if (!profile) {
    return false;
  }

  if (profile.productType === 'electricity') {
    return getSimulationProfileBehaviour(profile, 'electricity').isFullyIndexed;
  }

  if (profile.productType === 'gas') {
    return getSimulationProfileBehaviour(profile, 'gas').isFullyIndexed;
  }

  return (
    getSimulationProfileBehaviour(profile, 'electricity').isFullyIndexed &&
    getSimulationProfileBehaviour(profile, 'gas').isFullyIndexed
  );
}

export function profileHasMixedPricing(
  profile: SimulationCalculationProfile | null | undefined,
  energy: EnergyKind,
): boolean {
  return getSimulationProfileBehaviour(profile, energy).pricing === 'mixed';
}

function getStrategyFlags(
  strategy: SimulationCalculationStrategy,
  config?: SimulationCalculationProfileEnergyConfig,
): StrategyFlags {
  if (FIXED_STRATEGIES.has(strategy)) {
    return {
      hasFixedComponent: true,
      hasIndexedComponent: false,
    };
  }

  if (INDEXED_STRATEGIES.has(strategy)) {
    return {
      hasFixedComponent: false,
      hasIndexedComponent: true,
    };
  }

  if (strategy !== 'weighted_mix') {
    return {
      hasFixedComponent: false,
      hasIndexedComponent: false,
    };
  }

  const components = config?.components ?? [];

  return components.reduce<StrategyFlags>(
    (result, component) => {
      // A estrutura atual do DTO não suporta components dentro de um
      // componente weighted_mix. Se surgir um weighted_mix aninhado, não
      // inventamos comportamento: o backend continua a ser a fonte de verdade.
      const componentFlags = getStrategyFlags(component.strategy);

      return {
        hasFixedComponent: result.hasFixedComponent || componentFlags.hasFixedComponent,
        hasIndexedComponent: result.hasIndexedComponent || componentFlags.hasIndexedComponent,
      };
    },
    {
      hasFixedComponent: false,
      hasIndexedComponent: false,
    },
  );
}

function buildBehaviour(
  hasFixedComponent: boolean,
  hasIndexedComponent: boolean,
): SimulationProfileEnergyBehaviour {
  let pricing: SimulationProfilePricingBehaviour = 'unconfigured';

  if (hasFixedComponent && hasIndexedComponent) {
    pricing = 'mixed';
  } else if (hasFixedComponent) {
    pricing = 'fixed';
  } else if (hasIndexedComponent) {
    pricing = 'indexed';
  }

  return {
    pricing,
    hasFixedComponent,
    hasIndexedComponent,
    allowsTariffEnergyPrice: hasFixedComponent,
    isFullyIndexed: hasIndexedComponent && !hasFixedComponent,
  };
}
