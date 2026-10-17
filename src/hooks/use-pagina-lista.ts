import { useEffect, useState } from "react";

export const TAMANHO_LISTA = 10;

/**
 * Fatia uma lista já carregada em páginas fixas. Só controla a UI: o dado
 * completo continua vindo da query (caixa da sessão, etc.).
 */
export function usePaginaLista<T>(itens: readonly T[], tamanho = TAMANHO_LISTA) {
  const [pagina, setPagina] = useState(0);
  const totalPaginas = Math.max(1, Math.ceil(itens.length / tamanho));

  useEffect(() => {
    setPagina((atual) => Math.min(atual, totalPaginas - 1));
  }, [totalPaginas]);

  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * tamanho;
  const fatia = itens.slice(inicio, inicio + tamanho);

  return {
    fatia,
    pagina: paginaAtual,
    totalPaginas,
    totalItens: itens.length,
    tamanho,
    setPagina,
  };
}
