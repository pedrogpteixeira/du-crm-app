import type { SimulationCalculationBasis } from '../services/simulator';

export function getSimulationCalculationBasisLabel(
  basis?: SimulationCalculationBasis,
  estimated?: boolean,
): string | null {
  if (!basis) {
    return estimated === true ? 'Estimativa calculada pelo backend' : null;
  }

  switch (basis) {
    case 'interval':
      return 'Cálculo com perfil intervalar';

    case 'tariff_periods':
      return 'Cálculo com consumos por período tarifário';

    case 'daily_average':
      return estimated === true
        ? 'Estimativa baseada em média diária'
        : 'Cálculo baseado em média diária';

    case 'weekly_average':
      return estimated === true
        ? 'Estimativa baseada em média semanal'
        : 'Cálculo baseado em média semanal';

    case 'monthly_average':
      return estimated === true
        ? 'Estimativa baseada em média mensal'
        : 'Cálculo baseado em média mensal';
  }
}
