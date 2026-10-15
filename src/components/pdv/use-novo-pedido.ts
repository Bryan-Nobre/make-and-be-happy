import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { ClienteEscolhido } from "@/components/shared/seletor-cliente";
import { useMesasEstado, usePedidoMutations } from "@/hooks/use-pedidos";
import { registrarMaisPedidos } from "@/lib/pdv/mais-pedidos";
import { useAuth } from "@/providers/auth";
import { useEmpresaAtual } from "@/providers/empresa";

import { useCarrinho } from "./use-carrinho";

export type ModoDestino = "BALCAO" | "MESA" | "COMANDA";

/** Mesmo limite da constraint `pedidos_identificacao_tamanho`. */
export const TAMANHO_IDENTIFICACAO = 40;

export function useNovoPedido(comandaInicial: string | null) {
  const { empresa, papel } = useEmpresaAtual();
  const { usuario } = useAuth();
  const carrinho = useCarrinho();
  const mesas = useMesasEstado();
  const { criar } = usePedidoMutations();

  const [modo, setModo] = useState<ModoDestino>(comandaInicial ? "MESA" : "BALCAO");
  const [comandaId, setComandaId] = useState(comandaInicial ?? "");
  const [desconto, setDesconto] = useState<number | "">("");
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null);
  const [identificacao, setIdentificacao] = useState("");

  // Nota: controla apenas a interface. Quem pode conceder desconto é decidido
  // pela função `criar_pedido` no banco.
  const podeDescontar = papel === "owner" || papel === "admin" || papel === "cashier";

  const mesasComComanda = useMemo(
    () => (mesas.data ?? []).filter((m) => m.status === "OCUPADA" && m.comandaId),
    [mesas.data],
  );
  const destino =
    modo === "BALCAO" ? null : (mesasComComanda.find((m) => m.comandaId === comandaId) ?? null);

  const valorDesconto = podeDescontar ? Number(desconto || 0) : 0;
  const total = Math.max(0, carrinho.subtotal - valorDesconto);
  /** Mesa ou comanda escolhida como modo, mas ainda sem uma comanda válida. */
  const faltaDestino = modo !== "BALCAO" && !destino;

  const mudarModo = (novo: ModoDestino) =>
    carrinho.mudar(() => {
      setModo(novo);
      if (novo === "BALCAO") setComandaId("");
    });

  const escolherComanda = (id: string) =>
    carrinho.mudar(() => {
      setComandaId(id);
      if (id) setCliente(null);
    });

  const escolherCliente = (escolhido: ClienteEscolhido | null) =>
    carrinho.mudar(() => setCliente(escolhido));

  const mudarDesconto = (valor: number | "") => carrinho.mudar(() => setDesconto(valor));

  const mudarIdentificacao = (valor: string) =>
    carrinho.mudar(() => setIdentificacao(valor.slice(0, TAMANHO_IDENTIFICACAO)));

  /** Começa do zero; com `comanda`, já aponta o pedido para ela. */
  const reiniciar = (comanda: string | null = null) => {
    carrinho.limpar();
    setDesconto("");
    setCliente(null);
    setIdentificacao("");
    setComandaId(comanda ?? "");
    setModo(comanda ? "MESA" : "BALCAO");
  };

  const enviar = (aoEnviar: (pedidoId: string) => void) => {
    if (faltaDestino) {
      toast.error("Escolha a mesa ou a comanda do pedido.");
      return;
    }
    criar.mutate(
      {
        comandaId: destino?.comandaId ?? null,
        clienteId: destino ? null : (cliente?.id ?? null),
        identificacao: destino ? null : identificacao.trim() || null,
        desconto: valorDesconto,
        requisicaoId: carrinho.requisicaoId,
        itens: carrinho.itens.map((i) => ({
          produtoId: i.produto.id,
          quantidade: i.quantidade,
          observacoes: i.observacoes,
          adicionais: i.adicionais.map((a) => a.id),
        })),
        resumo: {
          destino:
            destino?.nome ?? (identificacao.trim() ? `Balcão · ${identificacao.trim()}` : "Balcão"),
          itens: carrinho.itens.map((i) => ({ nome: i.produto.nome, quantidade: i.quantidade })),
          totalPrevisto: total,
        },
      },
      {
        onSuccess: (pedidoId) => {
          if (usuario) {
            registrarMaisPedidos(
              usuario.id,
              empresa.id,
              carrinho.itens.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
            );
          }
          reiniciar();
          if (pedidoId === null) {
            toast.warning("Sem conexão: pedido salvo no aparelho.", {
              description:
                "Ele será enviado sozinho quando a internet voltar. Cozinha e pagamento só depois disso.",
            });
            return;
          }
          toast.success(
            destino ? `Pedido lançado na ${destino.nome}.` : "Pedido enviado para a cozinha.",
          );
          aoEnviar(pedidoId);
        },
      },
    );
  };

  return {
    carrinho,
    mesas,
    mesasComComanda,
    modo,
    comandaId,
    destino,
    faltaDestino,
    cliente,
    identificacao,
    desconto,
    podeDescontar,
    valorDesconto,
    total,
    enviando: criar.isPending,
    mudarModo,
    escolherComanda,
    escolherCliente,
    mudarDesconto,
    mudarIdentificacao,
    reiniciar,
    enviar,
  };
}

export type NovoPedido = ReturnType<typeof useNovoPedido>;
