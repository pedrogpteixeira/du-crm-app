import {
  getVodafoneLifecycleDateValidationError,
  isVodafoneActivationDateRequired,
  isVodafoneDeactivationDateRequired,
} from './vodafone-contract-lifecycle';

describe('Vodafone contract lifecycle dates', () => {
  it('keeps both dates optional outside Ativo and Anulado', () => {
    expect(getVodafoneLifecycleDateValidationError('Em validação', '', '')).toBeNull();
    expect(isVodafoneActivationDateRequired('Em validação')).toBeFalse();
    expect(isVodafoneDeactivationDateRequired('Em validação')).toBeFalse();
  });

  it('requires Data de Ativação when the effective final state is Ativo', () => {
    expect(getVodafoneLifecycleDateValidationError('Ativo', '', '')).toBe(
      'A Data de Ativação é obrigatória para o estado Ativo.',
    );
    expect(getVodafoneLifecycleDateValidationError('Ativo', '2026-10-14', '')).toBeNull();
    expect(isVodafoneActivationDateRequired('Ativo')).toBeTrue();
  });

  it('accepts an existing Data de Ativação when only the state changes to Ativo', () => {
    const currentFormValue = {
      estado: 'Ativo',
      dataAtivacao: '2026-10-01',
      dataBaixa: '',
    };

    expect(
      getVodafoneLifecycleDateValidationError(
        currentFormValue.estado,
        currentFormValue.dataAtivacao,
        currentFormValue.dataBaixa,
      ),
    ).toBeNull();
  });

  it('requires Data de Baixa when the effective final state is Anulado', () => {
    expect(getVodafoneLifecycleDateValidationError('Anulado', '', '')).toBe(
      'A Data de Baixa é obrigatória para o estado Anulado.',
    );
    expect(getVodafoneLifecycleDateValidationError('Anulado', '', '2026-10-14')).toBeNull();
    expect(isVodafoneDeactivationDateRequired('Anulado')).toBeTrue();
  });

  it('accepts an existing Data de Baixa when only the state changes to Anulado', () => {
    const currentFormValue = {
      estado: 'Anulado',
      dataAtivacao: '',
      dataBaixa: '2026-10-03',
    };

    expect(
      getVodafoneLifecycleDateValidationError(
        currentFormValue.estado,
        currentFormValue.dataAtivacao,
        currentFormValue.dataBaixa,
      ),
    ).toBeNull();
  });
});
