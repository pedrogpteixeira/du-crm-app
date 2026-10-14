import { getSimulationCalculationBasisLabel } from './simulation-calculation-basis';

describe('getSimulationCalculationBasisLabel', () => {
  it('returns a direct label for interval calculations', () => {
    expect(getSimulationCalculationBasisLabel('interval', false)).toBe(
      'Cálculo com perfil intervalar',
    );
  });

  it('marks average fallbacks as estimates when the backend says they are estimated', () => {
    expect(getSimulationCalculationBasisLabel('monthly_average', true)).toBe(
      'Estimativa baseada em média mensal',
    );
  });

  it('does not invent a basis when the backend does not provide one', () => {
    expect(getSimulationCalculationBasisLabel()).toBeNull();
  });

  it('can surface the estimated flag without inventing a missing basis', () => {
    expect(getSimulationCalculationBasisLabel(undefined, true)).toBe(
      'Estimativa calculada pelo backend',
    );
  });
});
