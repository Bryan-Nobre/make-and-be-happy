import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSetores } from "@/hooks/use-catalogo";
import { usePainelCozinha, usePedidoMutations, useRealtimeCozinha } from "@/hooks/use-pedidos";
import { minutesSince, time } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StatusPedido, TicketCozinha } from "@/services/pedidos";

export const Route = createFileRoute("/cozinha")({
  validateSearch: (search: Record<string, unknown>): { setor?: string } => {
    const setor = search["setor"];
    return typeof setor === "string" && setor !== "" ? { setor } : {};
  },
  head: () => ({
    meta: [
      { title: "Cozinha — ARVON FOOD" },
      { name: "description", content: "Painel de produção com pedidos por etapa de preparo." },
      { property: "og:title", content: "Cozinha — ARVON FOOD" },
      {
        property: "og:description",
        content: "Painel de produção com pedidos por etapa de preparo.",
      },
    ],
  }),
  component: () => (
    <AppLayout module="cozinha">
      <Cozinha />
    </AppLayout>
  ),
});

const COLUNAS: {
  status: StatusPedido;
  titulo: string;
  proximo: StatusPedido;
  acao: string;
  vazio: string;
}[] = [
  {
    status: "CONFIRMED",
    titulo: "Novos",
    proximo: "PREPARING",
    acao: "Começar",
    vazio: "Nenhum pedido novo",
  },
  {
    status: "PREPARING",
    titulo: "Em preparo",
    proximo: "READY",
    acao: "Finalizar",
    vazio: "Nenhum pedido em preparo",
  },
  {
    status: "READY",
    titulo: "Prontos",
    proximo: "DELIVERED",
    acao: "Entregar",
    vazio: "Nenhum pedido pronto",
  },
];

const ATENCAO_MIN = 10;
const ATRASO_MIN = 20;

/** Força a nova renderização para o relógio de espera andar sozinho. */
function useRelogio(intervaloMs: number) {
  const [, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => window.clearInterval(id);
  }, [intervaloMs]);
}

const rotuloPedidos = (n: number) => `${n} ${n === 1 ? "pedido" : "pedidos"}`;

