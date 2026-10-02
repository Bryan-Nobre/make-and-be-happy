import { Check, ChefHat, Users } from "lucide-react";

import { brl, elapsed } from "@/lib/format";
import { STATUS_MESA } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { MesaEstado } from "@/services/pedidos";

import {
  VISUAL_MESA,
  contaPaga,
  distribuirCadeiras,
  formatoDaMesa,
  pessoasTexto,
  valorDaMesa,
} from "./visual";

type Lado = "topo" | "direita" | "base" | "esquerda";

function Cadeiras({
  quantidade,
  inicio,
  ocupadas,
  cor,
  lado,
}: {
  quantidade: number;
  inicio: number;
  ocupadas: number;
  cor: string;
  lado: Lado;
}) {
  if (quantidade === 0) return null;
  const vertical = lado === "esquerda" || lado === "direita";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 justify-center",
        vertical ? "flex-col gap-3 self-center" : "flex-row gap-4 sm:gap-5",
      )}
    >
      {Array.from({ length: quantidade }, (_, n) => (
        <span
          key={n}
          className={cn(
            "rounded-full transition-colors",
            vertical ? "h-7 w-2 sm:h-8 sm:w-2.5" : "h-2 w-7 sm:h-2.5 sm:w-8",
            inicio + n < ocupadas ? cor : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

function MesaNoMapa({
  mesa,
  destacada,
  aoSelecionar,
}: {
  mesa: MesaEstado;
  destacada: boolean;
  aoSelecionar: () => void;
}) {
  const visual = VISUAL_MESA[mesa.status];
  const formato = formatoDaMesa(mesa.lugares);
  const cadeiras = distribuirCadeiras(mesa.lugares);
  const ocupadas = mesa.status === "LIVRE" ? 0 : (mesa.pessoas ?? 0);
  const livre = mesa.status === "LIVRE";

  return (
    <button
      type="button"
      data-mesa-id={mesa.id}
      onClick={aoSelecionar}
      aria-pressed={destacada}
      aria-label={`${mesa.nome}, ${STATUS_MESA[mesa.status].label}, ${mesa.lugares} lugares`}
      className={cn(
        "group flex cursor-pointer scroll-m-24 flex-col items-center gap-2 rounded-3xl p-1.5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        formato === "retangular" && "max-sm:col-span-2",
      )}
    >
      <Cadeiras
        lado="topo"
        quantidade={cadeiras.topo}
        inicio={0}
        ocupadas={ocupadas}
        cor={visual.cadeira}
      />
      <span className="flex items-stretch gap-2">
        <Cadeiras
          lado="esquerda"
          quantidade={cadeiras.esquerda}
          inicio={cadeiras.topo + cadeiras.direita + cadeiras.base}
          ocupadas={ocupadas}
          cor={visual.cadeira}
        />
        <span
          className={cn(
            "relative flex flex-col items-center justify-center gap-0.5 border px-2 text-center transition-[transform,box-shadow,border-color] duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md",
            visual.tampo,
            formato === "pequena" && "size-26 rounded-full sm:size-30",
            formato === "quadrada" && "size-27 rounded-2xl sm:size-34",
            formato === "retangular" && "h-30 w-52 rounded-2xl sm:h-34 sm:w-60",
            destacada && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          )}
        >
          {mesa.pedidosEmProducao > 0 && (
            <span
              className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full border border-border bg-card px-1.5 text-[11px] font-medium text-muted-foreground shadow-sm"
              title={`${mesa.pedidosEmProducao} em produção`}
            >
              <ChefHat className="size-3" aria-hidden="true" />
              <span className="tabular-nums">{mesa.pedidosEmProducao}</span>
              <span className="sr-only"> em produção</span>
            </span>
          )}
          <span className="text-sm font-semibold text-foreground">{mesa.nome}</span>
          {livre ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className={cn("size-2 rounded-full", VISUAL_MESA.LIVRE.ponto)}
              />
              Livre
            </span>
          ) : (
            <>
              {mesa.pessoas !== null && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Users className="size-3" aria-hidden="true" />
                  {pessoasTexto(mesa.pessoas)}
                </span>
              )}
              <span className="flex items-center gap-1 text-sm font-semibold text-foreground tabular-nums">
                {brl(valorDaMesa(mesa))}
                {contaPaga(mesa) && (
                  <>
                    <Check className="size-3.5 text-success" aria-hidden="true" />
                    <span className="sr-only">conta paga</span>
                  </>
                )}
              </span>
              {mesa.abertaEm && (
                <span className={cn("text-[11px] tabular-nums", visual.texto)}>
                  {elapsed(mesa.abertaEm)}
                </span>
              )}
            </>
          )}
        </span>
        <Cadeiras
          lado="direita"
          quantidade={cadeiras.direita}
          inicio={cadeiras.topo}
          ocupadas={ocupadas}
          cor={visual.cadeira}
        />
      </span>
      <Cadeiras
        lado="base"
        quantidade={cadeiras.base}
        inicio={cadeiras.topo + cadeiras.direita}
        ocupadas={ocupadas}
        cor={visual.cadeira}
      />
    </button>
  );
}

export function MapaSalao({
  mesas,
  destacadaId,
  aoSelecionar,
}: {
  mesas: MesaEstado[];
  destacadaId: string | null;
  aoSelecionar: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 justify-items-center gap-x-2 gap-y-8 sm:flex sm:flex-wrap sm:content-start sm:items-center sm:justify-center sm:gap-x-14 sm:gap-y-12 xl:gap-x-20">
      {mesas.map((m) => (
        <MesaNoMapa
          key={m.id}
          mesa={m}
          destacada={m.id === destacadaId}
          aoSelecionar={() => aoSelecionar(m.id)}
        />
      ))}
    </div>
  );
}

export function ListaMesas({
  mesas,
  destacadaId,
  aoSelecionar,
}: {
  mesas: MesaEstado[];
  destacadaId: string | null;
  aoSelecionar: (id: string) => void;
}) {
  if (mesas.length === 0) {
    return <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhuma mesa.</p>;
  }

  return (
    <ul className="space-y-0.5">
      {mesas.map((m) => {
        const ativa = m.id === destacadaId;
        const livre = m.status === "LIVRE";
        return (
          <li key={m.id}>
            <button
              type="button"
              aria-pressed={ativa}
              onClick={() => aoSelecionar(m.id)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                ativa ? "bg-primary-soft" : "hover:bg-muted/60",
              )}
            >
              <span
                aria-hidden="true"
                className={cn("size-2 shrink-0 rounded-full", VISUAL_MESA[m.status].ponto)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{m.nome}</span>
                <span className="block truncate text-xs text-muted-foreground tabular-nums">
                  {livre
                    ? "Livre"
                    : [m.pessoas ? pessoasTexto(m.pessoas) : null, brl(valorDaMesa(m))]
                        .filter(Boolean)
                        .join(" · ")}
                </span>
              </span>
              {!livre && m.abertaEm && (
                <span
                  className={cn(
                    "shrink-0 text-[11px] tabular-nums",
                    m.status === "AGUARDANDO_PAGAMENTO"
                      ? "text-warning-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {elapsed(m.abertaEm)}
                </span>
              )}
              {!livre && <span className="sr-only">, {STATUS_MESA[m.status].label}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
