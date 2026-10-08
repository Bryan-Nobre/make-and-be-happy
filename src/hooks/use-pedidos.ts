import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { chaves } from "@/lib/chaves";
import { estadoConexao } from "@/lib/offline/conectividade";
import { ehFalhaDeRede, enfileirarPedido, type ResumoPedido } from "@/lib/offline/fila";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";
import { useEmpresaAtual } from "@/providers/empresa";
import { useFilaOffline } from "@/providers/fila-offline";
import * as servico from "@/services/pedidos";
import { dataNoFuso, limitesDoPeriodo } from "@/services/relatorios";

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

export function usePedidosDoDia() {
  const { empresa } = useEmpresaAtual();
  const hoje = dataNoFuso();

  return useQuery({
    queryKey: [...chaves.salao(empresa.id), "pedidos-do-dia", hoje],
    queryFn: () =>
      servico.listarPedidosDesde(empresa.id, limitesDoPeriodo({ inicio: hoje, fim: hoje }).de),
    refetchInterval: INTERVALO_RESERVA_MS,
  });
}

export function usePedido(pedidoId: string | null) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: [...chaves.salao(empresa.id), "pedido", pedidoId ?? ""],
    queryFn: () => servico.buscarPedido(empresa.id, pedidoId ?? ""),
    enabled: !!pedidoId,
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

export function usePainelCozinha(setorId?: string | null) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: [...chaves.painelCozinha(empresa.id), setorId ?? "todos"],
    queryFn: () => servico.listarPainelCozinha(empresa.id, setorId),
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

  const reabrir = useMutacao({
    executar: (comandaId: string) => servico.reabrirComanda(comandaId),
    sucesso: "Comanda reaberta.",
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
    invalidar: [...invalidar, chaves.painelCozinha(empresa.id), chaves.estoque(empresa.id)],
  });

  const definirCliente = useMutacao({
    executar: ({ comandaId, clienteId }: { comandaId: string; clienteId: string | null }) =>
      servico.definirClienteComanda(comandaId, clienteId),
    sucesso: (_, { clienteId }) => (clienteId ? "Cliente vinculado." : "Cliente removido."),
    invalidar: [...invalidar, chaves.clientes(empresa.id)],
  });

  return { abrir, pedirConta, reabrir, transferir, encerrar, cancelar, definirCliente };
}

export function usePedidoMutations() {
  const { empresa } = useEmpresaAtual();
  const { usuario } = useAuth();
  const fila = useFilaOffline();
  // Confirmar, alterar e cancelar pedidos baixa ou devolve estoque no banco.
  const invalidar = [
    chaves.salao(empresa.id),
    chaves.painelCozinha(empresa.id),
    chaves.estoque(empresa.id),
    chaves.dashboard(empresa.id),
    chaves.clientes(empresa.id),
  ];

  /**
   * Sem conexão, o pedido vai para a fila do aparelho e a resposta é `null`:
   * ele ainda não existe no servidor. Uma falha de rede no envio também
   * enfileira; como a fila reenvia o mesmo `requisicaoId`, se o servidor tiver
   * recebido a primeira tentativa, o pedido não é duplicado.
   */
  const criar = useMutacao({
    executar: async (entrada: {
      comandaId: string | null;
      clienteId?: string | null;
      itens: servico.ItemNovo[];
      desconto: number;
      requisicaoId: string;
      resumo: ResumoPedido;
    }): Promise<string | null> => {
      const guardar = async () => {
        if (!usuario) throw new Error("Sessão não identificada");
        await enfileirarPedido({
          id: entrada.requisicaoId,
          usuarioId: usuario.id,
          empresaId: empresa.id,
          entrada: {
            comandaId: entrada.comandaId,
            clienteId: entrada.clienteId ?? null,
            itens: entrada.itens,
            desconto: entrada.desconto,
          },
          resumo: entrada.resumo,
        });
        fila.recarregar();
        fila.sincronizar();
        return null;
      };

      if (estadoConexao() === "OFFLINE" || !navigator.onLine) return guardar();
      try {
        return await servico.criarPedido(empresa.id, entrada);
      } catch (erro) {
        if (ehFalhaDeRede(erro)) return guardar();
        throw erro;
      }
    },
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
