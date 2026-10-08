import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { ClienteEscolhido } from "@/components/shared/seletor-cliente";
import { useMesasEstado, usePedidoMutations } from "@/hooks/use-pedidos";
import { useEmpresaAtual } from "@/providers/empresa";

import { useCarrinho } from "./use-carrinho";

export type ModoDestino = "BALCAO" | "MESA" | "COMANDA";

export function useNovoPedido(comandaInicial: string | null) {
  const { papel } = useEmpresaAtual();
  const carrinho = useCarrinho();
  const mesas = useMesasEstado();
  const { criar } = usePedidoMutations();

  const [modo, setModo] = useState<ModoDestino>(comandaInicial ? "MESA" : "BALCAO");
  const [comandaId, setComandaId] = useState(comandaInicial ?? "");
  const [desconto, setDesconto] = useState<number | "">("");
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null);

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

  /** Começa do zero; com `comanda`, já aponta o pedido para ela. */
  const reiniciar = (comanda: string | null = null) => {
    carrinho.limpar();
    setDesconto("");
    setCliente(null);
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
        desconto: valorDesconto,
        requisicaoId: carrinho.requisicaoId,
        itens: carrinho.itens.map((i) => ({
          produtoId: i.produto.id,
          quantidade: i.quantidade,
          observacoes: i.observacoes,
          adicionais: i.adicionais.map((a) => a.id),
        })),
        resumo: {
          destino: destino?.nome ?? "Balcão",
          itens: carrinho.itens.map((i) => ({ nome: i.produto.nome, quantidade: i.quantidade })),
          totalPrevisto: total,
        },
      },
      {
        onSuccess: (pedidoId) => {
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
    desconto,
    podeDescontar,
    valorDesconto,
    total,
    enviando: criar.isPending,
    mudarModo,
    escolherComanda,
    escolherCliente,
    mudarDesconto,
    reiniciar,
    enviar,
  };
}

export type NovoPedido = ReturnType<typeof useNovoPedido>;
