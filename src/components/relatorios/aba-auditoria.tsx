import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useAuditoria, useAutoresAuditoria } from "@/hooks/use-relatorios";
import { dateShort, time } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CategoriaAuditoria, Periodo, RegistroAuditoria } from "@/services/relatorios";

import {
  ACAO_LABEL,
  ACOES_SENSIVEIS,
  CATEGORIA_LABEL,
  descreverAuditoria,
} from "./descricao-auditoria";

const CATEGORIAS = Object.keys(CATEGORIA_LABEL) as CategoriaAuditoria[];

/** Registros agrupados pelo dia em que aconteceram, mantendo a ordem recebida. */
function agruparPorDia(registros: RegistroAuditoria[]) {
  const grupos: { dia: string; registros: RegistroAuditoria[] }[] = [];
  for (const r of registros) {
    const dia = dateShort(r.criadoEm);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dia === dia) ultimo.registros.push(r);
    else grupos.push({ dia, registros: [r] });
  }
  return grupos;
}

export function AbaAuditoria({ periodo }: { periodo: Periodo }) {
  const [categoria, setCategoria] = useState<CategoriaAuditoria | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const auditoria = useAuditoria({ periodo, categoria, usuarioId });
  const autores = useAutoresAuditoria();

  const nomes = new Map((autores.data ?? []).map((a) => [a.usuarioId, a.nome]));
  const nomeDe = (id: string | null) =>
    id ? (nomes.get(id) ?? (autores.isPending ? "…" : "Ex-membro")) : "Sistema";

  const registros = auditoria.data?.pages.flat() ?? [];
  const filtrando = categoria !== null || usuarioId !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Filtrar por categoria"
        >
          {[null, ...CATEGORIAS].map((c) => {
            const ativo = categoria === c;
            return (
              <button
                key={c ?? "todas"}
                type="button"
                aria-pressed={ativo}
                onClick={() => setCategoria(c)}
                className={cn(
                  "h-9 shrink-0 cursor-pointer rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  ativo
                    ? "border-primary/25 bg-primary-soft text-primary-strong"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {c ? CATEGORIA_LABEL[c] : "Todas"}
              </button>
            );
          })}
        </div>
        <NativeSelect
          value={usuarioId ?? ""}
          onChange={(e) => setUsuarioId(e.target.value || null)}
          className="sm:w-56"
          aria-label="Filtrar por funcionário"
          disabled={!autores.data}
        >
          <option value="">Todos os funcionários</option>
          {(autores.data ?? []).map((a) => (
            <option key={a.usuarioId} value={a.usuarioId}>
              {a.nome}
              {a.ativo ? "" : " (desativado)"}
            </option>
          ))}
        </NativeSelect>
      </div>

      {auditoria.isPending ? (
        <LoadingState label="Carregando auditoria…" />
      ) : auditoria.isError ? (
        <ErrorState
          description="Não foi possível carregar a auditoria."
          onRetry={() => void auditoria.refetch()}
        />
      ) : registros.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhuma operação registrada"
          description={
            filtrando
              ? "Nada encontrado com esses filtros no período. Tente outra categoria ou funcionário."
              : "Nenhuma operação crítica aconteceu no período escolhido."
          }
          action={
            filtrando && (
              <Button
                variant="outline"
                onClick={() => {
                  setCategoria(null);
                  setUsuarioId(null);
                }}
              >
                Limpar filtros
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {agruparPorDia(registros).map((grupo) => (
            <section key={grupo.dia} aria-label={`Operações de ${grupo.dia}`} className="space-y-2">
              <h3 className="px-1 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {grupo.dia}
              </h3>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm shadow-xs">
                {grupo.registros.map((r) => {
                  const descricao = descreverAuditoria(r.acao, r.dados);
                  const sensivel = ACOES_SENSIVEIS.has(r.acao);
                  return (
                    <li key={r.id} className="flex gap-3 px-4 py-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          sensivel ? "bg-warning" : "bg-border",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">
                          {ACAO_LABEL[r.acao] ?? r.acao}
                        </p>
                        {descricao && (
                          <p className="text-xs break-words text-muted-foreground">{descricao}</p>
                        )}
                      </div>
                      <p className="shrink-0 text-right text-xs text-muted-foreground">
                        <span className="block font-medium text-foreground tabular-nums">
                          {time(r.criadoEm)}
                        </span>
                        {nomeDe(r.usuarioId)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {auditoria.isFetchNextPageError && (
            <p className="text-center text-xs text-destructive">
              Não foi possível carregar mais registros. Tente de novo.
            </p>
          )}
          {auditoria.hasNextPage ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={auditoria.isFetchingNextPage}
              onClick={() => void auditoria.fetchNextPage()}
            >
              {auditoria.isFetchingNextPage && <Loader2 className="animate-spin" />}
              Carregar mais
            </Button>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {registros.length === 1 ? "1 operação" : `${registros.length} operações`} no período.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
