import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useRegistrarPagamento } from "@/hooks/use-caixa";
import { useFormasPagamento } from "@/hooks/use-configuracoes";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AlvoPagamento, PartePagamento, ResultadoPagamento } from "@/services/caixa";
import { METODO_LABEL, type MetodoPagamento } from "@/services/configuracoes";

type Parte = {
  chave: string;
  metodo: MetodoPagamento;
  valor: number | "";
  recebido: number | "";
};

const centavos = (valor: number) => Math.round(valor * 100);

/**
 * Recebimento com uma ou mais formas de pagamento. O saldo exibido é só uma
 * prévia: o banco recalcula o devido, valida as formas e o troco, e só depois
 * da resposta dele o pagamento conta como feito.
 */
export function DialogoPagamento({
  aberto,
  aoMudarAberto,
  titulo,
  saldo,
  alvo,
  aoConcluir,
  aoDesistir,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  titulo: string;
  saldo: number;
  alvo: AlvoPagamento | null;
  aoConcluir?: (resultado: ResultadoPagamento) => void;
  /** Fechado sem registrar pagamento. */
  aoDesistir?: () => void;
}) {
  const desistir = () => {
    aoDesistir?.();
    aoMudarAberto(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => (abrir ? aoMudarAberto(true) : desistir())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>Saldo a receber: {brl(saldo)}</DialogDescription>
        </DialogHeader>
        {alvo && (
          <FormularioPagamento
            saldo={saldo}
            alvo={alvo}
            aoCancelar={desistir}
            aoConcluir={(resultado) => {
              aoMudarAberto(false);
              aoConcluir?.(resultado);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormularioPagamento({
  saldo,
  alvo,
  aoCancelar,
  aoConcluir,
}: {
  saldo: number;
  alvo: AlvoPagamento;
  aoCancelar: () => void;
  aoConcluir: (resultado: ResultadoPagamento) => void;
}) {
  const formas = useFormasPagamento();
  const ativas = (formas.data ?? []).filter((f) => f.ativa).map((f) => f.metodo);
  const registrar = useRegistrarPagamento(aoConcluir);

  // Uma chave por abertura do diálogo: se a resposta se perder e o operador
  // tentar de novo, o banco devolve o resultado do primeiro envio.
  const [requisicaoId] = useState(() => crypto.randomUUID());
  const [partes, setPartes] = useState<Parte[]>([]);

  const metodoInicial = ativas.includes("PIX") ? "PIX" : ativas[0];
  const lista: Parte[] =
    partes.length > 0 || !metodoInicial
      ? partes
      : [{ chave: "inicial", metodo: metodoInicial, valor: saldo, recebido: "" }];

  const somaCentavos = lista.reduce((soma, p) => soma + centavos(Number(p.valor || 0)), 0);
  const restante = (centavos(saldo) - somaCentavos) / 100;
  const troco = lista.reduce(
    (soma, p) =>
      p.metodo === "DINHEIRO" && p.recebido !== ""
        ? soma + Math.max(0, p.recebido - Number(p.valor || 0))
        : soma,
    0,
  );

  const atualizar = (chave: string, mudanca: Partial<Parte>) =>
    setPartes(lista.map((p) => (p.chave === chave ? { ...p, ...mudanca } : p)));

  const adicionar = () => {
    const usados = new Set(lista.map((p) => p.metodo));
    const metodo = ativas.find((m) => !usados.has(m)) ?? ativas[0];
    if (!metodo) return;
    setPartes([
      ...lista,
      { chave: crypto.randomUUID(), metodo, valor: Math.max(0, restante), recebido: "" },
    ]);
  };

  const remover = (chave: string) => setPartes(lista.filter((p) => p.chave !== chave));

  const problema = (() => {
    if (lista.length === 0) return "Nenhuma forma de pagamento está habilitada.";
    if (lista.some((p) => Number(p.valor || 0) <= 0)) return "Informe o valor de cada forma.";
    if (restante < 0) return "A soma passa do saldo a receber.";
    const dinheiroCurto = lista.some(
      (p) => p.metodo === "DINHEIRO" && p.recebido !== "" && p.recebido < Number(p.valor || 0),
    );
    if (dinheiroCurto) return "O valor recebido em dinheiro é menor que o valor da parte.";
    return null;
  })();

  const confirmar = () => {
    if (problema) return;
    const envio: PartePagamento[] = lista.map((p) => ({
      metodo: p.metodo,
      valor: centavos(Number(p.valor)) / 100,
      ...(p.metodo === "DINHEIRO" && p.recebido !== "" ? { valorRecebido: p.recebido } : {}),
    }));
    registrar.mutate({ alvo, partes: envio, requisicaoId });
  };

  if (formas.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando formas de pagamento…</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {lista.map((parte, indice) => (
          <li key={parte.chave} className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forma de pagamento">
              {ativas.map((metodo) => (
                <Button
                  key={metodo}
                  type="button"
                  size="sm"
                  variant="outline"
                  role="radio"
                  aria-checked={parte.metodo === metodo}
                  className={cn(
                    parte.metodo === metodo && "border-primary bg-primary-soft text-primary",
                  )}
                  onClick={() => atualizar(parte.chave, { metodo, recebido: "" })}
                >
                  {METODO_LABEL[metodo]}
                </Button>
              ))}
              {lista.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="ml-auto size-8"
                  aria-label={`Remover forma ${indice + 1}`}
                  onClick={() => remover(parte.chave)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`valor-${parte.chave}`}>Valor</Label>
                <MoneyInput
                  id={`valor-${parte.chave}`}
                  value={parte.valor}
                  onChange={(valor) => atualizar(parte.chave, { valor })}
                />
              </div>
              {parte.metodo === "DINHEIRO" && (
                <div className="space-y-1.5">
                  <Label htmlFor={`recebido-${parte.chave}`}>Valor entregue</Label>
                  <MoneyInput
                    id={`recebido-${parte.chave}`}
                    value={parte.recebido}
                    onChange={(recebido) => atualizar(parte.chave, { recebido })}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {ativas.length > 0 && restante > 0 && (
        <Button type="button" variant="outline" className="w-full" onClick={adicionar}>
          <Plus className="size-4" aria-hidden="true" /> Dividir em outra forma
        </Button>
      )}

      <dl className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Recebendo agora</dt>
          <dd className="tabular-nums font-medium">{brl(somaCentavos / 100)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Fica em aberto</dt>
          <dd className={cn("tabular-nums", restante < 0 && "text-destructive")}>
            {brl(restante)}
          </dd>
        </div>
        {troco > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Troco</dt>
            <dd className="tabular-nums font-semibold">{brl(troco)}</dd>
          </div>
        )}
      </dl>

      {problema && (
        <p className="text-sm text-destructive" role="alert">
          {problema}
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={aoCancelar} disabled={registrar.isPending}>
          Cancelar
        </Button>
        <Button onClick={confirmar} disabled={!!problema || registrar.isPending}>
          {registrar.isPending ? "Registrando…" : `Receber ${brl(somaCentavos / 100)}`}
        </Button>
      </DialogFooter>
    </div>
  );
}
