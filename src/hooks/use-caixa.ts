import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { brl } from "@/lib/format";
import { chaves } from "@/lib/chaves";
import { supabase } from "@/lib/supabase";
import { useEmpresaAtual } from "@/providers/empresa";
import * as servico from "@/services/caixa";

import { useMutacao } from "./use-mutacao";

const INTERVALO_RESERVA_MS = 30_000;

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

/**
 * Mantém o caixa atualizado quando outro operador movimenta a sessão. Pedidos
 * entram porque os de balcão a receber saem da lista quando são pagos.
 * A RLS só entrega eventos a quem pode ler o caixa.
 */
export function useRealtimeCaixa() {
  const { empresa } = useEmpresaAtual();
  const queryClient = useQueryClient();

  useEffect(() => {
    const filtro = `empresa_id=eq.${empresa.id}`;
    const invalidar = () => {
      void queryClient.invalidateQueries({ queryKey: chaves.caixa(empresa.id) });
    };

    const canal = supabase
      .channel(`caixa:${empresa.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessoes_caixa", filter: filtro },
        invalidar,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "movimentacoes_caixa", filter: filtro },
        invalidar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: filtro },
        invalidar,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [empresa.id, queryClient]);
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export function useSessaoAberta({ habilitado = true }: { habilitado?: boolean } = {}) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.sessaoAberta(empresa.id),
    queryFn: () => servico.buscarSessaoAberta(empresa.id),
    enabled: habilitado,
    refetchInterval: INTERVALO_RESERVA_MS,
  });
}

export function useFechamentos() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.fechamentos(empresa.id),
    queryFn: () => servico.listarFechamentos(empresa.id),
  });
}

export function useMovimentacoes(sessaoId: string | null) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.movimentacoes(empresa.id, sessaoId ?? ""),
    queryFn: () => servico.listarMovimentacoes(empresa.id, sessaoId ?? ""),
    enabled: !!sessaoId,
  });
}

export function usePagamentos(sessaoId: string | null) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.pagamentos(empresa.id, sessaoId ?? ""),
    queryFn: () => servico.listarPagamentos(empresa.id, sessaoId ?? ""),
    enabled: !!sessaoId,
  });
}

export function usePedidosAReceber() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.pedidosAReceber(empresa.id),
    queryFn: () => servico.listarPedidosAReceber(empresa.id),
    refetchInterval: INTERVALO_RESERVA_MS,
  });
}

export function usePendenciasCaixa() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.pendenciasCaixa(empresa.id),
    queryFn: () => servico.buscarPendenciasCaixa(empresa.id),
  });
}

/** Saldo oficial de um pedido recém-criado, para abrir a cobrança com o valor do banco. */
export function useSaldoPedido(pedidoId: string | null) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: [...chaves.caixa(empresa.id), "saldo-pedido", pedidoId ?? ""],
    queryFn: () => servico.buscarSaldoPedido(empresa.id, pedidoId ?? ""),
    enabled: !!pedidoId,
  });
}

// ---------------------------------------------------------------------------
// Mutações
// ---------------------------------------------------------------------------

export function useCaixaMutations() {
  const { empresa } = useEmpresaAtual();
  const invalidar = [chaves.caixa(empresa.id)];

  const abrir = useMutacao({
    executar: (entrada: { valorInicial: number; observacao: string; requisicaoId: string }) =>
      servico.abrirCaixa(empresa.id, entrada),
    sucesso: "Caixa aberto.",
    invalidar,
  });

  const movimentar = useMutacao({
    executar: (entrada: Parameters<typeof servico.movimentarCaixa>[1]) =>
      servico.movimentarCaixa(empresa.id, entrada),
    sucesso: (_, entrada) =>
      entrada.tipo === "SANGRIA" ? "Sangria registrada." : "Suprimento registrado.",
    invalidar,
  });

  const fechar = useMutacao({
    executar: ({
      sessaoId,
      ...entrada
    }: {
      sessaoId: string;
      dinheiroInformado: number;
      justificativa: string;
    }) => servico.fecharCaixa(sessaoId, entrada),
    sucesso: "Caixa fechado.",
    invalidar,
  });

  const estornar = useMutacao({
    executar: ({ pagamentoId, motivo }: { pagamentoId: string; motivo: string }) =>
      servico.estornarPagamento(pagamentoId, motivo),
    sucesso: "Pagamento estornado.",
    invalidar: [...invalidar, chaves.salao(empresa.id)],
  });

  return { abrir, movimentar, fechar, estornar };
}

export function useRegistrarPagamento(
  aoConcluir?: (resultado: servico.ResultadoPagamento) => void,
) {
  const { empresa } = useEmpresaAtual();

  return useMutacao({
    executar: (entrada: {
      alvo: servico.AlvoPagamento;
      partes: servico.PartePagamento[];
      requisicaoId: string;
    }) => servico.registrarPagamento(empresa.id, entrada),
    sucesso: ({ troco, saldo }) => {
      const partes = ["Pagamento registrado."];
      if (troco > 0) partes.push(`Troco: ${brl(troco)}.`);
      if (saldo > 0) partes.push(`Ainda faltam ${brl(saldo)}.`);
      return partes.join(" ");
    },
    invalidar: [chaves.caixa(empresa.id), chaves.salao(empresa.id), chaves.dashboard(empresa.id)],
    aoConcluir: (resultado) => aoConcluir?.(resultado),
  });
}
