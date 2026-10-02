import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GrupoAdicional, Produto } from "@/services/catalogo";

import type { AdicionalEscolhido } from "./use-carrinho";

export function DialogoAdicionais({
  produto,
  grupos,
  aoFechar,
  aoAdicionar,
}: {
  produto: Produto | null;
  grupos: GrupoAdicional[];
  aoFechar: () => void;
  aoAdicionar: (adicionais: AdicionalEscolhido[], observacoes: string) => void;
}) {
  const [selecao, setSelecao] = useState<Record<string, string[]>>({});
  const [observacoes, setObservacoes] = useState("");

  const alternar = (grupo: GrupoAdicional, opcaoId: string) =>
    setSelecao((atual) => {
      const marcadas = atual[grupo.id] ?? [];
      if (marcadas.includes(opcaoId)) {
        return { ...atual, [grupo.id]: marcadas.filter((x) => x !== opcaoId) };
      }
      if (marcadas.length >= grupo.maximo) {
        return grupo.maximo === 1 ? { ...atual, [grupo.id]: [opcaoId] } : atual;
      }
      return { ...atual, [grupo.id]: [...marcadas, opcaoId] };
    });

  const confirmar = () => {
    const faltando = grupos.find((g) => (selecao[g.id]?.length ?? 0) < g.minimo);
    if (faltando) {
      toast.error(
        faltando.minimo === 1
          ? `Escolha uma opção em "${faltando.nome}".`
          : `Escolha pelo menos ${faltando.minimo} opções em "${faltando.nome}".`,
      );
      return;
    }
    const adicionais = grupos.flatMap((g) =>
      g.opcoes
        .filter((o) => selecao[g.id]?.includes(o.id))
        .map((o) => ({ id: o.id, nome: o.nome, preco: o.preco })),
    );
    aoAdicionar(adicionais, observacoes.trim());
  };

  return (
    <Dialog open={!!produto} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{produto?.nome}</DialogTitle>
          <DialogDescription>Escolha os adicionais do item.</DialogDescription>
        </DialogHeader>
        {grupos.map((g) => (
          <fieldset key={g.id} className="space-y-2">
            <legend className="text-sm font-semibold">
              {g.nome}{" "}
              <span className="font-normal text-muted-foreground">
                {g.minimo > 0 ? "(obrigatório)" : `(até ${g.maximo})`}
              </span>
            </legend>
            {g.opcoes.map((o) => {
              const marcada = selecao[g.id]?.includes(o.id) ?? false;
              return (
                <label
                  key={o.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm",
                    marcada && "border-primary bg-primary-soft",
                  )}
                >
                  <Checkbox checked={marcada} onCheckedChange={() => alternar(g, o.id)} />
                  <span className="flex-1">{o.nome}</span>
                  {o.preco > 0 && (
                    <span className="text-muted-foreground tabular-nums">+ {brl(o.preco)}</span>
                  )}
                </label>
              );
            })}
          </fieldset>
        ))}
        <div className="space-y-1">
          <Label htmlFor="observacoes-item">Observação</Label>
          <Textarea
            id="observacoes-item"
            value={observacoes}
            maxLength={200}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex.: sem cebola"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={confirmar}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
