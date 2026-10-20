import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, History } from "lucide-react";
import { useMemo, useState } from "react";

import {
  fatiaPagina,
  ITENS_POR_PAGINA_ESTOQUE,
  PaginacaoEstoque,
} from "@/components/estoque/paginacao";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMovimentacoesEstoque } from "@/hooks/use-estoque";
import { dateTime } from "@/lib/format";
import { TIPO_MOVIMENTACAO_ESTOQUE } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  formatarQuantidade,
  type TipoMovimentacaoEstoque,
} from "@/services/estoque";

export const Route = createFileRoute("/estoque_/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de estoque — Arvon Food" },
      { name: "description", content: "Listagem completa das movimentações de estoque." },
    ],
  }),
  component: () => (
    <AppLayout module="estoque">
      <HistoricoEstoque />
    </AppLayout>
  ),
});

function HistoricoEstoque() {
  const movimentacoes = useMovimentacoesEstoque(undefined, 200);
  const [pagina, setPagina] = useState(1);
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | TipoMovimentacaoEstoque>("TODOS");

  const filtrados = useMemo(() => {
    const base = movimentacoes.data ?? [];
    if (filtroTipo === "TODOS") return base;
    return base.filter((m) => m.tipo === filtroTipo);
  }, [movimentacoes.data, filtroTipo]);

  const paginaAtual = fatiaPagina(filtrados, pagina);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico de estoque"
        description="Todas as entradas, saídas, ajustes e baixas de venda."
        actions={
          <Button variant="outline" asChild>
            <Link to="/estoque">
              <ArrowLeft className="size-4" aria-hidden="true" /> Voltar ao estoque
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Tipo
          <NativeSelect
            className="w-40"
            value={filtroTipo}
            onChange={(e) => {
              setFiltroTipo(e.target.value as "TODOS" | TipoMovimentacaoEstoque);
              setPagina(1);
            }}
          >
            <option value="TODOS">Todos</option>
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
            <option value="AJUSTE">Ajuste</option>
          </NativeSelect>
        </label>
        <p className="text-xs text-muted-foreground">
          {filtrados.length} registro(s) · {ITENS_POR_PAGINA_ESTOQUE} por página
        </p>
      </div>

      {movimentacoes.isPending ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, n) => (
            <Skeleton key={n} className="h-14 w-full" />
          ))}
        </div>
      ) : movimentacoes.isError ? (
        <ErrorState
          description="Não foi possível carregar o histórico."
          onRetry={() => void movimentacoes.refetch()}
        />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sem movimentações"
          description="Quando houver lançamentos, eles aparecem nesta listagem."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <ul className="divide-y divide-border text-sm">
            {paginaAtual.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3.5">
                <StatusBadge tone={TIPO_MOVIMENTACAO_ESTOQUE[m.tipo].tone} className="mt-0.5">
                  {m.origem === "PEDIDO"
                    ? m.variacao < 0
                      ? "Venda"
                      : "Devolução"
                    : TIPO_MOVIMENTACAO_ESTOQUE[m.tipo].label}
                </StatusBadge>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-semibold text-foreground">{m.itemNome}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.motivo}
                    {m.observacao && ` · ${m.observacao}`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.nomeMembro ? `${m.nomeMembro} · ` : ""}
                    {dateTime(m.criadoEm)}
                  </p>
                </div>
                <div className="ml-auto text-right whitespace-nowrap tabular-nums">
                  <p
                    className={cn(
                      "font-bold",
                      m.variacao < 0 ? "text-destructive" : "text-success",
                    )}
                  >
                    {m.variacao > 0 ? "+" : "−"}
                    {formatarQuantidade(Math.abs(m.variacao), m.unidade)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    saldo {formatarQuantidade(m.saldoResultante, m.unidade)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 pb-3">
            <PaginacaoEstoque
              pagina={pagina}
              total={filtrados.length}
              onChange={setPagina}
            />
          </div>
        </div>
      )}
    </div>
  );
}
