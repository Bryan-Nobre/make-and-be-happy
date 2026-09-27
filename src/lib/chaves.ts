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
};
