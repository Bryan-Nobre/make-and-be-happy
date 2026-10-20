import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DialogoCadastroRapidoInsumo } from "@/components/estoque/dialogo-cadastro-rapido-insumo";
import { LeitorCodigo } from "@/components/estoque/leitor-codigo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEstoqueMutations } from "@/hooks/use-estoque";
import { novoUuid } from "@/lib/uuid";
import {
  buscarItemPorCodigo,
  formatarQuantidade,
  type ItemEstoque,
  type LinhaSessaoBipagem,
  type TipoMovimentacaoEstoque,
  UNIDADE_LABEL,
} from "@/services/estoque";

type Props = {
  itens: ItemEstoque[];
  tipo: Extract<TipoMovimentacaoEstoque, "ENTRADA" | "SAIDA">;
  modoLeitura: "usb" | "camera";
  /** Sem card externo (uso dentro de dialog). */
  embutido?: boolean;
  onConcluido?: () => void;
};

export function SessaoBipagem({ itens, tipo, modoLeitura, embutido, onConcluido }: Props) {
  const { confirmarSessao } = useEstoqueMutations();
  const [linhas, setLinhas] = useState<LinhaSessaoBipagem[]>([]);
  const [codigoPendente, setCodigoPendente] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const adicionarItem = (item: ItemEstoque) => {
    setLinhas((atual) => {
      const existente = atual.find((l) => l.itemId === item.id);
      if (existente) {
        const novaQtd = existente.quantidade + 1;
        toast.message(`${item.nome}: quantidade ${novaQtd}`);
        return atual.map((l) => (l.itemId === item.id ? { ...l, quantidade: novaQtd } : l));
      }
      toast.success(`${item.nome} na lista`);
      return [
        {
          itemId: item.id,
          codigo: item.codigo,
          nome: item.nome,
          unidade: item.unidade,
          quantidade: 1,
          saldoAtual: item.quantidade,
        },
        ...atual,
      ];
    });
  };

  const aoCodigo = (codigo: string) => {
    const item = buscarItemPorCodigo(itens, codigo);
    if (!item) {
      if (tipo === "SAIDA") {
        toast.error("Código não cadastrado. Cadastre o insumo antes de dar saída.");
        return;
      }
      setCodigoPendente(codigo);
      toast.message("Código novo — cadastre o insumo");
      return;
    }
    if (tipo === "SAIDA" && item.quantidade <= 0) {
      toast.error(`${item.nome} está sem estoque.`);
      return;
    }
    adicionarItem(item);
  };

  const alterarQtd = (itemId: string, quantidade: number) => {
    setLinhas((atual) =>
      atual.map((l) =>
        l.itemId === itemId ? { ...l, quantidade: Number.isFinite(quantidade) ? quantidade : 0 } : l,
      ),
    );
  };

  const confirmar = () => {
    const validas = linhas.filter((l) => l.quantidade > 0);
    if (validas.length === 0) {
      toast.error("A lista está vazia.");
      return;
    }
    if (tipo === "SAIDA") {
      const excesso = validas.find((l) => l.quantidade > l.saldoAtual);
      if (excesso) {
        toast.error(
          `${excesso.nome}: saída maior que o saldo (${formatarQuantidade(excesso.saldoAtual, excesso.unidade)}).`,
        );
        return;
      }
    }

    const motivoFinal =
      motivo.trim() || (tipo === "ENTRADA" ? "Entrada por bipagem" : "Saída por bipagem");

    confirmarSessao.mutate(
      {
        tipo,
        motivo: motivoFinal,
        linhas: validas.map((l) => ({
          itemId: l.itemId,
          quantidade: l.quantidade,
          requisicaoId: novoUuid(),
        })),
      },
      {
        onSuccess: () => {
          setLinhas([]);
          onConcluido?.();
        },
      },
    );
  };

  const corpo = (
    <div className="space-y-4">
      <LeitorCodigo
        onCodigo={aoCodigo}
        desabilitado={confirmarSessao.isPending}
        modo={modoLeitura}
      />

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          Nenhum item bipado ainda.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {linhas.map((l) => (
            <li key={l.itemId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{l.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {l.codigo || "sem código"} · saldo{" "}
                  {formatarQuantidade(l.saldoAtual, l.unidade)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label className="sr-only" htmlFor={`qtd-${l.itemId}`}>
                  Quantidade {l.nome}
                </Label>
                <Input
                  id={`qtd-${l.itemId}`}
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0"
                  className="w-24 text-right tabular-nums"
                  value={l.quantidade === 0 ? "" : l.quantidade}
                  onChange={(e) => alterarQtd(l.itemId, Number(e.target.value))}
                />
                <span className="w-8 text-xs text-muted-foreground">{UNIDADE_LABEL[l.unidade]}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground"
                  onClick={() => setLinhas((a) => a.filter((x) => x.itemId !== l.itemId))}
                  aria-label={`Remover ${l.nome}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="sessao-motivo">Motivo (opcional)</Label>
        <Input
          id="sessao-motivo"
          value={motivo}
          maxLength={200}
          placeholder={tipo === "ENTRADA" ? "Ex.: compra do dia" : "Ex.: uso na cozinha"}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={linhas.length === 0}
          onClick={() => setLinhas([])}
        >
          Limpar lista
        </Button>
        <Button
          type="button"
          disabled={linhas.length === 0 || confirmarSessao.isPending}
          onClick={confirmar}
        >
          {confirmarSessao.isPending ? "Registrando…" : "Confirmar"}
        </Button>
      </div>

      <DialogoCadastroRapidoInsumo
        codigo={codigoPendente}
        onFechar={() => setCodigoPendente(null)}
        onCriado={(item) => adicionarItem(item)}
      />
    </div>
  );

  if (embutido) return corpo;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-xs">{corpo}</div>
  );
}
