import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { chaves } from "@/lib/chaves";
import { supabase } from "@/lib/supabase";
import { useEmpresaAtual } from "@/providers/empresa";
import * as servico from "@/services/pedidos";

import { useMutacao } from "./use-mutacao";

/** Reserva para quando o canal Realtime cair sem avisar. */
const INTERVALO_RESERVA_MS = 30_000;

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

/**
 * Invalida o cache do salão quando pedidos ou comandas da empresa mudam.
 * O filtro por empresa reduz o tráfego; quem garante o isolamento é a RLS,
 * que o Realtime aplica antes de entregar cada evento.
 */
export function useRealtimeSalao() {
  const { empresa } = useEmpresaAtual();
  const queryClient = useQueryClient();

  useEffect(() => {
    const filtro = `empresa_id=eq.${empresa.id}`;
    const invalidar = () => {
      void queryClient.invalidateQueries({ queryKey: chaves.salao(empresa.id) });
    };

    const canal = supabase
      .channel(`salao:${empresa.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: filtro },
        invalidar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comandas", filter: filtro },
        invalidar,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [empresa.id, queryClient]);
}

/**
 * A cozinha não lê a tabela de pedidos. Ela escuta `eventos_cozinha`, que só
 * carrega o id do pedido, e recarrega o painel pela função do banco.
 */
export function useRealtimeCozinha() {
  const { empresa } = useEmpresaAtual();
  const queryClient = useQueryClient();

  useEffect(() => {
    const canal = supabase
      .channel(`cozinha:${empresa.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "eventos_cozinha",
          filter: `empresa_id=eq.${empresa.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: chaves.painelCozinha(empresa.id) });
        },
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

export function useMesasEstado() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.mesasEstado(empresa.id),
    queryFn: () => servico.listarMesasEstado(empresa.id),
    refetchInterval: INTERVALO_RESERVA_MS,
  });
}

export function useComanda(comandaId: string | null) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.comanda(empresa.id, comandaId ?? ""),
    queryFn: () => servico.buscarComanda(empresa.id, comandaId ?? ""),
    enabled: !!comandaId,
  });
}

export function usePedidosDaComanda(comandaId: string | null) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.pedidosDaComanda(empresa.id, comandaId ?? ""),
    queryFn: () => servico.listarPedidosDaComanda(empresa.id, comandaId ?? ""),
    enabled: !!comandaId,
  });
}

export function usePainelCozinha() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.painelCozinha(empresa.id),
    queryFn: () => servico.listarPainelCozinha(empresa.id),
    refetchInterval: INTERVALO_RESERVA_MS,
  });
}

// ---------------------------------------------------------------------------
// Mutações
// ---------------------------------------------------------------------------

export function useComandaMutations() {
  const { empresa } = useEmpresaAtual();
  const invalidar = [chaves.salao(empresa.id)];

  const abrir = useMutacao({
    executar: (entrada: { mesaId: string; pessoas: number; requisicaoId: string }) =>
      servico.abrirComanda(empresa.id, entrada),
    sucesso: "Comanda aberta.",
    invalidar,
  });

  const pedirConta = useMutacao({
    executar: (comandaId: string) => servico.pedirConta(comandaId),
    sucesso: "Conta solicitada.",
    invalidar,
  });

  const transferir = useMutacao({
    executar: ({ comandaId, mesaDestinoId }: { comandaId: string; mesaDestinoId: string }) =>
      servico.transferirComanda(comandaId, mesaDestinoId),
    sucesso: "Comanda transferida.",
    invalidar,
  });

  const encerrar = useMutacao({
    executar: (comandaId: string) => servico.encerrarComanda(comandaId),
    sucesso: "Mesa liberada.",
    invalidar,
  });

  const cancelar = useMutacao({
    executar: ({ comandaId, motivo }: { comandaId: string; motivo: string }) =>
      servico.cancelarComanda(comandaId, motivo),
    sucesso: "Comanda cancelada.",
    invalidar: [...invalidar, chaves.painelCozinha(empresa.id)],
  });

  return { abrir, pedirConta, transferir, encerrar, cancelar };
}

export function usePedidoMutations() {
  const { empresa } = useEmpresaAtual();
  const invalidar = [chaves.salao(empresa.id), chaves.painelCozinha(empresa.id)];

  const criar = useMutacao({
    executar: (entrada: {
      comandaId: string | null;
      itens: servico.ItemNovo[];
      desconto: number;
      requisicaoId: string;
    }) => servico.criarPedido(empresa.id, entrada),
    invalidar,
  });

  const avancar = useMutacao({
    executar: ({ pedidoId, para }: { pedidoId: string; para: servico.StatusPedido }) =>
      servico.avancarStatusPedido(pedidoId, para),
    invalidar,
  });

  const cancelar = useMutacao({
    executar: ({ pedidoId, motivo }: { pedidoId: string; motivo: string }) =>
      servico.cancelarPedido(pedidoId, motivo),
    sucesso: "Pedido cancelado.",
    invalidar,
  });

  return { criar, avancar, cancelar };
}
