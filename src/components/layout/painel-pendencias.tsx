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
import { dependentesDe, type AcaoOffline, type EstadoAcao } from "@/lib/offline/fila";
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

  const descartar = (acao: AcaoOffline) => {
    const dependentes =
      acao.tipo === "abrir_comanda" ? dependentesDe(fila.acoes, acao.id).length : 0;
    confirmar({
      titulo: {
        abrir_comanda: "Descartar a abertura da mesa?",
        criar_pedido: "Descartar este pedido?",
        pedir_conta: "Descartar o pedido de conta?",
      }[acao.tipo],
      descricao:
        dependentes > 0
          ? `${dependentes === 1 ? "A ação feita" : `As ${dependentes} ações feitas`} nesta mesa também ${dependentes === 1 ? "será apagada" : "serão apagadas"} deste aparelho. Esta ação não pode ser desfeita.`
          : "Ainda não foi enviado ao servidor e será apagado deste aparelho. Esta ação não pode ser desfeita.",
      acao: "Descartar",
      aoConfirmar: () => fila.descartar(acao.id),
    });
  };

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
          {fila.pendentes > 0 ? (
            <>
              <span className="tabular-nums">{fila.pendentes}</span>
              <span className="hidden sm:inline"> pendente{fila.pendentes > 1 ? "s" : ""}</span>
            </>
          ) : (
            <span className="hidden sm:inline">Sincronizado</span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Pendências offline</SheetTitle>
          <SheetDescription>
            Ações feitas sem conexão. Só valem depois que o servidor aceita: mesa, preço, estoque e
            comanda são conferidos no envio.
          </SheetDescription>
        </SheetHeader>

        <ul className="flex-1 divide-y overflow-y-auto">
          {fila.acoes.map((acao) => {
            const estado = ESTADO[acao.estado];
            const podeAgir = acao.estado === "erro" || acao.estado === "conflito";
            const horario = time(new Date(acao.criadoEm).toISOString());
            const ehAbertura = acao.tipo === "abrir_comanda";
            // Ação presa a uma abertura em conflito: a decisão é tomada na abertura.
            const esperaAbertura =
              acao.tipo !== "abrir_comanda" &&
              !!acao.entrada.comandaLocal &&
              fila.acoes.some((a) => a.id === acao.entrada.comandaLocal);
            return (
              <li key={acao.id} className={cn("space-y-2 p-4", esperaAbertura && "pl-8")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {acao.tipo === "abrir_comanda" ? (
                      <>
                        <p className="truncate text-sm font-semibold">Abrir {acao.resumo.mesa}</p>
                        <p className="text-xs text-muted-foreground">
                          Feito às {horario} · {acao.resumo.pessoas} pessoa
                          {acao.resumo.pessoas > 1 ? "s" : ""}
                        </p>
                      </>
                    ) : acao.tipo === "pedir_conta" ? (
                      <>
                        <p className="truncate text-sm font-semibold">
                          Pedir conta · {acao.resumo.mesa}
                        </p>
                        <p className="text-xs text-muted-foreground">Feito às {horario}</p>
                      </>
                    ) : (
                      <>
                        <p className="truncate text-sm font-semibold">{acao.resumo.destino}</p>
                        <p className="text-xs text-muted-foreground">
                          Feito às {horario} · previsto {brl(acao.resumo.totalPrevisto)}
                        </p>
                      </>
                    )}
                  </div>
                  <StatusBadge tone={estado.tom}>{estado.rotulo}</StatusBadge>
                </div>
                {acao.tipo === "criar_pedido" && (
                  <p className="text-xs text-muted-foreground">
                    {acao.resumo.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", ")}
                  </p>
                )}
                {acao.erro && (
                  <p className="rounded-md bg-destructive-soft px-2.5 py-1.5 text-xs text-destructive">
                    {acao.erro}
                  </p>
                )}
                {ehAbertura && acao.estado === "conflito" && (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={
                      conexao !== "ONLINE" || dependentesDe(fila.acoes, acao.id).length === 0
                    }
                    onClick={() => fila.relancarNaComandaAberta(acao.id)}
                  >
                    Lançar na comanda já aberta
                  </Button>
                )}
                {!esperaAbertura && (podeAgir || acao.estado === "pendente") && (
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
