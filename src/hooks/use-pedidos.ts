import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

import { chaves } from "@/lib/chaves";
import { ErroDeRegra } from "@/lib/erros";
import { estadoConexao } from "@/lib/offline/conectividade";
import {
  aberturaDaComandaLocal,
  ehComandaLocal,
  ehFalhaDeRede,
  enfileirarAbertura,
  enfileirarPedido,
  idComandaLocal,
  type AcaoAbertura,
  type ResumoPedido,
} from "@/lib/offline/fila";
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

/**
 * Estado das mesas. Mesas abertas neste aparelho sem conexão aparecem como
 * ocupadas, com `aberturaPendente`, enquanto o servidor ainda as vê livres.
 * O dado do servidor nunca é alterado: a sobreposição existe só na tela.
 */
export function useMesasEstado() {
  const { empresa } = useEmpresaAtual();
  const { acoes } = useFilaOffline();

  const aberturas = useMemo(
    () =>
      acoes.filter(
        (a): a is AcaoAbertura => a.tipo === "abrir_comanda" && a.estado !== "sincronizado",
      ),
    [acoes],
  );

  const sobrepor = useCallback(
    (mesas: servico.MesaEstado[]) => {
      if (aberturas.length === 0) return mesas;
      return mesas.map((mesa) => {
        const abertura = aberturas.find((a) => a.entrada.mesaId === mesa.id);
        if (!abertura || mesa.status !== "LIVRE") return mesa;
        return {
          ...mesa,
          status: "OCUPADA" as const,
          comandaId: idComandaLocal(abertura.id),
          pessoas: abertura.entrada.pessoas,
          abertaEm: new Date(abertura.criadoEm).toISOString(),
          aberturaPendente: true,
        };
      });
    },
    [aberturas],
  );

  return useQuery({
    queryKey: chaves.mesasEstado(empresa.id),
    queryFn: () => servico.listarMesasEstado(empresa.id),
    refetchInterval: INTERVALO_RESERVA_MS,
    select: sobrepor,
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
    enabled: !!comandaId && !ehComandaLocal(comandaId),
  });
}

export function usePedidosDaComanda(comandaId: string | null) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.pedidosDaComanda(empresa.id, comandaId ?? ""),
    queryFn: () => servico.listarPedidosDaComanda(empresa.id, comandaId ?? ""),
    enabled: !!comandaId && !ehComandaLocal(comandaId),
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
  const { usuario } = useAuth();
  const fila = useFilaOffline();
  const invalidar = [chaves.salao(empresa.id)];

  /**
   * Sem conexão, a abertura vai para a fila e a resposta é um id provisório
   * (`local:...`): a comanda só ganha id e número quando o servidor aceitar.
   * Se outro aparelho abrir a mesa antes, a abertura vira conflito no envio.
   */
  const abrir = useMutacao({
    executar: async (entrada: {
      mesaId: string;
      pessoas: number;
      requisicaoId: string;
      nomeMesa: string;
    }): Promise<string> => {
      const guardar = async () => {
        if (!usuario) throw new Error("Sessão não identificada");
        const jaPendente = fila.acoes.some(
          (a) =>
            a.tipo === "abrir_comanda" &&
            a.entrada.mesaId === entrada.mesaId &&
            a.estado !== "sincronizado",
        );
        if (jaPendente) {
          throw new ErroDeRegra(`A ${entrada.nomeMesa} já foi aberta neste aparelho.`);
        }
        await enfileirarAbertura({
          id: entrada.requisicaoId,
          usuarioId: usuario.id,
          empresaId: empresa.id,
          entrada: { mesaId: entrada.mesaId, pessoas: entrada.pessoas },
          resumo: { mesa: entrada.nomeMesa, pessoas: entrada.pessoas },
        });
        fila.recarregar();
        fila.sincronizar();
        return idComandaLocal(entrada.requisicaoId);
      };

      if (estadoConexao() === "OFFLINE" || !navigator.onLine) return guardar();
      try {
        return await servico.abrirComanda(empresa.id, entrada);
      } catch (erro) {
        if (ehFalhaDeRede(erro)) return guardar();
        throw erro;
      }
    },
    sucesso: (comandaId) =>
      ehComandaLocal(comandaId)
        ? "Sem conexão: mesa aberta neste aparelho. Será enviada quando a internet voltar."
        : "Comanda aberta.",
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
      const local = ehComandaLocal(entrada.comandaId) ? entrada.comandaId : null;
      const guardar = async () => {
        if (!usuario) throw new Error("Sessão não identificada");
        await enfileirarPedido({
          id: entrada.requisicaoId,
          usuarioId: usuario.id,
          empresaId: empresa.id,
          entrada: {
            comandaId: local ? null : entrada.comandaId,
            comandaLocal: local ? aberturaDaComandaLocal(local) : null,
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

      // Comanda aberta offline ainda não existe no servidor: o pedido espera a abertura.
      if (local || estadoConexao() === "OFFLINE" || !navigator.onLine) return guardar();
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
