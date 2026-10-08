import { CloudOff, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { useConfirmacao } from "@/components/shared/confirmacao";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { brl, time } from "@/lib/format";
import { useConexao } from "@/lib/offline/conectividade";
import type { AcaoOffline, EstadoAcao } from "@/lib/offline/fila";
import { cn } from "@/lib/utils";
import { useFilaOffline } from "@/providers/fila-offline";

const ESTADO: Record<EstadoAcao, { rotulo: string; tom: Tone }> = {
  pendente: { rotulo: "Pendente", tom: "neutral" },
  sincronizando: { rotulo: "Sincronizando", tom: "info" },
  sincronizado: { rotulo: "Sincronizado", tom: "success" },
  erro: { rotulo: "Erro", tom: "danger" },
  conflito: { rotulo: "Conflito", tom: "warning" },
};

/** Botão no header com as ações feitas offline. Só aparece quando há alguma. */
export function PainelPendencias() {
  const fila = useFilaOffline();
  const conexao = useConexao();
  const { confirmar, dialogo } = useConfirmacao();

  if (fila.acoes.length === 0) return null;

  const descartar = (acao: AcaoOffline) =>
    confirmar({
      titulo: "Descartar este pedido?",
      descricao:
        "Ele ainda não foi enviado ao servidor e será apagado deste aparelho. Esta ação não pode ser desfeita.",
      acao: "Descartar",
      aoConfirmar: () => fila.descartar(acao.id),
    });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 gap-1.5 rounded-full px-2.5 text-xs",
            fila.comProblema > 0 && "border-destructive/40 text-destructive",
          )}
        >
          {fila.sincronizando ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <CloudOff className="size-3.5" aria-hidden="true" />
          )}
          {fila.pendentes > 0
            ? `${fila.pendentes} pendente${fila.pendentes > 1 ? "s" : ""}`
            : "Sincronizado"}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Pendências offline</SheetTitle>
          <SheetDescription>
            Pedidos feitos sem conexão. Só valem depois que o servidor aceita: preço, estoque e
            comanda são conferidos no envio.
          </SheetDescription>
        </SheetHeader>

        <ul className="flex-1 divide-y overflow-y-auto">
          {fila.acoes.map((acao) => {
            const estado = ESTADO[acao.estado];
            const podeAgir = acao.estado === "erro" || acao.estado === "conflito";
            return (
              <li key={acao.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{acao.resumo.destino}</p>
                    <p className="text-xs text-muted-foreground">
                      Feito às {time(new Date(acao.criadoEm).toISOString())} · previsto{" "}
                      {brl(acao.resumo.totalPrevisto)}
                    </p>
                  </div>
                  <StatusBadge tone={estado.tom}>{estado.rotulo}</StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {acao.resumo.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", ")}
                </p>
                {acao.erro && (
                  <p className="rounded-md bg-destructive-soft px-2.5 py-1.5 text-xs text-destructive">
                    {acao.erro}
                  </p>
                )}
                {(podeAgir || acao.estado === "pendente") && (
                  <div className="flex gap-2">
                    {podeAgir && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fila.tentarDeNovo(acao.id)}
                      >
                        <RefreshCw aria-hidden="true" />
                        Tentar de novo
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => descartar(acao)}>
                      <Trash2 aria-hidden="true" />
                      Descartar
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="border-t p-4">
          <Button
            className="w-full"
            disabled={conexao !== "ONLINE" || fila.sincronizando || fila.pendentes === 0}
            onClick={fila.sincronizar}
          >
            {fila.sincronizando ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            {conexao === "ONLINE" ? "Sincronizar agora" : "Aguardando conexão"}
          </Button>
        </div>
        {dialogo}
      </SheetContent>
    </Sheet>
  );
}
