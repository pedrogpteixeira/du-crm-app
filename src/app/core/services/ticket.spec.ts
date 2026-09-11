import {
  buildCancellationDescription,
  CreateTicketRequest,
  hasRequiredDocuments,
  prepareTicketCreatePayload,
  prepareTicketUpdatePayload,
  TicketDetail,
} from './ticket';

describe('Ticket request rules', () => {
  const createBase: CreateTicketRequest = {
    contractId: 'rct_test',
    companyId: 'cmp_test',
    tipo: 'Novo Pedido de Chamada',
    userId: 'usr_test',
    teams: [],
  };

  const ticket = (tipo: TicketDetail['tipo']): TicketDetail =>
    ({
      tipo,
      anexos: [],
    }) as unknown as TicketDetail;

  it('omits documentosConfirmados for Novo Pedido de Chamada', () => {
    const payload = prepareTicketCreatePayload(
      {
        ...createBase,
        documentosConfirmados: false,
      },
      false,
    );

    expect(payload.documentosConfirmados).toBeUndefined();
  });

  it('adds documentosConfirmados only when creating Tratamento de Pendência with documents', () => {
    const payload = prepareTicketCreatePayload(
      {
        ...createBase,
        tipo: 'Tratamento de Pendência',
      },
      true,
    );

    expect(payload.documentosConfirmados).toBeTrue();
  });

  it('adds documentosConfirmados to any update that remains Tratamento de Pendência', () => {
    const payload = prepareTicketUpdatePayload(
      ticket('Tratamento de Pendência'),
      { prioridade: 'Alto' },
    );

    expect(payload).toEqual({
      prioridade: 'Alto',
      documentosConfirmados: true,
    });
  });

  it('uses the final type when changing to Tratamento de Pendência', () => {
    const payload = prepareTicketUpdatePayload(
      ticket('Novo Pedido de Chamada'),
      { tipo: 'Tratamento de Pendência' },
    );

    expect(payload.documentosConfirmados).toBeTrue();
  });

  it('omits documentosConfirmados when changing Tratamento de Pendência to Pedido de Anulação', () => {
    const payload = prepareTicketUpdatePayload(
      ticket('Tratamento de Pendência'),
      {
        tipo: 'Pedido de Anulação',
        documentosConfirmados: true,
      },
    );

    expect(payload).toEqual({ tipo: 'Pedido de Anulação' });
  });

  it('validates the final document set with existing, new and removed files', () => {
    const existing = [
      {
        fileName: 'existing.pdf',
        originalName: 'existing.pdf',
        mimetype: 'application/pdf',
        size: 100,
        storageProvider: null,
      },
    ];

    expect(hasRequiredDocuments(existing)).toBeTrue();
    expect(hasRequiredDocuments(existing, [], ['existing.pdf'])).toBeFalse();
    expect(
      hasRequiredDocuments(existing, [{} as File], ['existing.pdf']),
    ).toBeTrue();
  });

  it('builds the cancellation reason without replacing an existing description', () => {
    expect(
      buildCancellationDescription(
        'Cliente contactou o suporte.',
        '  Não pretende renovar.  ',
      ),
    ).toBe(
      'Cliente contactou o suporte.\n\nMotivo da anulação: Não pretende renovar.',
    );
  });

  it('builds only the cancellation reason when there is no description', () => {
    expect(
      buildCancellationDescription('', 'Cliente mudou de comercializadora.'),
    ).toBe(
      'Motivo da anulação: Cliente mudou de comercializadora.',
    );
  });
});
