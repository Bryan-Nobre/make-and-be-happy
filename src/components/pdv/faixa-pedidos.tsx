import type { UseQueryResult } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { time } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PedidoDoDia } from "@/services/pedidos";

import {
  aguardandoPagamento,
  emAndamento,
  finalizado,
  numeroPedido,
  STATUS_OPERACIONAL,
  STATUS_PAGAMENTO,
} from "./status";

type Filtro = "TODOS" | "ANDAMENTO" | "PAGAMENTO" | "FINALIZADOS";

const FILTROS: { id: Filtro; label: string; aplica: (p: PedidoDoDia) => boolean }[] = [
  { id: "TODOS", label: "Todos", aplica: () => true },
  { id: "ANDAMENTO", label: "Em andamento", aplica: emAndamento },
  { id: "PAGAMENTO", label: "Aguardando pagamento", aplica: aguardandoPagamento },
  { id: "FINALIZADOS", label: "Finalizados", aplica: finalizado },
];

/** Fundo do card por situação de produção, como na fila do salão. */
const FUNDO: Record<Tone, string> = {
  info: "border-info/20 bg-info-soft/70",
  warning: "border-warning/25 bg-warning-soft/70",
  success: "border-success/20 bg-success-soft/80",
  primary: "border-border bg-card",
  danger: "border-border bg-card opacity-70",
  neutral: "border-border bg-card",
};

export function FaixaPedidos({
  pedidos,
  selecionadoId,
  aoSelecionar,
}: {
  pedidos: UseQueryResult<PedidoDoDia[]>;
  selecionadoId: string | null;
  aoSelecionar: (pedidoId: string) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const trilho = useRef<HTMLUListElement>(null);

  const lista = pedidos.data ?? [];
  const aplica = FILTROS.find((f) => f.id === filtro)?.aplica ?? (() => true);
  const visiveis = lista.filter(aplica);

  const rolar = (direcao: 1 | -1) =>
    trilho.current?.scrollBy({ left: direcao * 280, behavior: "smooth" });

  return (
    <section aria-labelledby="titulo-faixa" className="min-w-0 space-y-3">
      <h2 id="titulo-faixa" className="sr-only">
        Pedidos de hoje
      </h2>
      <div className="flex items-center gap-2">
        <div
          className="trilho -mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-0.5"
          role="group"
          aria-label="Filtrar pedidos"
        >
          {FILTROS.map((f) => {
            const ativo = filtro === f.id;
            const total = lista.filter(f.aplica).length;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltro(f.id)}
                className={cn(
                  "flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  ativo
                    ? "border-primary/40 bg-primary-soft text-primary-strong"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                    ativo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {total}
                </span>
              </button>
            );
          })}
        </div>
        {visiveis.length > 2 && (
          <div className="hidden shrink-0 gap-1 md:flex">
            <BotaoRolar rotulo="Pedidos anteriores" onClick={() => rolar(-1)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </BotaoRolar>
            <BotaoRolar rotulo="Próximos pedidos" onClick={() => rolar(1)}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </BotaoRolar>
          </div>
        )}
      </div>

      {pedidos.isPending ? (
        <div
          className="flex gap-3 overflow-hidden"
          aria-busy="true"
          aria-label="Carregando pedidos"
        >
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-[104px] w-56 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : pedidos.isError ? (
        <ErrorState
          className="py-4"
          description="Não foi possível carregar os pedidos de hoje."
          onRetry={() => void pedidos.refetch()}
        />
      ) : visiveis.length === 0 ? (
        <p className="flex h-[104px] items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
          {lista.length === 0 ? "Nenhum pedido lançado hoje." : "Nenhum pedido neste filtro."}
        </p>
      ) : (
        <ul
          ref={trilho}
          className="trilho -mx-1 flex snap-x gap-3 overflow-x-auto px-1 py-1"
          aria-label="Pedidos de hoje"
        >
          {visiveis.map((p) => (
            <li key={p.id} className="snap-start">
              <CardPedido
                pedido={p}
                selecionado={p.id === selecionadoId}
                aoSelecionar={() => aoSelecionar(p.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CardPedido({
  pedido: p,
  selecionado,
  aoSelecionar,
}: {
  pedido: PedidoDoDia;
  selecionado: boolean;
  aoSelecionar: () => void;
}) {
  const operacional = STATUS_OPERACIONAL[p.status];
  const pagamento = STATUS_PAGAMENTO[p.statusFinanceiro];
  const local = p.origem === "MESA" ? (p.nomeMesa ?? "Mesa") : "Balcão";

  return (
    <button
      type="button"
      onClick={aoSelecionar}
      aria-pressed={selecionado}
      aria-label={`Pedido ${numeroPedido(p.numero)}, ${local}, ${operacional.label}, ${pagamento.label}`}
      className={cn(
        "flex h-[104px] w-56 cursor-pointer flex-col justify-between rounded-xl border p-3 text-left transition-[box-shadow,transform] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        FUNDO[operacional.tone],
        selecionado && "border-primary shadow-sm ring-2 ring-primary/70",
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-foreground tabular-nums">
          Pedido {numeroPedido(p.numero)}
        </span>
        <span className="truncate text-xs font-medium text-muted-foreground">{local}</span>
      </span>
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-foreground tabular-nums">
          {p.quantidadeItens} {p.quantidadeItens === 1 ? "item" : "itens"}
        </span>
        {p.status !== "CANCELLED" && (
          <span className="truncate text-xs text-muted-foreground">{pagamento.label}</span>
        )}
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">{time(p.criadoEm)}</span>
        <StatusBadge tone={operacional.tone} className="h-5 px-2 text-[11px]">
          {operacional.label}
        </StatusBadge>
      </span>
    </button>
  );
}

function BotaoRolar({
  rotulo,
  onClick,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
