import { History } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fatiaPagina,
  ITENS_POR_PAGINA_ESTOQUE,
  PaginacaoEstoque,
} from "@/components/estoque/paginacao";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMovimentacoesEstoque } from "@/hooks/use-estoque";
import { dateTime } from "@/lib/format";
import { TIPO_MOVIMENTACAO_ESTOQUE } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  formatarQuantidade,
  type TipoMovimentacaoEstoque,
} from "@/services/estoque";

export function TransacoesRecentes({
  filtroTipos = [],
}: {
  /** Quando preenchido, mostra só esses tipos (ex.: filtro pelas KPIs do dia). */
  filtroTipos?: TipoMovimentacaoEstoque[];
}) {
  const movimentacoes = useMovimentacoesEstoque(undefined, 100);
  const [pagina, setPagina] = useState(1);

  const lista = useMemo(() => {
    const base = movimentacoes.data ?? [];
    if (filtroTipos.length === 0) return base;
    const tipos = new Set(filtroTipos);
    return base.filter((m) => tipos.has(m.tipo));
  }, [movimentacoes.data, filtroTipos]);

  useEffect(() => {
    setPagina(1);
  }, [filtroTipos]);

  const paginaAtual = fatiaPagina(lista, pagina);

  return (
    <aside className="flex w-full flex-col rounded-xl border border-border bg-card shadow-xs">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Transações recentes</h2>
      </div>

      {movimentacoes.isPending ? (
        <div className="space-y-3 p-4" aria-busy="true">
          {Array.from({ length: ITENS_POR_PAGINA_ESTOQUE }, (_, n) => (
            <div key={n} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : movimentacoes.isError ? (
        <div className="p-4">
          <ErrorState
            description="Não foi possível carregar o histórico."
            onRetry={() => void movimentacoes.refetch()}
          />
        </div>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sem movimentações"
          description="Entradas, saídas e ajustes aparecerão aqui."
          className="py-10"
        />
      ) : (
        <>
          <ul className="divide-y divide-border text-sm">
            {paginaAtual.map((m) => (
              <li key={m.id} className="px-4 py-3">
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
                      "shrink-0 text-sm font-bold tabular-nums",
                      m.variacao < 0 ? "text-destructive" : "text-success",
                    )}
                  >
                    {m.variacao > 0 ? "+" : "−"}
                    {formatarQuantidade(Math.abs(m.variacao), m.unidade)}
                  </p>
                </div>
                <p className="mt-1 truncate font-medium text-foreground">{m.itemNome}</p>
                <p className="truncate text-xs text-muted-foreground">{m.motivo}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {m.nomeMembro ? `${m.nomeMembro} · ` : ""}
                  {dateTime(m.criadoEm)}
                </p>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 pb-3">
            <PaginacaoEstoque
              pagina={pagina}
              total={lista.length}
              onChange={(p) => setPagina(p)}
            />
          </div>
        </>
      )}
    </aside>
  );
}
