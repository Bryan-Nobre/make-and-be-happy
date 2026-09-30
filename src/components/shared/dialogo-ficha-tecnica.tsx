import { Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useEstoqueMutations, useFichaTecnica, useItensEstoque } from "@/hooks/use-estoque";
import { UNIDADE_LABEL, type InsumoFicha, type ItemEstoque } from "@/services/estoque";

type Alvo = { id: string; nome: string };

/** Insumos consumidos por unidade vendida; a baixa acontece no banco quando o pedido é confirmado. */
export function DialogoFichaTecnica({
  produto,
  aoFechar,
}: {
  produto: Alvo | null;
  aoFechar: () => void;
}) {
  return (
    <Dialog open={!!produto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ficha técnica: {produto?.nome}</DialogTitle>
          <DialogDescription>
            Quanto de cada insumo sai do estoque a cada unidade vendida. Sem ficha, o produto não
            baixa estoque. Mudanças valem para os próximos itens enviados à produção; insumo
            desativado bloqueia a venda.
          </DialogDescription>
        </DialogHeader>
        {produto && <Carregador produto={produto} aoFechar={aoFechar} />}
      </DialogContent>
    </Dialog>
  );
}

function Carregador({ produto, aoFechar }: { produto: Alvo; aoFechar: () => void }) {
  const ficha = useFichaTecnica(produto.id);
  const itens = useItensEstoque();

  if (ficha.isPending || itens.isPending) return <LoadingState label="Carregando ficha…" />;
  if (ficha.isError || itens.isError) {
    return (
      <ErrorState
        description="Não foi possível carregar a ficha técnica."
        onRetry={() => {
          void ficha.refetch();
          void itens.refetch();
        }}
      />
    );
  }

  return (
    <Formulario
      produtoId={produto.id}
      inicial={ficha.data}
      itens={itens.data}
      aoFechar={aoFechar}
    />
  );
}

function Formulario({
  produtoId,
  inicial,
  itens,
  aoFechar,
}: {
  produtoId: string;
  inicial: InsumoFicha[];
  itens: ItemEstoque[];
  aoFechar: () => void;
}) {
  const { definirFicha } = useEstoqueMutations();
  const [linhas, setLinhas] = useState<InsumoFicha[]>(inicial);

  const porId = new Map(itens.map((i) => [i.id, i]));
  const disponiveis = itens.filter((i) => i.ativo || linhas.some((l) => l.itemId === i.id));
  const livres = disponiveis.filter((i) => !linhas.some((l) => l.itemId === i.id));
  const valido = linhas.every((l) => l.itemId && l.quantidade > 0);

  const alterar = (indice: number, parcial: Partial<InsumoFicha>) =>
    setLinhas((atual) => atual.map((l, i) => (i === indice ? { ...l, ...parcial } : l)));

  if (itens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum item de estoque cadastrado.{" "}
        <Link to="/estoque" className="font-medium text-primary underline">
          Cadastre os insumos no Estoque
        </Link>{" "}
        para montar a ficha.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {linhas.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum insumo na ficha.</p>
        )}
        {linhas.map((linha, indice) => (
          <div key={linha.itemId || `nova-${indice}`} className="flex items-center gap-2">
            <select
              aria-label="Insumo"
              className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
              value={linha.itemId}
              onChange={(e) => alterar(indice, { itemId: e.target.value })}
            >
              <option value="" disabled>
                Escolha o insumo
              </option>
              {disponiveis
                .filter((i) => i.id === linha.itemId || !linhas.some((l) => l.itemId === i.id))
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                    {i.ativo ? "" : " (desativado)"}
                  </option>
                ))}
            </select>
            <Input
              aria-label="Quantidade por unidade vendida"
              className="w-28"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              value={linha.quantidade === 0 ? "" : linha.quantidade}
              placeholder="0"
              onChange={(e) => alterar(indice, { quantidade: Number(e.target.value) })}
            />
            <span className="w-8 text-sm text-muted-foreground">
              {UNIDADE_LABEL[porId.get(linha.itemId)?.unidade ?? "UN"]}
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Remover insumo"
              onClick={() => setLinhas((atual) => atual.filter((_, i) => i !== indice))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={livres.length === 0}
          onClick={() => setLinhas((atual) => [...atual, { itemId: "", quantidade: 0 }])}
        >
          <Plus className="size-4" /> Adicionar insumo
        </Button>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button
          disabled={!valido || definirFicha.isPending}
          onClick={() =>
            definirFicha.mutate({ produtoId, insumos: linhas }, { onSuccess: aoFechar })
          }
        >
          {definirFicha.isPending ? "Salvando…" : "Salvar ficha"}
        </Button>
      </DialogFooter>
    </>
  );
}
