import { createFileRoute } from "@tanstack/react-router";
import { ChefHat } from "lucide-react";
import { useEffect, useState } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
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

const COLUNAS: { status: StatusPedido; titulo: string; proximo: StatusPedido; acao: string }[] = [
  { status: "CONFIRMED", titulo: "Novos", proximo: "PREPARING", acao: "Iniciar preparo" },
  { status: "PREPARING", titulo: "Em preparo", proximo: "READY", acao: "Marcar pronto" },
  { status: "READY", titulo: "Prontos", proximo: "DELIVERED", acao: "Entregar" },
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

  return (
    <div className="space-y-6">
      <PageHeader title="Cozinha" description="Acompanhe e avance os pedidos em produção." />

      {ativos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{ id: undefined, nome: "Todos" }, ...ativos].map((s) => (
            <Button
              key={s.id ?? "todos"}
              size="sm"
              variant={setor === s.id ? "default" : "outline"}
              onClick={() => void navigate({ search: s.id ? { setor: s.id } : {}, replace: true })}
            >
              {s.nome}
            </Button>
          ))}
        </div>
      )}

      {painel.isPending ? (
        <LoadingState label="Carregando pedidos…" />
      ) : painel.isError ? (
        <ErrorState
          description="Não foi possível carregar o painel da cozinha."
          onRetry={() => void painel.refetch()}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUNAS.map((coluna) => {
            const tickets = painel.data
              .filter((t) => t.status === coluna.status)
              .sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm));
            return (
              <section key={coluna.status} className="rounded-lg border bg-muted/40 p-3">
                <h2 className="mb-3 flex items-center justify-between font-semibold">
                  {coluna.titulo}
                  <span className="rounded-md bg-card px-2 text-sm tabular-nums">
                    {tickets.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {tickets.length === 0 && (
                    <EmptyState
                      icon={ChefHat}
                      title="Nada aqui"
                      description="Nenhum pedido nesta etapa."
                    />
                  )}
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
              </section>
            );
          })}
        </div>
      )}
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
      ? `${ticket.nomeMesa ?? "Mesa"}${ticket.comandaNumero ? ` · Comanda ${ticket.comandaNumero}` : ""}`
      : "Balcão";

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-3",
        atrasado && "border-destructive/50",
        atencao && "border-warning/60",
      )}
    >
      <header className="flex items-center justify-between">
        <span className="font-bold">#{ticket.numero}</span>
        <span
          className={cn(
            "text-xs tabular-nums",
            atrasado ? "font-semibold text-destructive" : "text-muted-foreground",
          )}
        >
          {time(ticket.enviadoEm)} · {minutos} min
        </span>
      </header>
      <p className="text-xs text-muted-foreground">{destino}</p>
      {ticket.observacoes && (
        <p className="mt-1 text-xs font-medium text-warning-foreground">⚠ {ticket.observacoes}</p>
      )}
      <ul className="mt-2 space-y-1 text-sm">
        {ticket.itens.map((i) => (
          <li key={i.id}>
            <span className="font-semibold tabular-nums">{i.quantidade}×</span> {i.nomeProduto}
            {i.adicionadoDepois && (
              <StatusBadge tone="info" className="ml-2">
                Novo
              </StatusBadge>
            )}
            {i.nomeSetor && (
              <span className="ml-1 text-xs text-muted-foreground">({i.nomeSetor})</span>
            )}
            {i.adicionais.length > 0 && (
              <span className="block text-xs text-muted-foreground">
                + {i.adicionais.join(", ")}
              </span>
            )}
            {i.observacoes && (
              <span className="block text-xs font-medium text-warning-foreground">
                ⚠ {i.observacoes}
              </span>
            )}
          </li>
        ))}
      </ul>
      <Button className="mt-3 h-11 w-full" disabled={ocupado} onClick={aoAvancar}>
        {ocupado ? "Atualizando…" : acao}
      </Button>
    </article>
  );
}