function Cozinha() {
  useRealtimeCozinha();
  useRelogio(30_000);
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const setores = useSetores();
  const ativos = (setores.data ?? []).filter((s) => s.ativo);
  const setor = ativos.some((s) => s.id === busca.setor) ? busca.setor : undefined;
  const painel = usePainelCozinha(setor);
  const { avancar } = usePedidoMutations();
  const [etapa, setEtapa] = useState<StatusPedido>("CONFIRMED");

  const ticketsDa = (status: StatusPedido) =>
    (painel.data ?? [])
      .filter((t) => t.status === status)
      .sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cozinha"
        description="Pedidos em produção"
        actions={
          painel.data && (
            <span className="flex h-8 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm text-muted-foreground">
              <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
              <span className="font-semibold text-foreground tabular-nums">
                {painel.data.length}
              </span>
              em produção
            </span>
          )
        }
      />

      {ativos.length > 0 && (
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Filtrar por setor"
        >
          {[{ id: undefined, nome: "Todos" }, ...ativos].map((s) => {
            const ativo = setor === s.id;
            return (
              <button
                key={s.id ?? "todos"}
                type="button"
                aria-pressed={ativo}
                onClick={() =>
                  void navigate({ search: s.id ? { setor: s.id } : {}, replace: true })
                }
                className={cn(
                  "h-10 shrink-0 cursor-pointer rounded-full border px-5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  ativo
                    ? "border-primary/25 bg-primary-soft text-primary-strong"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {s.nome}
              </button>
            );
          })}
        </div>
      )}

      {painel.isError ? (
        <ErrorState
          description="Não foi possível carregar o painel da cozinha."
          onRetry={() => void painel.refetch()}
          className="py-8"
        />
      ) : (
        <>
          <div
            className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1 xl:hidden"
            role="group"
            aria-label="Etapa de produção"
          >
            {COLUNAS.map((coluna) => {
              const ativo = etapa === coluna.status;
              return (
                <button
                  key={coluna.status}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setEtapa(coluna.status)}
                  className={cn(
                    "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold tracking-wide uppercase transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none sm:text-sm",
                    ativo
                      ? "bg-primary-soft text-primary-strong"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {coluna.titulo}
                  {painel.data && (
                    <span className="text-xs font-medium tabular-nums opacity-80">
                      {ticketsDa(coluna.status).length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            {COLUNAS.map((coluna) => {
              const tickets = ticketsDa(coluna.status);
              return (
                <section
                  key={coluna.status}
                  aria-label={coluna.titulo}
                  className={cn(
                    "flex-col gap-3 xl:rounded-xl xl:bg-muted/50 xl:p-3",
                    etapa === coluna.status ? "flex" : "hidden xl:flex",
                  )}
                >
                  <h2 className="hidden items-baseline gap-2 px-1 pt-1 xl:flex">
                    <span className="text-sm font-semibold tracking-wide text-foreground uppercase">
                      {coluna.titulo}
                    </span>
                    {painel.data && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {rotuloPedidos(tickets.length)}
                      </span>
                    )}
                  </h2>

                  {painel.isPending ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1" aria-busy="true">
                      <span className="sr-only">Carregando pedidos…</span>
                      <TicketSkeleton />
                      <TicketSkeleton />
                    </div>
                  ) : tickets.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                      {coluna.vazio}
                    </p>
                  ) : (
                    <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-1">
                      {tickets.map((t) => (
                        <Ticket
                          key={t.pedidoId}
                          ticket={t}
                          acao={coluna.acao}
                          ocupado={avancar.isPending && avancar.variables?.pedidoId === t.pedidoId}
                          aoAvancar={() =>
                            avancar.mutate({ pedidoId: t.pedidoId, para: coluna.proximo })
                          }
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function TicketSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-4 w-14" />
      </div>
      <Skeleton className="mt-2 h-3.5 w-36" />
      <div className="mt-4 space-y-2.5 border-t border-border/60 pt-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="mt-4 h-12 w-full rounded-lg" />
    </div>
  );
}

function Observacao({ texto }: { texto: string }) {
  return (
    <div className="rounded-md bg-muted/70 px-3 py-2">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        Observação
      </p>
      <p className="text-[13px] font-medium text-foreground">{texto}</p>
    </div>
  );
}

function Ticket({
  ticket,
  acao,
  ocupado,
  aoAvancar,
}: {
  ticket: TicketCozinha;
  acao: string;
  ocupado: boolean;
  aoAvancar: () => void;
}) {
  const minutos = minutesSince(ticket.enviadoEm);
  const atrasado = ticket.status !== "READY" && minutos >= ATRASO_MIN;
  const atencao = ticket.status !== "READY" && minutos >= ATENCAO_MIN && !atrasado;

  const destino =
    ticket.origem === "MESA"
      ? `${ticket.nomeMesa ?? "Mesa"}${ticket.comandaNumero ? ` · Comanda #${ticket.comandaNumero}` : ""}`
      : "Balcão";

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-4 shadow-xs",
        ticket.status === "READY" ? "border-primary/30" : "border-border",
        atencao && "border-warning/60",
        atrasado && "border-destructive/50",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold text-foreground tabular-nums">
          #{ticket.numero}
        </span>
        <span
          title={`Enviado às ${time(ticket.enviadoEm)}`}
          className={cn(
            "flex items-center gap-1 text-xs font-medium tabular-nums",
            atrasado ? "text-destructive" : atencao ? "text-warning" : "text-muted-foreground",
          )}
        >
          <Clock className="size-3.5" aria-hidden="true" />
          Há {String(minutos).padStart(2, "0")}min
        </span>
      </header>
      <p className="mt-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {destino}
      </p>

      <ul className="mt-3 space-y-3 border-t border-border/60 pt-3">
        {ticket.itens.map((i) => (
          <li key={i.id} className="flex gap-2.5">
            <span className="min-w-7 text-base leading-5 font-bold text-foreground tabular-nums">
              {i.quantidade}×
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5 font-semibold text-foreground">
                {i.nomeProduto}
                {i.adicionadoDepois && <StatusBadge tone="info">Novo</StatusBadge>}
                {i.nomeSetor && (
                  <span className="text-xs font-normal text-muted-foreground">{i.nomeSetor}</span>
                )}
              </p>
              {i.adicionais.map((a, n) => (
                <p key={n} className="text-[13px] text-muted-foreground">
                  + {a}
                </p>
              ))}
              {i.observacoes && <Observacao texto={i.observacoes} />}
            </div>
          </li>
        ))}
      </ul>

      {ticket.observacoes && (
        <div className="mt-3">
          <Observacao texto={ticket.observacoes} />
        </div>
      )}

      <div className="mt-4 border-t border-border/60 pt-4">
        <Button
          size="operational"
          className="w-full tracking-wide uppercase"
          disabled={ocupado}
          onClick={aoAvancar}
        >
          {ocupado ? "Atualizando…" : acao}
        </Button>
      </div>
    </article>
  );
}
