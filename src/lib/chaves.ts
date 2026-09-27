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
};
