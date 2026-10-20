import { ArrowDownToLine, ArrowUpFromLine, History, Pencil, RefreshCw } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useMovimentacoesEstoque } from "@/hooks/use-estoque";
import { dateTime } from "@/lib/format";
import { STATUS_ESTOQUE, TIPO_MOVIMENTACAO_ESTOQUE } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  formatarNumeroQuantidade,
  formatarQuantidade,
  UNIDADE_LABEL,
  type ItemEstoque,
  type TipoMovimentacaoEstoque,
} from "@/services/estoque";

type Props = {
  item: ItemEstoque | null;
  onFechar: () => void;
  onEditar: (item: ItemEstoque) => void;
  onMovimentar: (item: ItemEstoque, tipo: TipoMovimentacaoEstoque) => void;
};

/** Ficha objetiva do insumo: resumo, ações rápidas e histórico recente. */
export function DialogoFichaItem({ item, onFechar, onEditar, onMovimentar }: Props) {
  const historico = useMovimentacoesEstoque(item?.id, 20);

  return (
    <Dialog open={!!item} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {item && (
          <>
            <DialogHeader className="space-y-2 border-b border-border px-5 py-4 text-left">
              <div className="flex items-start justify-between gap-3 pr-6">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg">{item.nome}</DialogTitle>
                  <DialogDescription className="mt-1 truncate">
                    {[item.codigo || null, item.categoria || null].filter(Boolean).join(" · ") ||
                      "Sem código / categoria"}
                  </DialogDescription>
                </div>
                <StatusBadge tone={STATUS_ESTOQUE[item.status].tone}>
                  {STATUS_ESTOQUE[item.status].label}
                </StatusBadge>
              </div>
            </DialogHeader>

            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-2 gap-2">
                <ResumoCard
                  rotulo="Saldo"
                  valor={formatarNumeroQuantidade(item.quantidade)}
                  dica={UNIDADE_LABEL[item.unidade]}
                />
                <ResumoCard
                  rotulo="Mínimo"
                  valor={formatarNumeroQuantidade(item.quantidadeMinima)}
                  dica={UNIDADE_LABEL[item.unidade]}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={!item.ativo}
                  onClick={() => onMovimentar(item, "ENTRADA")}
                >
                  <ArrowDownToLine className="size-3.5" aria-hidden="true" />
                  Entrada
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5"
                  disabled={!item.ativo}
                  onClick={() => onMovimentar(item, "SAIDA")}
                >
                  <ArrowUpFromLine className="size-3.5" aria-hidden="true" />
                  Saída
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5"
                  disabled={!item.ativo}
                  onClick={() => onMovimentar(item, "AJUSTE")}
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  Ajuste
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 gap-1.5"
                  onClick={() => onEditar(item)}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Editar
                </Button>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Histórico recente</h3>
                {historico.isPending ? (
                  <div className="space-y-2" aria-busy="true">
                    {[0, 1, 2].map((n) => (
                      <Skeleton key={n} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : historico.isError ? (
                  <p className="text-sm text-muted-foreground">Não foi possível carregar o histórico.</p>
                ) : (historico.data?.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={History}
                    title="Sem movimentações"
                    description="Entradas, saídas e ajustes deste item aparecem aqui."
                    className="py-8"
                  />
                ) : (
                  <ul className="space-y-2">
                    {historico.data.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <StatusBadge tone={TIPO_MOVIMENTACAO_ESTOQUE[m.tipo].tone}>
                            {m.origem === "PEDIDO"
                              ? m.variacao < 0
                                ? "Venda"
                                : "Devolução"
                              : TIPO_MOVIMENTACAO_ESTOQUE[m.tipo].label}
                          </StatusBadge>
                          <p
                            className={cn(
                              "font-bold tabular-nums",
                              m.variacao < 0 ? "text-destructive" : "text-success",
                            )}
                          >
                            {m.variacao > 0 ? "+" : "−"}
                            {formatarQuantidade(Math.abs(m.variacao), m.unidade)}
                          </p>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{m.motivo}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          saldo {formatarQuantidade(m.saldoResultante, m.unidade)}
                          {m.nomeMembro ? ` · ${m.nomeMembro}` : ""} · {dateTime(m.criadoEm)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResumoCard({
  rotulo,
  valor,
  dica,
}: {
  rotulo: string;
  valor: string;
  dica: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5">
      <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 text-xl font-bold tracking-tight tabular-nums text-foreground">
        {valor}{" "}
        <span className="text-sm font-medium text-muted-foreground">{dica}</span>
      </p>
    </div>
  );
}
