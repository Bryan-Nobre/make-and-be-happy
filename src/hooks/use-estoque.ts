import { useQuery } from "@tanstack/react-query";

import { ERRO } from "@/lib/erros";
import { chaves } from "@/lib/chaves";
import { useEmpresaAtual } from "@/providers/empresa";
import * as servico from "@/services/estoque";

import { useMutacao } from "./use-mutacao";

export function useItensEstoque() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.itensEstoque(empresa.id),
    queryFn: () => servico.listarItensEstoque(empresa.id),
  });
}

/** Sem `itemId`, traz as últimas movimentações de todos os itens. */
export function useMovimentacoesEstoque(itemId?: string, limite = 100) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.movimentacoesEstoque(empresa.id, itemId ?? "todas"),
    queryFn: () => servico.listarMovimentacoesEstoque(empresa.id, { itemId, limite }),
  });
}

/** Movimentações desde o início do dia local (para KPIs). */
export function useMovimentacoesEstoqueHoje() {
  const { empresa } = useEmpresaAtual();
  const inicioDia = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();

  return useQuery({
    queryKey: [...chaves.estoque(empresa.id), "movimentacoes-hoje", inicioDia.slice(0, 10)] as const,
    queryFn: () =>
      servico.listarMovimentacoesEstoque(empresa.id, { desde: inicioDia, limite: 500 }),
  });
}

export function useFichaTecnica(produtoId: string | null) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.fichaTecnica(empresa.id, produtoId ?? ""),
    queryFn: () => servico.listarFichaTecnica(empresa.id, produtoId ?? ""),
    enabled: !!produtoId,
  });
}

export function useEstoqueMutations() {
  const { empresa } = useEmpresaAtual();
  const invalidar = [chaves.estoque(empresa.id), chaves.dashboard(empresa.id)];
  const erros = { [ERRO.duplicado]: "Já existe um item de estoque com este nome ou código." };

  const criar = useMutacao({
    executar: (
      entrada: servico.EntradaItemEstoque & { saldoInicial: number; requisicaoId: string },
    ) => servico.criarItemEstoque(empresa.id, entrada),
    sucesso: "Item cadastrado.",
    erros,
    invalidar,
  });

  const atualizar = useMutacao({
    executar: ({ id, ...entrada }: servico.EntradaItemEstoque & { id: string }) =>
      servico.atualizarItemEstoque(empresa.id, id, entrada),
    sucesso: "Item atualizado.",
    erros,
    invalidar,
  });

  const alternarAtivo = useMutacao({
    executar: ({ id, ativo }: { id: string; ativo: boolean }) =>
      servico.definirItemEstoqueAtivo(empresa.id, id, ativo),
    sucesso: (_, { ativo }) => (ativo ? "Item reativado." : "Item desativado."),
    invalidar,
  });

  const movimentar = useMutacao({
    executar: (entrada: Parameters<typeof servico.movimentarEstoque>[1]) =>
      servico.movimentarEstoque(empresa.id, entrada),
    sucesso: "Movimentação registrada.",
    invalidar,
  });

  const confirmarSessao = useMutacao({
    executar: (entrada: Parameters<typeof servico.confirmarSessaoBipagem>[1]) =>
      servico.confirmarSessaoBipagem(empresa.id, entrada),
    sucesso: (_, e) => {
      const n = e.linhas.filter((l) => l.quantidade > 0).length;
      if (e.tipo === "AJUSTE") return "Inventário registrado.";
      if (e.tipo === "SAIDA") return `${n} saída(s) registrada(s).`;
      return `${n} entrada(s) registrada(s).`;
    },
    invalidar,
  });

  const definirFicha = useMutacao({
    executar: ({ produtoId, insumos }: { produtoId: string; insumos: servico.InsumoFicha[] }) =>
      servico.definirFichaTecnica(produtoId, insumos),
    sucesso: "Ficha técnica salva.",
    invalidar,
  });

  return { criar, atualizar, alternarAtivo, movimentar, confirmarSessao, definirFicha };
}
