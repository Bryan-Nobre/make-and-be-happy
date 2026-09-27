/**
 * Chaves de cache do TanStack Query.
 *
 * Toda chave de dado de negócio carrega o `empresaId`, para que trocar de
 * empresa nunca reaproveite resultado de outra.
 */
export const chaves = {
  categorias: (empresaId: string) => ["categorias", empresaId] as const,
  setores: (empresaId: string) => ["setores", empresaId] as const,
  produtos: (empresaId: string) => ["produtos", empresaId] as const,
  gruposAdicionais: (empresaId: string) => ["grupos-adicionais", empresaId] as const,
  clientes: (empresaId: string) => ["clientes", empresaId] as const,
  mesas: (empresaId: string) => ["mesas", empresaId] as const,
  formasPagamento: (empresaId: string) => ["formas-pagamento", empresaId] as const,
  membros: (empresaId: string) => ["membros", empresaId] as const,
  convites: (empresaId: string) => ["convites", empresaId] as const,

  /** Prefixo de tudo que muda com o movimento do salão (mesas, comandas, pedidos). */
  salao: (empresaId: string) => ["salao", empresaId] as const,
  mesasEstado: (empresaId: string) => ["salao", empresaId, "mesas"] as const,
  comanda: (empresaId: string, comandaId: string) =>
    ["salao", empresaId, "comanda", comandaId] as const,
  pedidosDaComanda: (empresaId: string, comandaId: string) =>
    ["salao", empresaId, "pedidos", comandaId] as const,
  painelCozinha: (empresaId: string) => ["cozinha", empresaId] as const,

  /** Prefixo de tudo que muda com o caixa (sessão, movimentações, pagamentos). */
  caixa: (empresaId: string) => ["caixa", empresaId] as const,
  sessaoAberta: (empresaId: string) => ["caixa", empresaId, "sessao-aberta"] as const,
  fechamentos: (empresaId: string) => ["caixa", empresaId, "fechamentos"] as const,
  movimentacoes: (empresaId: string, sessaoId: string) =>
    ["caixa", empresaId, "movimentacoes", sessaoId] as const,
  pagamentos: (empresaId: string, sessaoId: string) =>
    ["caixa", empresaId, "pagamentos", sessaoId] as const,
  pedidosAReceber: (empresaId: string) => ["caixa", empresaId, "a-receber"] as const,

  /** Prefixo de tudo que muda com o saldo de estoque. Vendas também mexem nele. */
  estoque: (empresaId: string) => ["estoque", empresaId] as const,
  itensEstoque: (empresaId: string) => ["estoque", empresaId, "itens"] as const,
  movimentacoesEstoque: (empresaId: string, itemId: string) =>
    ["estoque", empresaId, "movimentacoes", itemId] as const,
  fichaTecnica: (empresaId: string, produtoId: string) =>
    ["estoque", empresaId, "ficha", produtoId] as const,

  dashboard: (empresaId: string) => ["dashboard", empresaId] as const,
  relatorios: (empresaId: string, inicio: string, fim: string) =>
    ["relatorios", empresaId, inicio, fim] as const,
};
