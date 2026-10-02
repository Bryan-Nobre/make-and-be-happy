import { useState } from "react";

import { novoUuid } from "@/lib/uuid";
import type { Produto } from "@/services/catalogo";

export type AdicionalEscolhido = { id: string; nome: string; preco: number };

export type ItemCarrinho = {
  chave: string;
  produto: Produto;
  quantidade: number;
  observacoes: string;
  adicionais: AdicionalEscolhido[];
};

/** Só para exibição: o banco recalcula tudo a partir do cadastro. */
export const totalDoItem = (i: ItemCarrinho) =>
  i.quantidade * (i.produto.preco + i.adicionais.reduce((soma, a) => soma + a.preco, 0));

/**
 * Itens do pedido em montagem. A `requisicaoId` é renovada a cada mudança:
 * repetir o envio do mesmo carrinho (clique duplo, rede instável) não cria
 * um segundo pedido.
 */
export function useCarrinho() {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [requisicaoId, setRequisicaoId] = useState(() => novoUuid());

  const mudar = (mudanca: () => void) => {
    mudanca();
    setRequisicaoId(novoUuid());
  };

  const adicionar = (produto: Produto, adicionais: AdicionalEscolhido[] = [], observacoes = "") =>
    mudar(() =>
      setItens((atual) => {
        // Sem adicionais nem observação, o mesmo produto soma na linha existente.
        const igual =
          adicionais.length === 0 && !observacoes
            ? atual.find(
                (i) => i.produto.id === produto.id && !i.adicionais.length && !i.observacoes,
              )
            : undefined;
        if (igual) {
          return atual.map((i) =>
            i.chave === igual.chave ? { ...i, quantidade: i.quantidade + 1 } : i,
          );
        }
        return [...atual, { chave: novoUuid(), produto, quantidade: 1, observacoes, adicionais }];
      }),
    );

  const alterarQuantidade = (chave: string, delta: number) =>
    mudar(() =>
      setItens((atual) =>
        atual.map((i) =>
          i.chave === chave ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i,
        ),
      ),
    );

  const definirObservacao = (chave: string, observacoes: string) =>
    mudar(() =>
      setItens((atual) =>
        atual.map((i) => (i.chave === chave ? { ...i, observacoes: observacoes.trim() } : i)),
      ),
    );

  const remover = (chave: string) =>
    mudar(() => setItens((atual) => atual.filter((i) => i.chave !== chave)));

  /** Tira uma unidade da linha mais recente do produto, removendo-a se zerar. */
  const diminuirProduto = (produtoId: string) =>
    mudar(() =>
      setItens((atual) => {
        const linha = [...atual].reverse().find((i) => i.produto.id === produtoId);
        if (!linha) return atual;
        return linha.quantidade > 1
          ? atual.map((i) => (i.chave === linha.chave ? { ...i, quantidade: i.quantidade - 1 } : i))
          : atual.filter((i) => i.chave !== linha.chave);
      }),
    );

  const limpar = () => {
    setItens([]);
    setRequisicaoId(novoUuid());
  };

  const quantidadeDoProduto = (produtoId: string) =>
    itens.reduce((soma, i) => (i.produto.id === produtoId ? soma + i.quantidade : soma), 0);

  return {
    itens,
    requisicaoId,
    subtotal: itens.reduce((soma, i) => soma + totalDoItem(i), 0),
    quantidadeTotal: itens.reduce((soma, i) => soma + i.quantidade, 0),
    mudar,
    adicionar,
    alterarQuantidade,
    definirObservacao,
    remover,
    diminuirProduto,
    limpar,
    quantidadeDoProduto,
  };
}

export type Carrinho = ReturnType<typeof useCarrinho>;
