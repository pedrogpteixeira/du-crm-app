const CONTRACT_STATUS_COLORS: Readonly<Record<string, string>> = {
  'Pedido de Chamada': '#0e7490',
  'Pedido de chamada': '#0e7490',
  'Pedido de Contratação': '#0e7490',
  'Pedido de Proposta': '#0e7490',

  'Em validação': '#6d28d9',
  'Pendente Assinatura Digital': '#6d28d9',
  'Registo Plataforma Galp': '#6d28d9',
  'Pendente Validação Comercial': '#6d28d9',
  'Registo MEO': '#6d28d9',
  'Envio Quality Check': '#6d28d9',
  'Atribuído': '#6d28d9',

  'Chamada Efetuada': '#1d4ed8',
  'Pendente (ATR)': '#1d4ed8',
  'Pedido de Simulação': '#1d4ed8',
  'Proposta Enviada': '#1d4ed8',
  'Proposta enviada': '#1d4ed8',
  'Em Ativação': '#1d4ed8',
  'Em ativação': '#1d4ed8',
  'Em instalação': '#1d4ed8',
  'Pedido de Fornecimento': '#1d4ed8',

  'Pedido SMS (RGPD)': '#0f766e',
  'Pedido VTV': '#0f766e',
  'Pendente SMS "Cond Contratuais"': '#0f766e',
  'Em fornecimento': '#0f766e',

  'Não Conformidade': '#b45309',
  'Não conformidade': '#b45309',
  'Pendente Docs': '#b45309',

  'Documentos Enviados': '#15803d',
  'Ativo': '#15803d',

  'Desistência/Recuperar': '#9a3412',
  'Parcialmente Baixa': '#9a3412',

  'BackOffice': '#475569',
  'Controle': '#475569',
  'Sem Registo': '#475569',
  'Baixa': '#475569',

  'Cancelado': '#b91c1c',
  'Cancelada': '#b91c1c',
  'Anulado': '#b91c1c',
};

export function getContractStatusColor(status: string): string {
  return CONTRACT_STATUS_COLORS[status] ?? '#475569';
}
